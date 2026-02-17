export async function adminFetch(path: string, options?: RequestInit) {
  const win = window as any;
  if (!win?.electronAPI?.storeGetAll) throw new Error('electronAPI.storeGetAll not available');
  const all = await win.electronAPI.storeGetAll();
  const apiBaseUrl: string | undefined = all?.apiBaseUrl;
  const token: string | undefined = all?.adminToken;
  if (!apiBaseUrl) throw new Error('API base URL not configured');
  if (!token) throw new Error('Admin token not configured');

  const base = apiBaseUrl.replace(/\/$/, '');
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

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
    const msg = (data && (data.message || data.error)) || res.statusText || `HTTP ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}
