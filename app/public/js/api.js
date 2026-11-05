// API client — JSON fetch + SSE-over-POST reader (fetch + ReadableStream). No UI strings here.

export class ApiError extends Error {
  constructor(status, code, msg, data) {
    super(msg || code);
    this.status = status;
    this.code = code;
    this.msg = msg || '';
    this.data = data;
  }
}

async function parseBody(res) {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json().catch(() => null);
  return res.text().catch(() => '');
}

function toError(res, data) {
  const code = (data && typeof data === 'object' && data.error) || (res.status === 409 ? 'busy' : `http_${res.status}`);
  const msg = (data && typeof data === 'object' && data.msg) || '';
  return new ApiError(res.status, code, msg, data);
}

async function request(method, path, body, { signal, raw, contentType } = {}) {
  const init = { method, headers: {}, signal };
  if (raw !== undefined) {
    init.body = raw;
    init.headers['Content-Type'] = contentType || 'application/octet-stream';
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }
  let res;
  try {
    res = await fetch(path, init);
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'network', '');
  }
  const data = await parseBody(res);
  if (!res.ok) throw toError(res, data);
  return data;
}

/**
 * POST and read a text/event-stream response.
 * Calls onEvent({event, data}) for every event; resolves with `done.result`, rejects on `error`.
 */
async function stream(path, body, { onEvent, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body ?? {}),
      signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'network', '');
  }
  if (!res.ok) throw toError(res, await parseBody(res));
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/event-stream') || !res.body) {
    // Non-streaming success: treat the JSON body as the result.
    const data = await parseBody(res);
    return data;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let evName = 'message';
  let dataLines = [];
  let result;
  let failure = null;
  let finished = false;

  const dispatch = () => {
    if (!dataLines.length) { evName = 'message'; return; }
    const rawData = dataLines.join('\n');
    let data;
    try { data = JSON.parse(rawData); } catch { data = rawData; }
    const ev = { event: evName, data };
    evName = 'message';
    dataLines = [];
    if (ev.event === 'done') { result = data && typeof data === 'object' && 'result' in data ? data.result : data; finished = true; }
    if (ev.event === 'error') failure = new ApiError(200, (data && data.code) || 'stream_error', (data && data.msg) || '', data);
    try { onEvent && onEvent(ev); } catch (e) { console.error(e); }
  };

  const onAbort = () => reader.cancel().catch(() => {});
  signal && signal.addEventListener('abort', onAbort, { once: true });
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.search(/\r?\n/)) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(buf[idx] === '\r' ? idx + 2 : idx + 1);
        if (line === '') { dispatch(); continue; }
        if (line.startsWith(':')) continue;
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        let val = colon < 0 ? '' : line.slice(colon + 1);
        if (val.startsWith(' ')) val = val.slice(1);
        if (field === 'event') evName = val || 'message';
        else if (field === 'data') dataLines.push(val);
      }
    }
    buf += decoder.decode();
    if (buf.trim()) { for (const line of buf.split(/\r?\n/)) { if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart()); else if (line.startsWith('event:')) evName = line.slice(6).trim(); } }
    dispatch();
  } finally {
    signal && signal.removeEventListener('abort', onAbort);
  }
  if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (failure) throw failure;
  if (!finished) return null;
  return result;
}

export const api = {
  get: (p, o) => request('GET', p, undefined, o),
  put: (p, b, o) => request('PUT', p, b, o),
  post: (p, b, o) => request('POST', p, b ?? {}, o),
  patch: (p, b, o) => request('PATCH', p, b, o),
  del: (p, o) => request('DELETE', p, undefined, o),
  upload: (p, file, o = {}) => request('POST', p, undefined, { ...o, raw: file, contentType: file.type }),
  stream,
};

/** URL for a workspace-relative file, with optional cache-busting. */
export function fileUrl(rel, bust) {
  if (!rel) return '';
  if (/^(https?:|data:|blob:|\/)/.test(rel)) return bust ? `${rel}${rel.includes('?') ? '&' : '?'}v=${bust}` : rel;
  const clean = String(rel).replace(/\\/g, '/').replace(/^\.?\//, '').split('/').map(encodeURIComponent).join('/');
  return `/files/${clean}${bust ? `?v=${bust}` : ''}`;
}
