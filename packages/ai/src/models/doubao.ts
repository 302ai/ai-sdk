import type { ImageModelV3CallOptions } from '@ai-sdk/provider';
import { combineHeaders, postJsonToApi, resolve } from '@ai-sdk/provider-utils';
import { BaseModelHandler, type ImageModelWarning } from './base-model';
import { createJsonResponseHandler, statusCodeErrorResponseHandler } from '../utils/api-handlers';

// Define the types based on the provided API documentation
export interface DoubaoLogoInfo {
  add_logo?: boolean;
  language?: number;
  logo_text_content?: string;
  opacity?: number;
  position?: number;
  [property: string]: any;
}

export enum DoubaoModelVersion {
  GeneralV20 = 'general_v2.0',
  GeneralV20_L = 'general_v2.0_L',
  GeneralV21_L = 'general_v2.1_L',
  GeneralV30 = 'general_v3.0',
}

export enum DoubaoReqScheduleConf {
  GeneralV209BRephraser = 'general_v20_9B_rephraser',
  GeneralV209Bpe = 'general_v20_9B_pe',
  GeneralV30 = 'general_v3.0',
}

export interface DoubaoRequest {
  ddim_steps?: number;
  height?: number;
  is_only_sr?: boolean;
  llm_seed?: string;
  logo_info?: DoubaoLogoInfo;
  model_version?: DoubaoModelVersion;
  prompt: string;
  req_schedule_conf?: DoubaoReqScheduleConf;
  return_url?: boolean;
  scale?: number;
  seed?: number;
  sr_scale?: number;
  sr_seed?: number;
  sr_steps?: number;
  sr_strength?: number;
  use_pre_llm?: boolean;
  use_sr?: boolean;
  width?: number;
  [property: string]: any;
}

interface DoubaoResponse {
  code: number;
  data: {
    image_urls: string[];
    request_id: string;
  };
  details: string;
  status: number;
  time_elapsed: string;
}

export class DoubaoHandler extends BaseModelHandler {
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
        details: 'Doubao does not support batch generation',
      });
    }

    let parsedSize = this.parseSize(size);
    // If size is not provided, try to calculate from aspect ratio
    if (!parsedSize && aspectRatio) {
        parsedSize = this.aspectRatioToSize(aspectRatio, 1024, warnings);
    }


    const doubaoModelVersion = this.mapModelIdToVersion(this.modelId);
    const doubaoReqScheduleConf = this.mapModelIdToReqScheduleConf(this.modelId);

    const requestBody: DoubaoRequest = {
      prompt,
      model_version: doubaoModelVersion,
      return_url: true, // Always request URLs
      seed,
      width: parsedSize?.width,
      height: parsedSize?.height,
      ...(providerOptions.ai302 ?? {}), // Allow overriding defaults
    };

    // Conditionally add req_schedule_conf
    if (this.modelId !== 'doubao-general-v2.0' && this.modelId !== 'doubao-general-v3.0') {
      requestBody.req_schedule_conf = doubaoReqScheduleConf;
    }

    const resolvedHeaders = await resolve(this.config.headers());

    const { value: response, responseHeaders } = await postJsonToApi<DoubaoResponse>({
      url: this.config.url({ modelId: this.modelId, path: '/doubao/drawing' }),
      headers: combineHeaders(resolvedHeaders, headers),
      body: requestBody,
      failedResponseHandler: statusCodeErrorResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(),
      abortSignal,
      fetch: this.config.fetch,
    });

    if (response.code !== 10000 && response.status !== 10000) {
      throw new Error(`Doubao API error: ${response.details} (code: ${response.code}, status: ${response.status})`);
    }

    const urls = response.data.image_urls;
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

    protected mapModelIdToVersion(modelId: string): DoubaoModelVersion {
      switch (modelId) {
        case 'doubao-general-v3.0':
          return DoubaoModelVersion.GeneralV30;
        case 'doubao-general-v2.1-l':
          return DoubaoModelVersion.GeneralV21_L;
        case 'doubao-general-v2.0-l':
          return DoubaoModelVersion.GeneralV20_L;
        case 'doubao-general-v2.0':
          return DoubaoModelVersion.GeneralV20;
        default:
          throw new Error(`Unsupported Doubao model: ${modelId}`);
      }
    }

    protected mapModelIdToReqScheduleConf(modelId: string): DoubaoReqScheduleConf {
      // Default to 'general_v20_9B_pe' as per documentation
      return DoubaoReqScheduleConf.GeneralV209Bpe;
    }
}
