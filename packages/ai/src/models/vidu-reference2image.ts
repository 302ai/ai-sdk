import type {
  ImageModelV3CallOptions,
  ImageModelV3CallWarning,
} from '@ai-sdk/provider';
import { combineHeaders, postJsonToApi, resolve } from '@ai-sdk/provider-utils';
import {
  type ViduSubmitResponse,
  type ViduTaskResult,
} from '../ai302-types';
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from '../utils/api-handlers';
import { BaseModelHandler } from './base-model';

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_TIME = 300000; // 5 minutes

export class ViduReference2ImageHandler extends BaseModelHandler {
  private getViduModel(): 'viduq1' | 'viduq2' {
    switch (this.modelId) {
      case 'vidu-viduq1':
        return 'viduq1';
      case 'vidu-viduq2':
      default:
        return 'viduq2';
    }
  }

  private async pollTask(
    taskId: string,
    resolvedHeaders: Record<string, string | undefined>,
    abortSignal?: AbortSignal,
  ): Promise<ViduTaskResult> {
    const startTime = Date.now();
    const fetchFn = this.config.fetch || fetch;

    while (true) {
      if (abortSignal?.aborted) {
        throw new Error('Task polling aborted');
      }

      if (Date.now() - startTime > MAX_POLL_TIME) {
        throw new Error('Task polling timed out');
      }

      const response = await fetchFn(
        `${this.config.url({ modelId: this.modelId, path: `/vidu/ent/v2/tasks/${taskId}/creations` })}`,
        {
          method: 'GET',
          headers: resolvedHeaders as HeadersInit,
          signal: abortSignal,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as ViduTaskResult;

      if (data.state === 'success' && data.creations && data.creations.length > 0) {
        return data;
      }

      if (data.state === 'failed' || data.err_code) {
        throw new Error(`Task failed: ${data.err_code || 'Unknown error'}`);
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  protected async processRequest({
    prompt,
    n,
    size,
    aspectRatio,
    seed,
    providerOptions,
    headers,
    abortSignal,
  }: ImageModelV3CallOptions) {
    const warnings: ImageModelV3CallWarning[] = [];
    const viduModel = this.getViduModel();

    if (n != null && n > 1) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'n',
        details: 'Vidu generates one image per request',
      });
    }

    if (size != null) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'size',
        details: 'Vidu uses resolution and aspect_ratio instead of size',
      });
    }

    // Validate aspect ratio
    const supportedAspectRatios = viduModel === 'viduq1'
      ? ['16:9', '9:16', '1:1', '3:4', '4:3']
      : ['auto', '16:9', '9:16', '1:1', '3:4', '4:3', '21:9', '2:3', '3:2'];

    let finalAspectRatio: string | undefined = aspectRatio;
    if (aspectRatio && !supportedAspectRatios.includes(aspectRatio)) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'aspectRatio',
        details: `Aspect ratio ${aspectRatio} not supported. Supported: ${supportedAspectRatios.join(', ')}`,
      });
      finalAspectRatio = '16:9';
    }

    // Get additional parameters from providerOptions
    const ai302Options = providerOptions?.ai302 || {};
    const images = ai302Options.images as string[] | undefined;
    const resolution = ai302Options.resolution as '1080p' | '2K' | '4K' | undefined;
    const payload = ai302Options.payload as string | undefined;

    // Validate resolution for viduq1
    if (viduModel === 'viduq1' && resolution && resolution !== '1080p') {
      warnings.push({
        type: 'other',
        message: 'viduq1 only supports 1080p resolution. Using 1080p.',
      });
    }

    // Validate images count
    if (images) {
      if (viduModel === 'viduq1' && images.length === 0) {
        throw new Error('viduq1 requires at least 1 reference image');
      }
      if (images.length > 7) {
        warnings.push({
          type: 'other',
          message: 'Maximum 7 reference images allowed. Using first 7.',
        });
      }
    }

    const resolvedHeaders = await resolve(this.config.headers());

    const { value: submitResponse, responseHeaders } =
      await postJsonToApi<ViduSubmitResponse>({
        url: this.config.url({
          modelId: this.modelId,
          path: '/vidu/ent/v2/reference2image',
        }),
        headers: combineHeaders(resolvedHeaders, headers),
        body: {
          model: viduModel,
          prompt,
          ...(images !== undefined && { images: images.slice(0, 7) }),
          ...(seed !== undefined && { seed }),
          ...(finalAspectRatio !== undefined && { aspect_ratio: finalAspectRatio }),
          ...(resolution !== undefined && viduModel === 'viduq2' && { resolution }),
          ...(viduModel === 'viduq1' && { resolution: '1080p' }),
          ...(payload !== undefined && { payload }),
        },
        failedResponseHandler: statusCodeErrorResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(),
        abortSignal,
        fetch: this.config.fetch,
      });

    const taskResult = await this.pollTask(submitResponse.task_id, resolvedHeaders, abortSignal);

    if (!taskResult.creations || taskResult.creations.length === 0) {
      throw new Error('No image generated');
    }

    const urls = taskResult.creations.map(c => c.url).filter(Boolean);
    const images_result = await this.downloadImages(urls);

    return {
      images: images_result,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: responseHeaders,
      },
    };
  }
}

