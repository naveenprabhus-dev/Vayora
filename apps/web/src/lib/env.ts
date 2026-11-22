export interface PublicWebEnv {
  readonly apiBaseUrl: string;
}

export function getPublicWebEnv(): PublicWebEnv {
  const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const apiBaseUrl =
    typeof rawBaseUrl === 'string' && rawBaseUrl.trim().length > 0
      ? rawBaseUrl.trim().replace(/\/+$/, '')
      : '/api/v1';

  return {
    apiBaseUrl,
  };
}
