import type { ImageModelV1CallOptions, ImageModelV1CallWarning } from '@ai-sdk/provider';
import { combineHeaders, postJsonToApi } from '@ai-sdk/provider-utils';
import { BaseModelHandler } from './base-model';
import { createJsonResponseHandler, statusCodeErrorResponseHandler } from '../utils/api-handlers';
import type { OmnigenResponse } from '../ai302-types';

export class HidreamHandler extends BaseModelHandler {
  protected async processRequest({
    prompt,
    n,
    size,
    aspectRatio,
    seed,
    providerOptions,
    headers,
    abortSignal,
  }: ImageModelV1CallOptions) {
    const warnings: ImageModelV1CallWarning[] = [];

    if (n != null && n > 1) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'n',
        details: 'Hidream does not support batch generation',
      });
    }

    let parsedSize = this.parseSize(size);
    if (!parsedSize && aspectRatio) {
      parsedSize = this.aspectRatioToSize(aspectRatio, 1024, warnings);
    }

    if (parsedSize) {
      parsedSize = this.validateDimensionsMultipleOf32(parsedSize, warnings);
    }

    const { value: response, responseHeaders } = await postJsonToApi<OmnigenResponse>({
      url: this.config.url({ modelId: this.modelId, path: `/302/submit/${this.modelId}` }),
      headers: combineHeaders(this.config.headers(), headers),
      body: {
        prompt,
        image_size: parsedSize,
        seed,
        ...(providerOptions.ai302 ?? {}),
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
