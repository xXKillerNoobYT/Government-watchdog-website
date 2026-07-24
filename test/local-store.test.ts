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

beforeEach(() => {
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
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeTracked({ a: true })).not.toThrow();
    expect(readTracked()).toEqual({});
    expect(readDebatePosition()).toBe(0);
  });
});
