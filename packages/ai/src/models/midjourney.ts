import type { ImageModelV1CallOptions, ImageModelV1CallWarning } from "@ai-sdk/provider";
import { combineHeaders, postJsonToApi } from "@ai-sdk/provider-utils";
import {
  type MidjourneySubmitResponse,
  type MidjourneyTaskResponse,
} from "../ai302-types";
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from "../utils/api-handlers";
import { BaseModelHandler } from "./base-model";

const SUPPORTED_ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "2:3",
  "3:2",
  "4:5",
  "5:4",
] as const;
const POLL_INTERVAL = 2000; // 2 seconds
const MAX_POLL_TIME = 300000; // 5 minutes


// Ref 1: https://302ai.apifox.cn/api-160578879
export class MidjourneyHandler extends BaseModelHandler {
  private getVersionFlag(): string {
    switch (this.modelId) {
      case 'midjourney/6.0':
        return '--v 6.0';
      case 'midjourney/6.1':
        return '--v 6.1';
      case 'nijijourney/6.0':
        return '--niji 6';
      default:
        return '--v 6.0';
    }
  }

  private getBotType(): string {
    return this.modelId.startsWith('nijijourney') ? 'NIJI_JOURNEY' : 'MID_JOURNEY';
  }

  private async pollTask(
    taskId: string,
    abortSignal?: AbortSignal,
  ): Promise<MidjourneyTaskResponse> {
    const startTime = Date.now();
    const fetchFn = this.config.fetch || fetch;

    while (true) {
      if (abortSignal?.aborted) {
        throw new Error("Task polling aborted");
      }

      if (Date.now() - startTime > MAX_POLL_TIME) {
        throw new Error("Task polling timed out");
      }

      const response = await fetchFn(
        `${this.config.url({ modelId: this.modelId, path: `/mj/task/${taskId}/fetch` })}`,
        {
          method: "GET",
          headers: this.config.headers() as HeadersInit,
          signal: abortSignal,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as MidjourneyTaskResponse;

      if (data.status === "FAILED") {
        throw new Error(`Task failed: ${data.failReason || "Unknown error"}`);
      }

      if (data.status === "SUCCESS") {
        return data;
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  private async upscaleImage(
    taskId: string,
    response: MidjourneyTaskResponse,
    abortSignal?: AbortSignal,
    buttonIndex: number = 1,
  ): Promise<MidjourneyTaskResponse> {
    const upscaleButton = response.buttons.find((b) => b.label === `U${buttonIndex}`);
    if (!upscaleButton) {
      throw new Error(`No upscale option available for U${buttonIndex}`);
    }

    const { value: actionResponse } =
      await postJsonToApi<MidjourneySubmitResponse>({
        url: this.config.url({ modelId: this.modelId, path: `/mj/submit/action` }),
        headers: this.config.headers(),
        body: {
          customId: upscaleButton.customId,
          taskId: taskId,
        },
        failedResponseHandler: statusCodeErrorResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(),
        abortSignal,
        fetch: this.config.fetch,
      });

    return await this.pollTask(actionResponse.result, abortSignal);
  }

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

    if (n != null && n > 4) {
      warnings.push({ type: 'unsupported-setting', setting: 'n', details: 'Midjourney supports up to 4 images per generation' });
    }

    if (size != null) {
      warnings.push({ type: 'unsupported-setting', setting: 'size' });
    }

    if (aspectRatio) {
      if (!SUPPORTED_ASPECT_RATIOS.includes(aspectRatio as any)) {
        warnings.push({
          type: "unsupported-setting",
          setting: "aspectRatio",
          details: `Unsupported aspect ratio: ${aspectRatio}. Supported values are: ${SUPPORTED_ASPECT_RATIOS.join(", ")}`,
        });
      } else {
        prompt = `${prompt} --ar ${aspectRatio}`;
      }
    }

    if (seed != null) {
      prompt = `${prompt} --seed ${seed}`;
    }

    prompt = `${prompt} ${this.getVersionFlag()}`;

    const { value: submitResponse } =
      await postJsonToApi<MidjourneySubmitResponse>({
        url: this.config.url({ modelId: this.modelId, path: `/mj/submit/imagine` }),
        headers: combineHeaders(this.config.headers(), headers),
        body: {
          prompt,
          botType: this.getBotType(),
          ...(providerOptions.ai302 || {}),
        },
        failedResponseHandler: statusCodeErrorResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(),
        abortSignal,
        fetch: this.config.fetch,
      });

    const initialResult = await this.pollTask(
      submitResponse.result,
      abortSignal,
    );

    const numImages = Math.min(n || 1, 4);

    const upscalePromises = Array.from({ length: numImages }, (_, index) => {
      return this.upscaleImage(submitResponse.result, initialResult, abortSignal, index + 1);
    });

    const finalResults = await Promise.all(upscalePromises);
    const imageUrls = finalResults.map(result => {
      if (!result.imageUrl) {
        throw new Error("No image URL in the response");
      }
      return result.imageUrl;
    });

    const images = await this.downloadImages(imageUrls);

    return {
      images,
      warnings,
    };
  }
}
