import type { ImageModelV1CallOptions, ImageModelV1CallWarning } from "@ai-sdk/provider";
import { combineHeaders, postJsonToApi } from "@ai-sdk/provider-utils";
import type { KolorsResponse } from "../ai302-types";
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from "../utils/api-handlers";
import { BaseModelHandler } from "./base-model";

// Ref 1: https://fal.ai/models/fal-ai/kolors/api
export class KolorsHandler extends BaseModelHandler {
  protected async processRequest({
    prompt,
    n,
    size,
    aspectRatio,
    seed,
    providerOptions,
    headers,
    abortSignal,
  }: ImageModelV1CallOptions): Promise<{
    images: string[];
    warnings: ImageModelV1CallWarning[];
  }> {
    const warnings: ImageModelV1CallWarning[] = [];

    let parsedSize =
      this.parseSize(size) || this.aspectRatioToSize(aspectRatio, 1024, warnings) || { width: 1024, height: 1024 };

    const { value: response } = await postJsonToApi<KolorsResponse>({
      url: this.config.url({ modelId: this.modelId, path: "/302/submit/kolors" }),
      headers: combineHeaders(this.config.headers(), headers),
      body: {
        prompt,
        image_size: parsedSize,
        seed,
        num_images: n,
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
    };
  }
}
