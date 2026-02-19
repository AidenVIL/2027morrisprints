export async function adminFetch(path: string, options?: RequestInit) {
  const win = window as any;
  if (!win?.electronAPI?.storeGetAll) throw new Error('electronAPI.storeGetAll not available');
  const all = await win.electronAPI.storeGetAll();
  const apiBaseUrl: string | undefined = all?.apiBaseUrl;
  const token: string | undefined = all?.adminToken;
  if (!apiBaseUrl) throw new Error('API base URL not configured');
  if (!token) throw new Error('Admin token not configured');

  // In dev, use relative paths so the Vite dev server proxy can forward requests
  const isDev = import.meta.env.DEV;
  let url: string;
  if (isDev) {
    url = path.startsWith('http') ? path : (path.startsWith('/') ? path : `/${path}`);
  } else {
    const base = apiBaseUrl.replace(/\/$/, '');
    url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  const headers: Record<string, string> = {
    'x-admin-token': token,
    ...(options && (options.headers as Record<string, string>))
  };

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    throw new Error('Failed to parse JSON response');
  }

  if (!res.ok) {
    const short = (data && (data.message || data.error)) || res.statusText || `HTTP ${res.status}`;
    const full = data ? JSON.stringify(data) : text || res.statusText || `HTTP ${res.status}`;
    const err: any = new Error(`${res.status} ${short} ${full}`);
    err.status = res.status;
    err.body = data;
    console.error('adminFetch error', { url, status: res.status, body: data, text });
    throw err;
  }

  return data;
}
