import type { ImageModelV1CallOptions, ImageModelV1CallWarning } from "@ai-sdk/provider";
import { combineHeaders, postJsonToApi } from "@ai-sdk/provider-utils";
import {
  IdeogramAspectRatioSchema,
  IdeogramResolutionSchema,
  type IdeogramResponse,
} from "../ai302-types";
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from "../utils/api-handlers";
import { BaseModelHandler } from "./base-model";

// Ref 1: https://developer.ideogram.ai/api-reference/api-reference/generate
export class IdeogramHandler extends BaseModelHandler {
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

    if (n != null && n > 1) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'n',
        details: 'Ideogram does not support batch generation',
      });
    }

    const convertedAspectRatio = this.convertToIdeogramAspectRatio(aspectRatio);
    const convertedResolution = this.convertToIdeogramResolution(size);

    if (aspectRatio && !convertedAspectRatio) {
      warnings.push({
        type: "unsupported-setting",
        setting: "aspectRatio",
        details: `Unsupported aspect ratio: ${aspectRatio}. Supported values are: 1:1, 10:16, 16:10, 9:16, 16:9, 3:2, 2:3, 4:3, 3:4, 1:3, 3:1`,
      });
    }

    if (size && !convertedResolution) {
      warnings.push({
        type: "unsupported-setting",
        setting: "size",
        details: `Unsupported resolution: ${size}. Please use one of the supported resolutions (e.g., '1024x1024', '768x1024', etc.)`,
      });
    }

    if (aspectRatio && size) {
      warnings.push({
        type: "unsupported-setting",
        setting: "size",
        details: "Cannot use both aspectRatio and size for ideogram model",
      });
    }


    const { value: response } = await postJsonToApi<IdeogramResponse>({
      url: this.config.url({ modelId: this.modelId, path: "/ideogram/generate" }),
      headers: combineHeaders(this.config.headers(), headers),
      body: {
        image_request: {
          aspect_ratio: convertedAspectRatio,
          model: this.modelId.split("/")[1],
          prompt,
          resolution: convertedResolution,
          seed,
          ...(providerOptions.ai302 ?? {}),
        },
      },
      failedResponseHandler: statusCodeErrorResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(),
      abortSignal,
      fetch: this.config.fetch,
    });

    const urls = response.data.map((img) => img.url).filter(Boolean);
    const images = await this.downloadImages(urls);

    return {
      images,
      warnings,
    };
  }

  private convertToIdeogramAspectRatio(aspectRatio: string | undefined) {
    if (!aspectRatio) return undefined;
    const normalized = `ASPECT_${aspectRatio.replace(":", "_")}`;
    if (IdeogramAspectRatioSchema.safeParse(normalized).success) {
      return normalized;
    }
    return undefined;
  }

  private convertToIdeogramResolution(size: string | undefined) {
    if (!size) return undefined;
    const normalized = `RESOLUTION_${size.replace("x", "_")}`;
    if (IdeogramResolutionSchema.safeParse(normalized).success) {
      return normalized;
    }
    return undefined;
  }
}
