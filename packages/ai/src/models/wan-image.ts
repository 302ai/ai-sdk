import type { ImageModelV3CallOptions } from '@ai-sdk/provider';
import { combineHeaders, postJsonToApi, resolve } from '@ai-sdk/provider-utils';
import type {
  Wan26ImageRequest,
  Wan26ImageSubmitResponse,
  Wan26ImageTaskResult,
  Wan26ImageSize,
} from '../ai302-types';
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from '../utils/api-handlers';
import { BaseModelHandler, type ImageModelWarning } from './base-model';

// Supported sizes for Wan2.6-Image (using * instead of x)
const SUPPORTED_SIZES: readonly Wan26ImageSize[] = [
  '1280*1280',
  '1024*1024',
  '800*1200',
  '1200*800',
  '960*1280',
  '1280*960',
  '720*1280',
  '1280*720',
  '1344*576',
] as const;

const POLL_INTERVAL = 3000; // 3 seconds
const MAX_POLL_TIME = 300000; // 5 minutes

export class WanImageHandler extends BaseModelHandler {
  private async pollTask(
    taskId: string,
    resolvedHeaders: Record<string, string | undefined>,
    abortSignal?: AbortSignal,
  ): Promise<Wan26ImageTaskResult> {
    const startTime = Date.now();
    const fetchFn = this.config.fetch || fetch;

    while (true) {
      if (abortSignal?.aborted) {
        throw new Error('Task polling aborted');
      }

      if (Date.now() - startTime > MAX_POLL_TIME) {
        throw new Error('Task polling timed out');
      }

      const response = await fetchFn(
        this.config.url({
          modelId: this.modelId,
          path: `/aliyun/api/v1/tasks/${taskId}`,
        }),
        {
          method: 'GET',
          headers: resolvedHeaders as HeadersInit,
          signal: abortSignal,
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = (await response.json()) as Wan26ImageTaskResult & {
        code?: string;
        message?: string;
        output?: { code?: string; message?: string }
      };
      const taskStatus = data.output?.task_status;

      if (taskStatus === 'FAILED') {
        const errorMsg = data.message || data.output?.message || 'Unknown error';
        throw new Error(`Task failed: ${errorMsg}`);
      }

      if (taskStatus === 'SUCCEEDED') {
        return data;
      }

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
  }

  private convertSizeFormat(size: string): Wan26ImageSize | undefined {
    // Convert "WIDTHxHEIGHT" format to "WIDTH*HEIGHT" format
    const converted = size.replace('x', '*') as Wan26ImageSize;
    if (SUPPORTED_SIZES.includes(converted)) {
      return converted;
    }
    return undefined;
  }

  private findClosestWanSize(
    width: number,
    height: number,
    warnings: ImageModelWarning[],
  ): Wan26ImageSize {
    const targetRatio = width / height;
    let closestSize = SUPPORTED_SIZES[0];
    let minDiff = Infinity;

    for (const sizeStr of SUPPORTED_SIZES) {
      const [w, h] = sizeStr.split('*').map(Number);
      const ratio = w / h;
      const diff = Math.abs(ratio - targetRatio);

      if (diff < minDiff) {
        minDiff = diff;
        closestSize = sizeStr;
      }
    }

    if (closestSize !== `${width}*${height}`) {
      warnings.push({
        type: 'compatibility',
        feature: 'size',
        details: `Size ${width}x${height} converted to closest supported size: ${closestSize}`,
      });
    }

    return closestSize;
  }

  protected async processRequest({
    prompt,
    n,
    size,
    aspectRatio,
    providerOptions,
    headers,
    abortSignal,
  }: ImageModelV3CallOptions) {
    const warnings: ImageModelWarning[] = [];

    // Determine the size
    let wanSize: Wan26ImageSize = '1280*1280'; // default

    if (size) {
      // Try to convert from WIDTHxHEIGHT to WIDTH*HEIGHT
      const converted = this.convertSizeFormat(size);
      if (converted) {
        wanSize = converted;
      } else {
        // Parse and find closest
        const parsedSize = this.parseSize(size);
        if (parsedSize) {
          wanSize = this.findClosestWanSize(
            parsedSize.width,
            parsedSize.height,
            warnings,
          );
        }
      }
    } else if (aspectRatio) {
      // Convert aspect ratio to size
      const parsedSize = this.aspectRatioToSize(aspectRatio, 1280, warnings);
      if (parsedSize) {
        wanSize = this.findClosestWanSize(
          parsedSize.width,
          parsedSize.height,
          warnings,
        );
      }
    }

    // Extract provider options
    const ai302Options = (providerOptions?.ai302 ?? {}) as Record<string, unknown>;

    // Build message content
    const content: Array<{ text?: string; image?: string }> = [
      { text: prompt },
    ];

    // Add images if provided in providerOptions
    const inputImages = ai302Options.images as string[] | undefined;
    const hasInputImages = inputImages && Array.isArray(inputImages) && inputImages.length > 0;

    if (hasInputImages) {
      for (const image of inputImages) {
        content.push({ image });
      }
    }

    // Determine enable_interleave mode
    // - 图像编辑模式 (enable_interleave: false): 必须传入1-3张图像
    // - 图文混排模式 (enable_interleave: true): 可以不传图像或传1张
    // 如果没有传入图像且用户没有明确指定模式，自动切换到图文混排模式
    const userEnableInterleave = ai302Options.enable_interleave as string | undefined;
    const isInterleaveMode = userEnableInterleave === 'true' || (!hasInputImages && userEnableInterleave !== 'false');

    // Build parameters object
    const parameters: Wan26ImageRequest['parameters'] = {
      size: wanSize,
    };

    if (isInterleaveMode) {
      // 图文混排模式：n固定为1，使用max_images控制数量
      parameters.enable_interleave = 'true';
      // max_images 默认5，范围1-5
      const maxImages = ai302Options.max_images as number | undefined;
      parameters.max_images = maxImages ?? Math.min(n ?? 1, 5);
    } else {
      // 图像编辑模式：n范围1-4
      parameters.enable_interleave = 'false';
      if (n != null) {
        parameters.n = Math.min(n, 4);
      }
    }

    // Add other parameters from providerOptions
    if (ai302Options.negative_prompt !== undefined) {
      parameters.negative_prompt = ai302Options.negative_prompt as string;
    }
    if (ai302Options.prompt_extend !== undefined) {
      parameters.prompt_extend = ai302Options.prompt_extend as boolean;
    }
    if (ai302Options.watermark !== undefined) {
      parameters.watermark = ai302Options.watermark as boolean;
    }
    if (ai302Options.seed !== undefined) {
      parameters.seed = ai302Options.seed as number;
    }

    const requestBody: Wan26ImageRequest = {
      model: 'wan2.6-image',
      input: {
        messages: [
          {
            role: 'user',
            content,
          },
        ],
      },
      parameters,
    };

    const resolvedHeaders = await resolve(this.config.headers());

    // Submit the task
    const { value: submitResponse, responseHeaders } =
      await postJsonToApi<Wan26ImageSubmitResponse>({
        url: this.config.url({
          modelId: this.modelId,
          path: '/aliyun/api/v1/services/aigc/image-generation/generation',
        }),
        headers: combineHeaders(resolvedHeaders, headers),
        body: requestBody,
        failedResponseHandler: statusCodeErrorResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(),
        abortSignal,
        fetch: this.config.fetch,
      });

    if (!submitResponse.output?.task_id) {
      throw new Error('No task_id returned from Wan2.6-Image API');
    }

    // Poll for task completion
    const taskResult = await this.pollTask(
      submitResponse.output.task_id,
      resolvedHeaders,
      abortSignal,
    );

    // Extract image URLs from the result
    const imageUrls: string[] = [];
    if (taskResult.output.choices) {
      for (const choice of taskResult.output.choices) {
        if (choice.message?.content) {
          for (const item of choice.message.content) {
            if (item.image) {
              imageUrls.push(item.image);
            }
          }
        }
      }
    }

    if (imageUrls.length === 0) {
      throw new Error('No images returned from Wan2.6-Image API');
    }

    // Download all images
    const images_result = await this.downloadImages(imageUrls);

    return {
      images: images_result,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: responseHeaders,
      },
    };
  }
}

