import type { ImageModelV3CallOptions } from '@ai-sdk/provider';
import { combineHeaders, postJsonToApi, resolve } from '@ai-sdk/provider-utils';
import { BaseModelHandler, type ImageModelWarning } from './base-model';
import { createJsonResponseHandler, statusCodeErrorResponseHandler } from '../utils/api-handlers';

const SUPPORTED_ASPECT_RATIOS = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
] as const;

interface Gemini3ProImagePreviewApiRequest {
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
  }>;
  generationConfig: {
    responseModalities: string[];
    imageConfig: {
      aspect_ratio: string;
    };
  };
}

interface Gemini3ProImagePreviewApiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string;
        url?: string;
      }>;
      role: string;
    };
    finishReason: string;
  }>;
  modelVersion: string;
  responseId: string;
  usageMetadata: {
    candidatesTokenCount: number;
    candidatesTokensDetails: Array<{
      modality: string;
      tokenCount: number;
    }>;
    promptTokenCount: number;
    promptTokensDetails: Array<{
      modality: string;
      tokenCount: number;
    }>;
    totalTokenCount: number;
  };
}

export class Gemini3ProImagePreviewHandler extends BaseModelHandler {
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
        details: 'Gemini 3 Pro Image Preview does not support batch generation',
      });
    }

    if (size != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'size',
        details: 'Gemini 3 Pro Image Preview uses aspect_ratio instead of size',
      });
    }

    if (seed != null) {
      warnings.push({
        type: 'unsupported',
        feature: 'seed',
        details: 'Gemini 3 Pro Image Preview does not support seed control',
      });
    }

    // Find closest aspect ratio, default to '4:3'
    const parsedAspectRatio = this.findClosestAspectRatio(
      aspectRatio,
      SUPPORTED_ASPECT_RATIOS,
      warnings
    ) || '4:3';

    if (!prompt) {
      throw new Error('Prompt is required for Gemini 3 Pro Image Preview');
    }

    const requestBody: Gemini3ProImagePreviewApiRequest = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspect_ratio: parsedAspectRatio,
        },
      },
    };

    const baseUrl = this.config.url({
      modelId: this.modelId,
      path: '/google/v1/models/gemini-3-pro-image-preview'
    });
    const urlWithQuery = `${baseUrl}?response_format=url`;

    const resolvedHeaders = await resolve(this.config.headers());

    const { value: response, responseHeaders } = await postJsonToApi<Gemini3ProImagePreviewApiResponse>({
      url: urlWithQuery,
      headers: combineHeaders(resolvedHeaders, headers),
      body: {
        ...requestBody,
        ...(providerOptions.ai302 ?? {}),
      },
      failedResponseHandler: statusCodeErrorResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(),
      abortSignal,
      fetch: this.config.fetch,
    });

    // Validate response structure
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('Invalid response structure from Gemini 3 Pro Image Preview API: missing candidates.');
    }

    const candidate = response.candidates[0];
    if (!candidate.content || !candidate.content.parts) {
      throw new Error('Invalid response structure from Gemini 3 Pro Image Preview API: missing content parts.');
    }

    // Find the URL part in the response
    const urlPart = candidate.content.parts.find(part => part.url);
    if (!urlPart || !urlPart.url) {
      throw new Error('Invalid response structure from Gemini 3 Pro Image Preview API: missing image URL.');
    }

    const imageUrl = urlPart.url;
    const images = await this.downloadImages([imageUrl]);

    const modelResponse = {
      timestamp: new Date(),
      modelId: this.modelId,
      headers: responseHeaders,
    };

    return {
      images,
      warnings,
      response: modelResponse,
    };
  }
}

