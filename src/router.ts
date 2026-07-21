/**
 * Minimal hash-router shell — NEUTRAL routing primitive, no visual commitments.
 *
 * The skeleton only needs a single timeline route today; this exists so later
 * slices (topic pages, meeting pages, newsletter) can register routes without a
 * framework decision being baked in now. Hash-based to keep the reviewer-internal
 * build trivially static (no server rewrite rules).
 */

export type RouteHandler = (params: { path: string; query: URLSearchParams }) => void;

export interface Router {
  register(path: string, handler: RouteHandler): void;
  start(): void;
  current(): string;
}

function parseHash(): { path: string; query: URLSearchParams } {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(qs) };
}

export function createRouter(fallback: RouteHandler): Router {
  const routes = new Map<string, RouteHandler>();
  let previousPath: string | null = null;
  const dispatch = (): void => {
    const { path, query } = parseHash();
    (routes.get(path) ?? fallback)({ path, query });
    if (previousPath !== null && previousPath !== path) {
      const scrollingElement = document.scrollingElement ?? document.documentElement;
      scrollingElement.scrollTop = 0;
      scrollingElement.scrollLeft = 0;
    }
    previousPath = path;
  };
  return {
    register: (path, handler) => routes.set(path, handler),
    start: () => {
      window.addEventListener('hashchange', dispatch);
      dispatch();
    },
    current: () => parseHash().path,
  };
}
