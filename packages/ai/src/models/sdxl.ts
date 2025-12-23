import type { ImageModelV3CallOptions } from "@ai-sdk/provider";
import { combineHeaders, postToApi, resolve } from "@ai-sdk/provider-utils";
import type { SDXLResponse } from "../ai302-types";
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from "../utils/api-handlers";
import { BaseModelHandler, type ImageModelWarning } from "./base-model";

const SUPPORTED_SIZES = [
  "1024x1024",
  "1024x2048",
  "1536x1024",
  "1536x2048",
  "2048x1152",
  "1152x2048",
];

export class SDXLHandler extends BaseModelHandler {
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
      warnings.push({ type: 'unsupported', feature: 'n', details: 'SDXL does not support batch generation' });
    }

    if (seed != null) {
      warnings.push({ type: 'unsupported', feature: 'seed' });
    }

    let parsedSize =
    this.parseSize(size) || this.aspectRatioToSize(aspectRatio, 1024, warnings) || { width: 1024, height: 1024 };

    parsedSize = this.validateSizeOption(parsedSize, SUPPORTED_SIZES, warnings);

    if (!prompt) {
      throw new Error('Prompt is required for SDXL');
    }

    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("width", parsedSize.width.toString());
    formData.append("height", parsedSize.height.toString());

    for (const [key, value] of Object.entries(providerOptions)) {
      if (key.startsWith("302ai")) {
        formData.append(key, value.toString());
      }
    }

    const resolvedHeaders = await resolve(this.config.headers());

    const { value: response, responseHeaders } = await postToApi<SDXLResponse>({
      url: this.config.url({ modelId: this.modelId, path: '/302/submit/sdxl' }),
      headers: combineHeaders(resolvedHeaders, headers),
      body: {
        content: formData,
        values: {
          prompt,
          width: parsedSize.width.toString(),
          height: parsedSize.height.toString(),
          ...(providerOptions.ai302 ?? {}),
        },
      },
      failedResponseHandler: statusCodeErrorResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(),
      abortSignal,
      fetch: this.config.fetch,
    });

    if (response.status === "failed" || response.error) {
      throw new Error(
        `SDXL generation failed: ${response.error || "Unknown error"}`,
      );
    }

    const urls = JSON.parse(response.output) as string[];
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
