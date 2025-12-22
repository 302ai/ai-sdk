import type { ImageModelV3CallOptions } from "@ai-sdk/provider";
import { combineHeaders, postJsonToApi, resolve } from "@ai-sdk/provider-utils";
import type { BagelResponse } from "../ai302-types";
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from "../utils/api-handlers";
import { BaseModelHandler, type ImageModelWarning } from "./base-model";

export class BagelHandler extends BaseModelHandler {
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
      warnings.push({ type: 'unsupported', feature: 'n', details: 'Bagel does not support batch generation' });
    }

    if (size != null) {
      warnings.push({ type: 'unsupported', feature: 'size', details: 'Bagel does not support custom size' });
    }

    if (aspectRatio != null) {
      warnings.push({ type: 'unsupported', feature: 'aspectRatio', details: 'Bagel does not support custom aspect ratio' });
    }

    if (seed != null) {
      warnings.push({ type: 'unsupported', feature: 'seed', details: 'Bagel does not support custom seed' });
    }

    const resolvedHeaders = await resolve(this.config.headers());

    const { value: response, responseHeaders } = await postJsonToApi<BagelResponse>({
      url: this.config.url({ modelId: this.modelId, path: '/302/submit/bagel' }),
      headers: combineHeaders(resolvedHeaders, headers),
      body: {
        prompt,
        use_thought: providerOptions.ai302?.use_thought ?? false,
        ...(providerOptions.ai302 ?? {}),
      },
      failedResponseHandler: statusCodeErrorResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(),
      abortSignal,
      fetch: this.config.fetch,
    });

    const urls = response.images.map((img) => img.url).filter(Boolean);
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
