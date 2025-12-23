import type {
  ImageModelV3CallOptions,
  
} from '@ai-sdk/provider';
import { combineHeaders, postToApi, resolve } from '@ai-sdk/provider-utils';
import type { AuraflowResponse } from '../ai302-types';
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from '../utils/api-handlers';
import { BaseModelHandler, type ImageModelWarning } from './base-model';

export class AuraflowHandler extends BaseModelHandler {
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
        details: 'AuraFlow does not support batch generation',
      });
    }

    if (size != null) {
      warnings.push({ type: 'unsupported', feature: 'size' });
    }

    if (aspectRatio != null) {
      warnings.push({ type: 'unsupported', feature: 'aspectRatio' });
    }

    if (seed != null) {
      warnings.push({ type: 'unsupported', feature: 'seed' });
    }

    if (providerOptions.ai302 != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'providerOptions',
      });
    }

    if (!prompt) {
      throw new Error('Prompt is required for AuraFlow');
    }

    const formData = new FormData();
    formData.append('prompt', prompt);

    const resolvedHeaders = await resolve(this.config.headers());

    const { value: response, responseHeaders } =
      await postToApi<AuraflowResponse>({
        url: this.config.url({
          modelId: this.modelId,
          path: '/302/submit/aura-flow',
        }),
        headers: combineHeaders(resolvedHeaders, headers),
        body: {
          content: formData,
          values: { prompt },
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
