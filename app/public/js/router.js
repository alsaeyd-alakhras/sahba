// Hash router — #/me #/settings[/tab] #/ideas #/factory[/<id>] #/gallery #/log #/welcome
export const ROUTES = ['welcome', 'me', 'settings', 'ideas', 'factory', 'gallery', 'log'];
export const DEFAULT_ROUTE = 'ideas';

export function parse(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  return { name: parts[0] || '', params: parts.slice(1), query: new URLSearchParams(query), hash: `#/${raw}` };
}

export function href(name, ...params) {
  return `#/${[name, ...params.filter((p) => p != null && p !== '').map(encodeURIComponent)].join('/')}`;
}

export function go(name, ...params) {
  const target = href(name, ...params);
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

/** Replace the hash without creating a history entry or triggering navigation. */
export function replace(name, ...params) {
  history.replaceState(null, '', href(name, ...params));
}

export function start(onRoute) {
  window.addEventListener('hashchange', () => onRoute(parse()));
  onRoute(parse());
}
