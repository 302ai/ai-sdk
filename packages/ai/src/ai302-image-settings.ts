export type AI302ImageModelId =
  | 'flux-v1.1-ultra'
  | 'flux-pro-v1.1'
  | 'flux-pro'
  | 'flux-dev'
  | 'flux-schnell'
  | 'ideogram/V_1'
  | 'ideogram/V_1_TURBO'
  | 'ideogram/V_2'
  | 'ideogram/V_2_TURBO'
  | 'dall-e-3'
  | 'recraftv3'
  | 'recraftv2'
  | 'sdxl-lightning'
  | 'sdxl-lightning-v2'
  | 'sdxl-lightning-v3'
  | 'kolors'
  | 'aura-flow'
  | 'photon-1'
  | 'photon-flash-1'
  | 'sdxl'
  | 'sd3-ultra'
  | 'sd3v2'
  | 'sd3.5-large'
  | 'sd3.5-large-turbo'
  | 'sd3.5-medium'
  | 'midjourney/6.0'
  | 'midjourney/6.1'
  | 'nijijourney/6.0'
  | 'google-imagen-3'
  | 'google-imagen-3-fast'
  | 'doubao-general-v2.1-l'
  | 'doubao-general-v2.0-l'
  | 'doubao-general-v2.0'
  | 'lumina-image-v2'
  | (string & {});

export interface AI302ImageSettings {

}

interface AI302ImageModelBackendConfig {
  supportsSize?: boolean;
}

export const modelToBackendConfig: Partial<
  Record<AI302ImageModelId, AI302ImageModelBackendConfig>
> = {
  'flux-v1.1-ultra': {
    supportsSize: false,
  },
  'flux-pro-v1.1': {
    supportsSize: true,
  },
  'flux-pro': {
    supportsSize: true,
  },
  'flux-dev': {
    supportsSize: true,
  },
  'flux-schnell': {
    supportsSize: true,
  },
  'ideogram/V_1': {
    supportsSize: true,
  },
  'ideogram/V_1_TURBO': {
    supportsSize: true,
  },
  'ideogram/V_2': {
    supportsSize: true,
  },
  'ideogram/V_2_TURBO': {
    supportsSize: true,
  },
  'dall-e-3': {
    supportsSize: true,
  },
  'recraftv3': {
    supportsSize: true,
  },
  'recraftv2': {
    supportsSize: true,
  },
  'sdxl-lightning': {
    supportsSize: true,
  },
  'sdxl-lightning-v2': {
    supportsSize: true,
  },
  'sdxl-lightning-v3': {
    supportsSize: true,
  },
  'kolors': {
    supportsSize: true,
  },
  'aura-flow': {
    supportsSize: true,
  },
  'luma-photon': {
    supportsSize: true,
  },
  'sdxl': {
    supportsSize: true,
  },
  'sd3-ultra': {
    supportsSize: false
  },
  'sd3v2': {
    supportsSize: true,
  },
  'sd3.5-large': {
    supportsSize: true,
  },
  'sd3.5-large-turbo': {
    supportsSize: true,
  },
  'sd3.5-medium': {
    supportsSize: true,
  },
  'midjourney/6.0': {
    supportsSize: false,
  },
  'midjourney/6.1': {
    supportsSize: false,
  },
  'nijijourney/6.0': {
    supportsSize: false,
  },
  'google-imagen-3': {
    supportsSize: true,
  },
  'google-imagen-3-fast': {
    supportsSize: true,
  },
  'doubao-general-v2.1-l': {
    supportsSize: true,
  },
  'doubao-general-v2.0-l': {
    supportsSize: true,
  },
  'doubao-general-v2.0': {
    supportsSize: true,
  },
  'lumina-image-v2': {
    supportsSize: true,
  },
}
