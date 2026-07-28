// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALERTS_READ_KEY,
  DEBATE_POSITION_KEY,
  LOCATION_KEY,
  TRACKED_KEY,
  readAlertsRead,
  readDebatePosition,
  readLocation,
  readTracked,
  writeAlertsRead,
  writeDebatePosition,
  writeLocation,
  writeTracked,
} from '../src/state/local-store';

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

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('local-store', () => {
  it('round-trips tracked cards and drops non-true entries', () => {
    writeTracked({ moratorium: true, fees: true });
    expect(readTracked()).toEqual({ moratorium: true, fees: true });
    localStorage.setItem(TRACKED_KEY, JSON.stringify({ a: true, b: 'yes', c: 1 }));
    expect(readTracked()).toEqual({ a: true });
  });

  it('round-trips the saved location and rejects partial shapes', () => {
    const place = { state: 'WY', county: 'Lincoln', region: 'Star Valley', town: 'Alpine' };
    writeLocation(place);
    expect(readLocation()).toEqual(place);
    localStorage.setItem(LOCATION_KEY, JSON.stringify({ state: 'WY' }));
    expect(readLocation()).toBeNull();
  });

  it('round-trips alert read ids, deduplicating on write', () => {
    writeAlertsRead(['a1', 'a2', 'a1']);
    expect(readAlertsRead()).toEqual(['a1', 'a2']);
    localStorage.setItem(ALERTS_READ_KEY, JSON.stringify(['ok', 7, null]));
    expect(readAlertsRead()).toEqual(['ok']);
  });

  it('round-trips the debate position and falls back to zero', () => {
    writeDebatePosition(6);
    expect(readDebatePosition()).toBe(6);
    localStorage.setItem(DEBATE_POSITION_KEY, JSON.stringify(-3));
    expect(readDebatePosition()).toBe(0);
    localStorage.setItem(DEBATE_POSITION_KEY, 'not json');
    expect(readDebatePosition()).toBe(0);
  });

  it('returns safe fallbacks on malformed JSON', () => {
    localStorage.setItem(TRACKED_KEY, '{broken');
    localStorage.setItem(LOCATION_KEY, '{broken');
    localStorage.setItem(ALERTS_READ_KEY, '{broken');
    expect(readTracked()).toEqual({});
    expect(readLocation()).toBeNull();
    expect(readAlertsRead()).toEqual([]);
  });

  it('does not throw when storage is unavailable', () => {
    // Stub the global directly rather than spying on Storage.prototype: the
    // hermetic memory stub is a plain object, so prototype spies never reach
    // it — and CI's Node-injected localStorage is not a Storage instance
    // either. Throwing methods on the global covers every implementation.
    vi.stubGlobal('localStorage', {
      get length() { return 0; },
      clear: () => { throw new Error('blocked'); },
      getItem: () => { throw new Error('blocked'); },
      key: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('quota'); },
    });
    expect(() => writeTracked({ a: true })).not.toThrow();
    expect(readTracked()).toEqual({});
    expect(readDebatePosition()).toBe(0);
  });
});
