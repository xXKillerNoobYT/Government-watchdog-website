// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, String(value)),
  };
}

function banner(): Element | null {
  return document.querySelector('[data-test="shell-origin-banner"]');
}

function go(hash: string): void {
  window.location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

beforeEach(() => {
  vi.resetModules();
  document.head.replaceChildren();
  document.body.replaceChildren();
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('upload origin test must not read a live response');
  }));
  localStorage.setItem('gw_home_mode', 'advanced');
  const root = document.createElement('div');
  root.id = 'app';
  document.body.append(root);
});

describe('issue #293 simulated upload receipt origin', () => {
  it.each([
    ['simple', 'received'], ['simple', 'held'],
    ['advanced', 'received'], ['advanced', 'held'],
  ])('leaves the %s forced %s fixture before submitting another file', async (mode, phase) => {
    localStorage.setItem('gw_home_mode', mode);
    const submit = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true, status: 201, json: async () => ({ review_state: 'pending' }),
    }));
    vi.stubGlobal('fetch', submit);
    window.location.hash = `#/upload?reviewer=1&ustate=${phase}&rstatus=held`;
    await import('../src/main');
    expect(banner()?.getAttribute('data-origin')).toBe('fixture');
    document.querySelector<HTMLButtonElement>('[data-test="upload-another"]')!.click();
    await vi.waitFor(() => expect(banner()?.getAttribute('data-origin')).toBe('live_server'));
    expect(window.location.hash).toContain('reviewer=1');
    expect(window.location.hash).not.toMatch(/ustate=|rstatus=/);
    expect(document.querySelector('#app')?.getAttribute('data-mode')).toBe(mode);
    const file = new File(['synthetic repeated-flow regression'], 'synthetic.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new TextEncoder().encode('synthetic repeated-flow regression').buffer });
    const input = document.querySelector<HTMLInputElement>('[data-test="upload-file-input"]')!;
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    const origin = document.querySelector<HTMLInputElement>('[data-test="upload-provenance-origin"]')!;
    origin.value = 'Synthetic regression fixture';
    origin.dispatchEvent(new Event('input'));
    const description = document.querySelector<HTMLSelectElement>('[data-test="upload-provenance-description"]')!;
    description.value = description.options[1].value;
    description.dispatchEvent(new Event('change'));
    document.querySelector<HTMLButtonElement>('[data-test="upload-submit"]')!.click();
    await vi.waitFor(() => expect(document.querySelector('[data-test="upload-success-pending"]')).not.toBeNull());
    expect(submit.mock.calls.filter(([url]) => url === '/api/beta/intake/upload')).toHaveLength(1);
    expect(banner()?.getAttribute('data-origin')).toBe('live_server');
    expect(banner()?.textContent).not.toContain('SYNTHETIC DESIGN FIXTURE');
  });

  it.each(['received', 'held'])('labels direct Simple-mode %s as a fixture', async (phase) => {
    localStorage.setItem('gw_home_mode', 'simple');
    window.location.hash = `#/upload?reviewer=1&ustate=${phase}`;
    await import('../src/main');
    expect(document.querySelector('#app')?.getAttribute('data-mode')).toBe('simple');
    expect(banner()?.getAttribute('data-origin')).toBe('fixture');
    expect(banner()?.textContent).toContain('SYNTHETIC DESIGN FIXTURE');
    expect(document.querySelector('[data-test="upload-form"]')).toBeNull();
    expect(document.querySelector(`[data-test="${phase === 'held' ? 'upload-held' : 'upload-success-pending'}"]`)).not.toBeNull();
    expect(fetch).not.toHaveBeenCalledWith('/api/beta/intake/upload', expect.anything());
  });

  it('labels held navigation in Advanced mode as a fixture', async () => {
    window.location.hash = '#/upload?reviewer=1';
    await import('../src/main');
    expect(banner()?.getAttribute('data-origin')).toBe('live_server');
    go('#/upload?reviewer=1&ustate=held');
    expect(document.querySelector('#app')?.getAttribute('data-mode')).toBe('advanced');
    expect(banner()?.getAttribute('data-origin')).toBe('fixture');
    expect(document.querySelector('[data-test="upload-held"]')).not.toBeNull();
    expect(fetch).not.toHaveBeenCalledWith('/api/beta/intake/upload', expect.anything());
  });

  it.each(['simple', 'advanced'])('keeps unknown ustate live in %s mode', async (mode) => {
    localStorage.setItem('gw_home_mode', mode);
    window.location.hash = '#/upload?reviewer=1&ustate=unknown';
    await import('../src/main');
    expect(banner()?.getAttribute('data-origin')).toBe('live_server');
    expect(banner()?.textContent).toContain('LIVE SERVER CONTEXT');
    expect(document.querySelector('[data-test="upload-form"]')).not.toBeNull();
    expect(document.querySelector('[data-test="upload-success-pending"]')).toBeNull();
    expect(document.querySelector('[data-test="upload-held"]')).toBeNull();
  });

  it.each(['pending', 'held'])('keeps an HTTP transport %s receipt live', async (reviewState) => {
    const submit = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      status: 201,
      json: async () => ({ review_state: reviewState }),
    }));
    vi.stubGlobal('fetch', submit);
    window.location.hash = '#/upload?reviewer=1';
    await import('../src/main');
    const file = new File(['synthetic receipt regression'], 'synthetic.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new TextEncoder().encode('synthetic receipt regression').buffer });
    const input = document.querySelector<HTMLInputElement>('[data-test="upload-file-input"]')!;
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    const origin = document.querySelector<HTMLInputElement>('[data-test="upload-provenance-origin"]')!;
    origin.value = 'Synthetic regression fixture';
    origin.dispatchEvent(new Event('input'));
    const description = document.querySelector<HTMLSelectElement>('[data-test="upload-provenance-description"]')!;
    description.value = description.options[1].value;
    description.dispatchEvent(new Event('change'));
    document.querySelector<HTMLButtonElement>('[data-test="upload-submit"]')!.click();
    await vi.waitFor(() => expect(document.querySelector(`[data-test="${reviewState === 'held' ? 'upload-held' : 'upload-success-pending'}"]`)).not.toBeNull());
    const uploads = submit.mock.calls.filter(([url]) => url === '/api/beta/intake/upload');
    expect(uploads).toHaveLength(1);
    expect(uploads[0][1]?.method).toBe('POST');
    expect(uploads[0][1]?.credentials).toBe('include');
    expect(banner()?.getAttribute('data-origin')).toBe('live_server');
    expect(banner()?.textContent).toContain('LIVE SERVER CONTEXT');
    expect(banner()?.textContent).not.toContain('SYNTHETIC DESIGN FIXTURE');
    expect(window.location.hash).not.toContain('ustate=');
  });

  it('labels a forced receipt as a fixture and keeps the ordinary upload route live', async () => {
    window.location.hash = '#/upload?reviewer=1&ustate=received';
    await import('../src/main');

    const received = banner();
    expect(received?.getAttribute('data-origin')).toBe('fixture');
    expect(received?.getAttribute('role')).toBe('status');
    expect(received?.textContent).toContain('SYNTHETIC DESIGN FIXTURE');
    expect(received?.textContent).toContain('visual-review sample');
    expect(received?.textContent).toContain('not a live read');
    expect(received?.textContent).not.toContain('LIVE SERVER CONTEXT');
    expect(received?.textContent).not.toContain('no captured fallback');
    expect(document.querySelector('#app')?.getAttribute('data-origin')).toBe('fixture');
    expect(document.querySelector('[data-test="upload-success-pending"]')).not.toBeNull();
    expect(document.querySelector('[data-test="upload-form"]')).toBeNull();

    document.querySelector<HTMLButtonElement>('[data-test="mode-simple"]')?.click();
    expect(document.querySelector('#app')?.getAttribute('data-mode')).toBe('simple');
    expect(banner()?.getAttribute('data-origin')).toBe('fixture');
    expect(banner()?.textContent).not.toContain('LIVE SERVER CONTEXT');
    expect(document.querySelector('[data-test="upload-success-pending"]')).not.toBeNull();

    go('#/upload?reviewer=1');
    const live = banner();
    expect(live?.getAttribute('data-origin')).toBe('live_server');
    expect(live?.textContent).toContain('LIVE SERVER CONTEXT');
    expect(live?.textContent).toContain('no captured fallback');
    expect(live?.textContent).not.toContain('SYNTHETIC DESIGN FIXTURE');
    expect(document.querySelector('#app')?.getAttribute('data-origin')).toBe('live_server');
    expect(document.querySelector('[data-test="upload-form"]')).not.toBeNull();
    expect(document.querySelector('[data-test="upload-success-pending"]')).toBeNull();
    expect(document.querySelector('[data-test="upload-held"]')).toBeNull();

    go('#/upload?reviewer=1&ustate=held');
    const held = banner();
    expect(held?.getAttribute('data-origin')).toBe('fixture');
    expect(held?.getAttribute('role')).toBe('status');
    expect(held?.textContent).toContain('SYNTHETIC DESIGN FIXTURE');
    expect(held?.textContent).not.toContain('LIVE SERVER CONTEXT');
    expect(document.querySelector('[data-test="upload-held"]')).not.toBeNull();
    expect(document.querySelector('[data-test="upload-form"]')).toBeNull();
  });
});
