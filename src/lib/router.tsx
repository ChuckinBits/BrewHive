// A tiny router. Addresses look like index.html#/batches/123, which works on
// any static host (GitHub Pages included) with no server rules.
//
// The current path is kept in memory and mirrored to the address bar, so
// navigation keeps working even where the browser will not let a page change
// its own address (some embedded previews).

import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

function readHash(): string {
  const hash = window.location.hash.replace(/^#/, '');
  return hash.startsWith('/') ? hash : '/';
}

let current = readHash();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function onAddressChange(): void {
  const next = readHash();
  if (next !== current) {
    current = next;
    emit();
  }
}

window.addEventListener('popstate', onAddressChange);
window.addEventListener('hashchange', onAddressChange);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface Route {
  /** The path without the query, such as "/batches/123". */
  path: string;
  query: URLSearchParams;
}

export function useRoute(): Route {
  const address = useSyncExternalStore(subscribe, () => current);
  const [path, search = ''] = address.split('?');
  return { path: path.replace(/\/+$/, '') || '/', query: new URLSearchParams(search) };
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  if (to === current) return;
  current = to;
  try {
    if (options.replace) window.history.replaceState(null, '', '#' + to);
    else window.history.pushState(null, '', '#' + to);
  } catch {
    // The address bar could not be updated; the in-memory path still drives the app.
  }
  emit();
}

/** Matches "/batches/:id" against a path. Returns the named parts, or null when it does not match. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const want = pattern.split('/').filter(Boolean);
  const have = path.split('/').filter(Boolean);
  if (want.length !== have.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(':')) params[want[i].slice(1)] = decodeURIComponent(have[i]);
    else if (want[i] !== have[i]) return null;
  }
  return params;
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children?: ReactNode;
}

export function Link({ to, children, ...rest }: LinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle new-tab clicks; handle plain clicks in the app.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={'#' + to} {...rest} onClick={onClick}>
      {children}
    </a>
  );
}
