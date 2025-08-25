import type {
  ImageModelV1CallOptions,
  ImageModelV1CallWarning,
} from '@ai-sdk/provider';
import { combineHeaders, postJsonToApi } from '@ai-sdk/provider-utils';
import type { DoubaoSeedreamResponse } from '../ai302-types';
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from '../utils/api-handlers';
import { BaseModelHandler } from './base-model';

export class DoubaoSeedreamHandler extends BaseModelHandler {
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
        details: 'Doubao Seedream does not support batch generation',
      });
    }

    if (aspectRatio != null) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'aspectRatio',
        details: 'Doubao Seedream uses size parameter instead of aspectRatio',
      });
    }

    // Parse size or use default
    const parsedSize = this.parseSize(size);
    let sizeStr = '1024x1024';
    
    if (parsedSize) {
      // Validate size is within [512x512, 2048x2048]
      const { width, height } = parsedSize;
      if (width < 512 || height < 512 || width > 2048 || height > 2048) {
        warnings.push({
          type: 'other',
          message: `Size ${width}x${height} is outside allowed range [512x512, 2048x2048]. Using default 1024x1024.`,
        });
      } else {
        sizeStr = `${width}x${height}`;
      }
    }

    const { value: response, responseHeaders } = await postJsonToApi<DoubaoSeedreamResponse>({
      url: this.config.url({
        modelId: this.modelId,
        path: '/doubao/images/generations',
      }),
      headers: combineHeaders(this.config.headers(), headers),
      body: {
        model: this.modelId,
        prompt,
        response_format: 'url',
        size: sizeStr,
        seed,
        guidance_scale: providerOptions.ai302?.guidance_scale,
        watermark: providerOptions.ai302?.watermark || false,
        ...(providerOptions.ai302 ?? {}),
      },
      failedResponseHandler: statusCodeErrorResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(),
      abortSignal,
      fetch: this.config.fetch,
    });

    const urls = response.data.map(item => item.url).filter(Boolean) as string[];
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