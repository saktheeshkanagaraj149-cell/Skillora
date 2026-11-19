const BASE = import.meta.env.VITE_API_URL || '/api';

export const tokenStore = {
  get: () => localStorage.getItem('skillora_token'),
  set: (t) => (t ? localStorage.setItem('skillora_token', t) : localStorage.removeItem('skillora_token')),
};

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  const SERVER_DOWN = "Can't reach the Skillora server right now. Please try again in a minute.";
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw Object.assign(new Error(SERVER_DOWN), { status: 0 }); // network error: API not running / offline
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // No JSON body = the request never reached our API (e.g. the dev proxy or host returned an error page)
    const message = data?.error || (res.status >= 500 ? SERVER_DOWN : `Request failed (${res.status})`);
    throw Object.assign(new Error(message), { status: res.status });
  }
  return data;
}
