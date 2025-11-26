import type { ImageModelV3 } from "@ai-sdk/provider";
import type { AI302ImageModelId, AI302ImageSettings } from "./ai302-image-settings";
import { createImageModelHandler } from "./models/model-factory";
import { AI302Config } from "./ai302-config";

export class AI302ImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3";
  private modelHandler;

  get provider(): string {
    return this.config.provider;
  }

  get maxImagesPerCall(): number {
    return 1;
  }

  constructor(
    readonly modelId: AI302ImageModelId,
    readonly settings: AI302ImageSettings = {},
    readonly config: AI302Config,
  ) {
    this.modelHandler = createImageModelHandler(modelId, settings, config);
  }

  async doGenerate(
    params: Parameters<ImageModelV3["doGenerate"]>[0],
  ): Promise<Awaited<ReturnType<ImageModelV3["doGenerate"]>>> {
    return this.modelHandler.handleRequest(params);
  }
}
