import type { ImageModelV3CallOptions, ImageModelV3CallWarning } from '@ai-sdk/provider';
import { combineHeaders, postJsonToApi, resolve } from '@ai-sdk/provider-utils';
import type { OmnigenResponse } from '../ai302-types';
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from '../utils/api-handlers';
import { BaseModelHandler } from './base-model';

export class OmnigenHandler extends BaseModelHandler {
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

    if (n != null && n > 1) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'n',
        details: 'Omnigen V1 does not support batch generation',
      });
    }

    let parsedSize = this.parseSize(size);
    if (!parsedSize && aspectRatio) {
      parsedSize = this.aspectRatioToSize(aspectRatio, 1024, warnings);
    }

    if (parsedSize) {
      parsedSize = this.validateDimensionsMultipleOf32(parsedSize, warnings);
    }

    const resolvedHeaders = await resolve(this.config.headers());

    const { value: response, responseHeaders } = await postJsonToApi<OmnigenResponse>({
      url: this.config.url({ modelId: this.modelId, path: '/302/submit/omnigen-v1' }),
      headers: combineHeaders(resolvedHeaders, headers),
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
