import type {
  ImageModelV3CallOptions,
  ImageModelV3CallWarning,
} from '@ai-sdk/provider';
import { combineHeaders, postJsonToApi, resolve } from '@ai-sdk/provider-utils';
import {
  type LumaPhotonResponse,
} from '../ai302-types';
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from '../utils/api-handlers';
import { BaseModelHandler } from './base-model';

const SUPPORTED_ASPECT_RATIOS = [
  '1:1',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
  '9:21',
  '21:9',
] as const;

// Ref 1: https://docs.lumalabs.ai/reference/generateimage
export class LumaPhotonHandler extends BaseModelHandler {
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
      warnings.push({ type: 'unsupported-setting', setting: 'n', details: 'Luma Photon does not support batch generation' });
    }

    if (size != null) {
      warnings.push({ type: 'unsupported-setting', setting: 'size' });
    }

    if (seed != null) {
      warnings.push({ type: 'unsupported-setting', setting: 'seed' });
    }

    let parsedAspectRatio = this.findClosestAspectRatio(aspectRatio, SUPPORTED_ASPECT_RATIOS, warnings);

    const resolvedHeaders = await resolve(this.config.headers());

    const { value: response, responseHeaders } = await postJsonToApi<LumaPhotonResponse>({
      url: this.config.url({ modelId: this.modelId, path: '/302/submit/luma-photon' }),
      headers: combineHeaders(resolvedHeaders, headers),
      body: {
        prompt,
        model: this.modelId,
        aspect_ratio: parsedAspectRatio,
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
