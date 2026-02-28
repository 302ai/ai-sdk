import type { ImageModelV3CallOptions } from '@ai-sdk/provider';
import { combineHeaders, postJsonToApi, resolve } from '@ai-sdk/provider-utils';
import type { DoubaoSeedreamResponse } from '../ai302-types';
import {
  createJsonResponseHandler,
  statusCodeErrorResponseHandler,
} from '../utils/api-handlers';
import { BaseModelHandler, type ImageModelWarning } from './base-model';

export class Seedream5Handler extends BaseModelHandler {
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
        details: 'Seedream 5.0 does not support batch generation',
      });
    }

    if (aspectRatio != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'aspectRatio',
        details: 'Seedream 5.0 uses size parameter instead of aspectRatio',
      });
    }

    const sizeStr = this.handleSizeParameter(size, warnings);

    const requestBody: any = {
      model: this.modelId,
      prompt,
      response_format: 'url',
      size: sizeStr,
      seed,
      watermark: providerOptions.ai302?.watermark || false,
      ...(providerOptions.ai302 ?? {}),
    };

    const resolvedHeaders = await resolve(this.config.headers());

    const { value: response, responseHeaders } =
      await postJsonToApi<DoubaoSeedreamResponse>({
        url: this.config.url({
          modelId: this.modelId,
          path: '/doubao/images/generations',
        }),
        headers: combineHeaders(resolvedHeaders, headers),
        body: requestBody,
        failedResponseHandler: statusCodeErrorResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(),
        abortSignal,
        fetch: this.config.fetch,
      });

    const urls = response.data
      .map(item => item.url)
      .filter(Boolean) as string[];
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

  private handleSizeParameter(
    size: string | undefined,
    warnings: ImageModelWarning[],
  ): string {
    if (!size) {
      return '2K';
    }

    const qualityLevels = ['1K', '2K', '4K', '1k', '2k', '4k'];
    if (qualityLevels.includes(size)) {
      return size.toUpperCase();
    }

    const parsedSize = this.parseSize(size);
    if (parsedSize) {
      const { width, height } = parsedSize;
      const totalPixels = width * height;

      const supportedSizes = [
        '1024x1024',
        '1152x864',
        '864x1152',
        '1280x720',
        '720x1280',
        '1248x832',
        '832x1248',
        '1512x648',
        '2048x2048',
        '2304x1728',
        '1728x2304',
        '2560x1440',
        '1440x2560',
        '2496x1664',
        '1664x2496',
        '3024x1296',
        '4096x4096',
        '4736x3552',
        '3552x4736',
        '5472x2072',
        '2072x5472',
        '5024x3360',
        '3360x5024',
        '6272x2688',
      ];

      const sizeStr = `${width}x${height}`;
      if (supportedSizes.includes(sizeStr)) {
        return sizeStr;
      }

      if (totalPixels >= 10000000) {
        warnings.push({
          type: 'compatibility',
          feature: 'size',
          details: `Size ${sizeStr} mapped to 4K for Seedream 5.0.`,
        });
        return '4K';
      } else if (totalPixels >= 3686400) {
        warnings.push({
          type: 'compatibility',
          feature: 'size',
          details: `Size ${sizeStr} mapped to 2K for Seedream 5.0 (minimum 3,686,400 pixels required).`,
        });
        return '2K';
      } else {
        warnings.push({
          type: 'compatibility',
          feature: 'size',
          details: `Size ${sizeStr} mapped to 2K for Seedream 5.0 (minimum 3,686,400 pixels required).`,
        });
        return '2K';
      }
    }

    warnings.push({
      type: 'unsupported',
      feature: 'size',
      details: `Invalid size format: ${size}. Using default 2K.`,
    });
    return '2K';
  }
}
