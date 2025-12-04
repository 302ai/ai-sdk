import type { ImageModelV3CallOptions, ImageModelV3CallWarning } from '@ai-sdk/provider';
import { combineHeaders, postJsonToApi, resolve } from '@ai-sdk/provider-utils';
import type { IRAGResponse } from '../ai302-types';
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from '../utils/api-handlers';
import { BaseModelHandler } from './base-model';

export class IRAGHandler extends BaseModelHandler {
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
        details: 'iRAG V1 does not support batch generation',
      });
    }

    if (size != null) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'size',
        details: 'iRAG V1 does not support custom image size',
      });
    }

    if (aspectRatio != null) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'aspectRatio',
        details: 'iRAG V1 does not support custom aspect ratio',
      });
    }

    if (seed != null) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'seed',
        details: 'iRAG V1 does not support seed control',
      });
    }

    const resolvedHeaders = await resolve(this.config.headers());

    const { value: response, responseHeaders } = await postJsonToApi<IRAGResponse>({
      url: this.config.url({ modelId: this.modelId, path: '/baidubce/v2/images/generations' }),
      headers: combineHeaders(resolvedHeaders, headers),
      body: {
        model: 'irag-1.0',
        prompt,
        ...(providerOptions.ai302 ?? {}),
      },
      failedResponseHandler: statusCodeErrorResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(),
      abortSignal,
      fetch: this.config.fetch,
    });

    const urls = response.data.map((img: { url: string }) => img.url).filter(Boolean);
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
