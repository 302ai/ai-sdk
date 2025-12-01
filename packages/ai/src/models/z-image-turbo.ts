import type {
  ImageModelV3CallOptions,
  ImageModelV3CallWarning,
} from '@ai-sdk/provider';
import { combineHeaders, postJsonToApi } from '@ai-sdk/provider-utils';
import type { ZImageTurboResponse } from '../ai302-types';
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from '../utils/api-handlers';
import { BaseModelHandler } from './base-model';

export class ZImageTurboHandler extends BaseModelHandler {
  protected async processRequest({
    prompt,
    n,
    size,
    aspectRatio,
    providerOptions,
    headers,
    abortSignal,
  }: ImageModelV3CallOptions) {
    const warnings: ImageModelV3CallWarning[] = [];

    if (n != null && n > 1) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'n',
        details: 'Z-Image-Turbo generates one image per request',
      });
    }

    // Handle size - default to 1024x1024, min 512, max 2048
    let parsedSize = this.parseSize(size) ||
      this.aspectRatioToSize(aspectRatio, 1024, warnings) || {
        width: 1024,
        height: 1024,
      };

    // Validate dimensions: min 512, max 2048
    if (parsedSize.width < 512 || parsedSize.height < 512) {
      warnings.push({
        type: 'other',
        message: `Minimum size is 512x512. Adjusted from ${parsedSize.width}x${parsedSize.height}`,
      });
      parsedSize = {
        width: Math.max(512, parsedSize.width),
        height: Math.max(512, parsedSize.height),
      };
    }

    if (parsedSize.width > 2048 || parsedSize.height > 2048) {
      warnings.push({
        type: 'other',
        message: `Maximum size is 2048x2048. Adjusted from ${parsedSize.width}x${parsedSize.height}`,
      });
      parsedSize = {
        width: Math.min(2048, parsedSize.width),
        height: Math.min(2048, parsedSize.height),
      };
    }

    if (size != null && aspectRatio != null) {
      warnings.push({
        type: 'other',
        message:
          'Both size and aspectRatio provided. Size will be used and aspectRatio will be ignored.',
      });
    }

    // Get additional parameters from providerOptions
    const ai302Options = providerOptions?.ai302 || {};
    const numInferenceSteps = ai302Options.num_inference_steps as number | undefined;
    const enableSafetyChecker = ai302Options.enable_safety_checker as boolean | undefined;
    const outputFormat = ai302Options.output_format as 'png' | 'jpg' | 'webp' | undefined;

    const { value: response, responseHeaders } = await postJsonToApi<ZImageTurboResponse>({
      url: this.config.url({
        modelId: this.modelId,
        path: '/302/submit/z-image-turbo',
      }),
      headers: combineHeaders(this.config.headers(), headers),
      body: {
        prompt,
        image_size: {
          width: parsedSize.width,
          height: parsedSize.height,
        },
        ...(numInferenceSteps !== undefined && { num_inference_steps: numInferenceSteps }),
        ...(enableSafetyChecker !== undefined && { enable_safety_checker: enableSafetyChecker }),
        ...(outputFormat !== undefined && { output_format: outputFormat }),
      },
      failedResponseHandler: statusCodeErrorResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(),
      abortSignal,
      fetch: this.config.fetch,
    });

    const urls = response.images.map(img => img.url).filter(Boolean);
    const images = await this.downloadImages(urls);

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

