// Global app state (from /api/state) + local run counter. Tiny pub/sub.
import { api } from './api.js';

const listeners = new Set();

export const store = {
  state: null,      // { settings, identity, claude, ideasCount, busy }
  error: null,      // ApiError when /api/state fails
  localRuns: 0,     // SSE runs started from this tab
  localKind: null,  // 'claude' | 'render'
};

function emit() { for (const fn of listeners) { try { fn(store); } catch (e) { console.error(e); } } }

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function refreshState() {
  try {
    store.state = await api.get('/api/state');
    store.error = null;
  } catch (e) {
    store.error = e;
  }
  emit();
  return store.state;
}

export function patchState(part) {
  store.state = { ...(store.state || {}), ...part };
  emit();
}

export function runStarted(kind) { store.localRuns += 1; store.localKind = kind; emit(); }
export function runEnded() { store.localRuns = Math.max(0, store.localRuns - 1); if (!store.localRuns) store.localKind = null; emit(); }

export function claudeStatus() {
  if (store.error) return 'offline';
  const c = store.state && store.state.claude;
  if (!c || c.installed == null) return 'unknown'; // probe not finished yet
  if (!c.installed) return 'missing';
  if (!c.loggedIn) return 'loggedOut';
  return 'ok';
}

export function claudeReady() { return claudeStatus() === 'ok'; }

export function busyKind() {
  const b = (store.state && store.state.busy) || {};
  if (b.claude || store.localKind === 'claude') return 'claude';
  if (b.render || store.localKind === 'render') return 'render';
  if (store.localRuns) return 'claude';
  return null;
}

export function settings() { return (store.state && store.state.settings) || {}; }
export function identity() { return (store.state && store.state.identity) || {}; }
