import {
  type ImageModelV3CallOptions,
  type SharedV3Warning,
} from '@ai-sdk/provider';
import { combineHeaders, postJsonToApi, resolve } from '@ai-sdk/provider-utils';
import {
  type KlingO1SubmitResponse,
  type KlingO1TaskResult,
  type KlingO1AspectRatio,
} from '../ai302-types';
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from '../utils/api-handlers';
import { BaseModelHandler, type ImageModelWarning } from './base-model';

const SUPPORTED_ASPECT_RATIOS: readonly KlingO1AspectRatio[] = [
  'auto',
  '9:16',
  '2:3',
  '3:4',
  '1:1',
  '4:3',
  '3:2',
  '16:9',
] as const;

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_TIME = 300000; // 5 minutes

export class KlingO1Handler extends BaseModelHandler {
  private async pollTask(
    taskId: string,
    resolvedHeaders: Record<string, string | undefined>,
    abortSignal?: AbortSignal,
  ): Promise<KlingO1TaskResult> {
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
        `${this.config.url({ modelId: this.modelId, path: `/klingai/task/${taskId}/fetch` })}`,
        {
          method: 'GET',
          headers: resolvedHeaders as HeadersInit,
          signal: abortSignal,
        },
      );

      if (!response.ok) {
        // Retry on 503 (service unavailable) - common during high load
        if (response.status === 503) {
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
          continue;
        }
        const errorBody = await response.text().catch(() => 'Unable to read response body');
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
      }

      const data = (await response.json()) as KlingO1TaskResult;

      if (data.code !== 0) {
        throw new Error(`API error: ${data.message || 'Unknown error'}`);
      }

      const taskStatus = data.data.task_status;

      // Task failed
      if (taskStatus === 'failed') {
        throw new Error(`Task failed: ${data.data.task_status_msg || 'Unknown error'}`);
      }

      // Task succeeded
      if (taskStatus === 'succeed' &&
          data.data.task_result?.images &&
          data.data.task_result.images.length > 0) {
        return data;
      }

      // Still processing (submitted or processing)

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  protected async processRequest({
    prompt,
    n,
    size,
    aspectRatio,
    providerOptions,
    headers,
    abortSignal,
  }: ImageModelV3CallOptions) {
    const warnings: SharedV3Warning[] = [];

    if (n != null && n > 9) {
      warnings.push({
        type: 'unsupported',
        feature: 'n > 9',
        details: 'Kling O1 supports up to 9 images per generation',
      });
    }

    if (size != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'size',
        details: 'Kling O1 uses img_resolution and aspect_ratio instead of size',
      });
    }

    // Validate aspect ratio
    let validatedAspectRatio: KlingO1AspectRatio = '1:1';
    if (aspectRatio) {
      if (SUPPORTED_ASPECT_RATIOS.includes(aspectRatio as KlingO1AspectRatio)) {
        validatedAspectRatio = aspectRatio as KlingO1AspectRatio;
      } else {
        warnings.push({
          type: 'unsupported',
          feature: 'aspectRatio',
          details: `Aspect ratio ${aspectRatio} not supported. Using 1:1. Supported: ${SUPPORTED_ASPECT_RATIOS.join(', ')}`,
        });
      }
    }

    // Get additional parameters from providerOptions
    const ai302Options = providerOptions?.ai302 || {};
    const images = ai302Options.images as string[] | undefined;
    const imgResolution = (ai302Options.img_resolution as '1k' | '2k') || '1k';
    const imageCount = n || (ai302Options.imageCount as number | undefined) || 1;

    // Validate images count
    if (images && images.length > 10) {
      warnings.push({
        type: 'unsupported',
        feature: 'images',
        details: 'Maximum 10 reference images allowed. Using first 10.',
      });
    }

    const resolvedHeaders = await resolve(this.config.headers());

    const { value: submitResponse, responseHeaders } =
      await postJsonToApi<KlingO1SubmitResponse>({
        url: this.config.url({
          modelId: this.modelId,
          path: '/klingai/mmu_omni_image',
        }),
        headers: combineHeaders(resolvedHeaders, headers),
        body: {
          images: images?.slice(0, 10) || [],
          prompt,
          imageCount: Math.min(imageCount, 9),
          aspect_ratio: validatedAspectRatio,
          img_resolution: imgResolution,
        },
        failedResponseHandler: statusCodeErrorResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(),
        abortSignal,
        fetch: this.config.fetch,
      });

    if (submitResponse.code !== 0) {
      throw new Error(`API error: ${submitResponse.message || 'Unknown error'}`);
    }

    const taskResult = await this.pollTask(
      submitResponse.data.task_id,
      resolvedHeaders,
      abortSignal,
    );

    if (!taskResult.data.task_result?.images || taskResult.data.task_result.images.length === 0) {
      throw new Error('No images returned from Kling O1 API');
    }

    const imageUrls = taskResult.data.task_result.images.map(img => img.url);
    const downloadedImages = await this.downloadImages(imageUrls);

    return {
      images: downloadedImages,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: responseHeaders,
      },
    };
  }
}

