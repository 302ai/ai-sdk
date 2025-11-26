import { FetchFunction, Resolvable } from '@ai-sdk/provider-utils';

export type AI302Config = {
  provider: string;
  url: (options: { modelId: string; path: string }) => string;
  headers: () => Resolvable<Record<string, string | undefined>>;
  fetch?: FetchFunction;
};
