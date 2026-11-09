export async function apiRequest(
  path,
  { getIdToken, apiBaseUrl = '/api', ...options } = {}
) {
  if (typeof getIdToken !== 'function') {
    throw new Error('A Firebase getIdToken function is required.');
  }

  const token = await getIdToken();
  if (!token) throw new Error('Firebase did not return an ID token.');

  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(
    `${apiBaseUrl.replace(/\/$/, '')}${path}`,
    { ...options, headers }
  );
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null
        ? payload.message
        : payload;
    throw new Error(message || `Request failed with status ${response.status}.`);
  }
  return payload;
}

export function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
