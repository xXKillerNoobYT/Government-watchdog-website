// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '../src/ui/render';
import { loading, failed, resolved } from '../src/state/async-state';
import { FIXTURE, isEmptyResponse } from '../src/data/client';
import type { ReadApiResponse } from '../src/types/read-api';

let root: HTMLElement;
beforeEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
});

const empty: ReadApiResponse = { scope: 'alpine', access: 'reviewer_internal', records: [] };

describe('render — loading/empty/error primitives render from fixtures', () => {
  it('renders the loading primitive', () => {
    render(root, loading<ReadApiResponse>('fixture'));
    expect(root.querySelector('[data-test="state-loading"]')).not.toBeNull();
  });

  it('renders the empty primitive', () => {
    render(root, resolved(empty, 'fixture', isEmptyResponse));
    expect(root.querySelector('[data-test="state-empty"]')).not.toBeNull();
  });

  it('renders the error primitive with role=alert', () => {
    render(root, failed<ReadApiResponse>(new Error('read-API unreachable'), 'fixture'));
    const node = root.querySelector('[data-test="state-error"]');
    expect(node).not.toBeNull();
    expect(node!.getAttribute('role')).toBe('alert');
    expect(root.textContent).toContain('read-API unreachable');
  });

  it('always shows the FIXTURE MODE banner in fixture mode', () => {
    render(root, loading<ReadApiResponse>('fixture'));
    const banner = root.querySelector('[data-test="fixture-banner"]');
    expect(banner?.textContent).toContain('FIXTURE MODE — Not real data');
  });

  it('renders the timeline + trust badges + source drawer from the fixture', () => {
    render(root, resolved(FIXTURE, 'fixture', isEmptyResponse));
    expect(root.querySelectorAll('[data-test="record-card"]').length).toBe(FIXTURE.records!.length);
    expect(root.querySelector('[data-test="trust-badge"]')?.textContent).toContain('Source-backed');
    expect(root.querySelector('[data-test="source-drawer"]')).not.toBeNull();
    expect(root.querySelector('[data-test="breadcrumb"]')?.textContent).toContain('general safety');
  });

  it('does NOT show the fixture banner in live mode', () => {
    render(root, resolved(FIXTURE, 'live', isEmptyResponse));
    expect(root.querySelector('[data-test="fixture-banner"]')).toBeNull();
  });
});
