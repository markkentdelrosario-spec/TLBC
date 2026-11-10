const apiUrl = import.meta.env.VITE_API_URL?.trim();
const legacyApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

function normalizeApiUrl(url) {
  const baseUrl = (/^https?:\/\//i.test(url) ? url : `https://${url}`)
    .replace(/\/+$/, '');
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
}

function getApiBaseUrl() {
  if (apiUrl) return normalizeApiUrl(apiUrl);
  if (!legacyApiBaseUrl) return '/api';
  if (legacyApiBaseUrl.startsWith('/')) {
    return legacyApiBaseUrl.replace(/\/+$/, '') || '/api';
  }
  return normalizeApiUrl(legacyApiBaseUrl);
}

export const apiBaseUrl = getApiBaseUrl();
