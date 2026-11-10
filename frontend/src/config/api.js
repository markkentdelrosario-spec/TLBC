const apiUrl = import.meta.env.VITE_API_URL?.trim();
const legacyApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

function getApiBaseUrl() {
  if (apiUrl) {
    const baseUrl = (/^https?:\/\//i.test(apiUrl) ? apiUrl : `https://${apiUrl}`)
      .replace(/\/+$/, '');
    return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
  }
  return legacyApiBaseUrl || '/api';
}

export const apiBaseUrl = getApiBaseUrl();
