import type {
  ImageModelV3CallOptions,

} from '@ai-sdk/provider';
import { combineHeaders, postJsonToApi, resolve } from '@ai-sdk/provider-utils';
import {
  type Flux2ProSubmitResponse,
  type Flux2ProResultResponse,
} from '../ai302-types';
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from '../utils/api-handlers';
import { BaseModelHandler, type ImageModelWarning } from './base-model';

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_TIME = 300000; // 5 minutes

export class Flux2ProHandler extends BaseModelHandler {
  private getEndpointPath(): string {
    switch (this.modelId) {
      case 'flux-2-flex':
        return '/flux/v1/flux-2-flex';
      case 'flux-2-pro':
      default:
        return '/flux/v1/flux-2-pro';
    }
  }

  private getModelDisplayName(): string {
    switch (this.modelId) {
      case 'flux-2-flex':
        return 'Flux-2-Flex';
      case 'flux-2-pro':
      default:
        return 'Flux-2-Pro';
    }
  }

  private async pollTask(
    taskId: string,
    resolvedHeaders: Record<string, string | undefined>,
    abortSignal?: AbortSignal,
  ): Promise<Flux2ProResultResponse> {
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
        `${this.config.url({ modelId: this.modelId, path: `/flux/v1/get_result?id=${taskId}` })}`,
        {
          method: 'GET',
          headers: resolvedHeaders as HeadersInit,
          signal: abortSignal,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as Flux2ProResultResponse;

      if (data.status === 'Ready' && data.result) {
        return data;
      }

      if (data.status === 'Failed' || data.status === 'Error') {
        throw new Error(`Task failed with status: ${data.status}`);
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
    const warnings: ImageModelWarning[] = [];

    if (n != null && n > 1) {
      warnings.push({
        type: 'unsupported',
        feature: 'n',
        details: `${this.getModelDisplayName()} generates one image per request`,
      });
    }

    // Handle size and aspect ratio
    let width: number | undefined;
    let height: number | undefined;

    if (size) {
      const parsedSize = this.parseSize(size);
      if (parsedSize) {
        // Validate dimensions: minimum 64px
        const validatedSize = this.validateDimensionsMultipleOf32(
          parsedSize,
          warnings,
          64,
          4096,
        );
        width = validatedSize.width;
        height = validatedSize.height;
      }
    } else if (aspectRatio) {
      // Convert aspect ratio to size with base 1024
      const calculatedSize = this.aspectRatioToSize(aspectRatio, 1024, warnings);
      if (calculatedSize) {
        width = calculatedSize.width;
        height = calculatedSize.height;
      }
    }

    if (size != null && aspectRatio != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'aspectRatio',
        details: 'Both size and aspectRatio provided. Size will be used and aspectRatio will be ignored.',
      });
    }

    // Get additional parameters from providerOptions
    const ai302Options = providerOptions?.ai302 || {};
    const inputImage = ai302Options.input_image as string | undefined;
    const inputImage2 = ai302Options.input_image_2 as string | undefined;
    const inputImage3 = ai302Options.input_image_3 as string | undefined;
    const inputImage4 = ai302Options.input_image_4 as string | undefined;
    const inputImage5 = ai302Options.input_image_5 as string | undefined;
    const inputImage6 = ai302Options.input_image_6 as string | undefined;
    const inputImage7 = ai302Options.input_image_7 as string | undefined;
    const inputImage8 = ai302Options.input_image_8 as string | undefined;
    const safetyTolerance = ai302Options.safety_tolerance as number | undefined;
    const outputFormat = ai302Options.output_format as 'jpeg' | 'png' | undefined;
    const webhookUrl = ai302Options.webhook_url as string | undefined;
    const webhookSecret = ai302Options.webhook_secret as string | undefined;

    const resolvedHeaders = await resolve(this.config.headers());

    const { value: submitResponse, responseHeaders } =
      await postJsonToApi<Flux2ProSubmitResponse>({
        url: this.config.url({
          modelId: this.modelId,
          path: this.getEndpointPath(),
        }),
        headers: combineHeaders(resolvedHeaders, headers),
        body: {
          prompt,
          ...(inputImage !== undefined && { input_image: inputImage }),
          ...(inputImage2 !== undefined && { input_image_2: inputImage2 }),
          ...(inputImage3 !== undefined && { input_image_3: inputImage3 }),
          ...(inputImage4 !== undefined && { input_image_4: inputImage4 }),
          ...(inputImage5 !== undefined && { input_image_5: inputImage5 }),
          ...(inputImage6 !== undefined && { input_image_6: inputImage6 }),
          ...(inputImage7 !== undefined && { input_image_7: inputImage7 }),
          ...(inputImage8 !== undefined && { input_image_8: inputImage8 }),
          ...(seed !== undefined && { seed }),
          ...(width !== undefined && { width }),
          ...(height !== undefined && { height }),
          ...(outputFormat !== undefined && { output_format: outputFormat }),
          ...(webhookUrl !== undefined && { webhook_url: webhookUrl }),
          ...(webhookSecret !== undefined && { webhook_secret: webhookSecret }),
          ...(safetyTolerance !== undefined && {
            safety_tolerance: safetyTolerance,
          }),
        },
        failedResponseHandler: statusCodeErrorResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(),
        abortSignal,
        fetch: this.config.fetch,
      });

    const taskResult = await this.pollTask(submitResponse.id, resolvedHeaders, abortSignal);

    if (!taskResult.result?.sample) {
      throw new Error('No image generated');
    }

    const images = await this.downloadImages([taskResult.result.sample]);

    return {
      images,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: responseHeaders,
      },
    };
  }
}

