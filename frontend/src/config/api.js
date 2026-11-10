const apiUrl = import.meta.env.VITE_API_URL?.trim();
const legacyApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

function normalizeApiUrl(url) {
  const parsedUrl = new URL(
    /^https?:\/\//i.test(url) ? url : `https://${url}`
  );
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(
    parsedUrl.hostname
  );
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    parsedUrl.protocol === 'http:' &&
    !localHost
  ) {
    parsedUrl.protocol = 'https:';
  }
  const baseUrl = parsedUrl.toString().replace(/\/+$/, '');
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
