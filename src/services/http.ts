/** Fetch with timeout, abort and friendly error mapping. Never throws raw network errors to the UI. */
export class ServiceError extends Error {
  constructor(message: string, public kind: 'timeout' | 'rate_limit' | 'network' | 'http' | 'parse' | 'empty') {
    super(message);
  }
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (res.status === 429) throw new ServiceError('The service is rate-limiting requests. Please wait a minute and try again.', 'rate_limit');
    if (res.status === 504 || res.status === 503) throw new ServiceError('The service is busy right now (HTTP ' + res.status + '). Try again shortly.', 'http');
    if (!res.ok) throw new ServiceError(`The service returned HTTP ${res.status}.`, 'http');
    try {
      return (await res.json()) as T;
    } catch {
      throw new ServiceError('The service returned an unreadable response.', 'parse');
    }
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') throw new ServiceError(`The request timed out after ${Math.round(timeoutMs / 1000)} s.`, 'timeout');
    throw new ServiceError('Network error – check your internet connection (or that the service is reachable from this network).', 'network');
  } finally {
    clearTimeout(timer);
  }
}
