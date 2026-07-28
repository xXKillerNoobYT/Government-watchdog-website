// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEBATE_POSITION_KEY } from '../src/state/local-store';
import {
  SPEECH_UNAVAILABLE_NOTE,
  VOICE_PROFILE,
  debatePlayer,
  speechAvailable,
  type DebateLine,
} from '../src/ui/debate-player';

const SCRIPT: DebateLine[] = [
  { voice: 'narrator', speaker: 'Narrator', text: 'Tonight the council takes up the moratorium.' },
  { voice: 'conservative', speaker: 'Conservative lens', text: 'Property owners deserve notice first.' },
  { voice: 'progressive', speaker: 'Progressive lens', text: 'Infrastructure has to keep pace with growth.' },
  { voice: 'libertarian', speaker: 'Libertarian lens', text: 'Every restriction needs a sunset date.' },
];

interface FakeUtterance {
  text: string;
  pitch: number;
  rate: number;
  listeners: Record<string, (() => void)[]>;
  addEventListener(type: string, fn: () => void): void;
}

function installSpeech(): { spoken: FakeUtterance[]; cancel: ReturnType<typeof vi.fn> } {
  const spoken: FakeUtterance[] = [];
  const cancel = vi.fn();

  class Utterance implements FakeUtterance {
    text: string;
    pitch = 1;
    rate = 1;
    listeners: Record<string, (() => void)[]> = {};
    constructor(text: string) {
      this.text = text;
    }
    addEventListener(type: string, fn: () => void): void {
      (this.listeners[type] ??= []).push(fn);
    }
  }

  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utterance, configurable: true, writable: true });
  Object.defineProperty(window, 'speechSynthesis', {
    value: {
      cancel,
      speak: (utterance: FakeUtterance) => spoken.push(utterance),
    },
    configurable: true,
    writable: true,
  });
  return { spoken, cancel };
}

function removeSpeech(): void {
  Reflect.deleteProperty(window, 'speechSynthesis');
  Reflect.deleteProperty(window, 'SpeechSynthesisUtterance');
}

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
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  localStorage.clear();
  removeSpeech();
});

afterEach(() => {
  removeSpeech();
  vi.restoreAllMocks();
});

describe('debatePlayer without speech synthesis', () => {
  it('reports speech as unavailable', () => {
    expect(speechAvailable()).toBe(false);
  });

  it('still renders the full transcript and disables only the audio controls', () => {
    const { element } = debatePlayer({ script: SCRIPT });
    expect(element.querySelectorAll('[data-test="debate-line"]')).toHaveLength(4);
    expect(element.querySelector('[data-test="debate-speech-unavailable"]')?.textContent).toBe(SPEECH_UNAVAILABLE_NOTE);
    expect(element.querySelector<HTMLButtonElement>('[data-test="debate-play"]')?.disabled).toBe(true);
  });

  it('tracks the current line and persists the position when a line is chosen', () => {
    const { element } = debatePlayer({ script: SCRIPT });
    const lines = element.querySelectorAll<HTMLButtonElement>('[data-test="debate-line"]');
    lines[2].click();
    expect(lines[2].getAttribute('aria-current')).toBe('true');
    expect(lines[0].getAttribute('aria-current')).toBe('false');
    expect(element.querySelector('[data-test="debate-now-text"]')?.textContent).toBe(SCRIPT[2].text);
    expect(JSON.parse(localStorage.getItem(DEBATE_POSITION_KEY) ?? 'null')).toBe(2);
  });

  it('resumes from the stored position', () => {
    localStorage.setItem(DEBATE_POSITION_KEY, JSON.stringify(3));
    const { element } = debatePlayer({ script: SCRIPT });
    expect(element.querySelector('[data-test="debate-now-text"]')?.textContent).toBe(SCRIPT[3].text);
  });

  it('clamps a stored position past the end of the script', () => {
    localStorage.setItem(DEBATE_POSITION_KEY, JSON.stringify(99));
    const { element } = debatePlayer({ script: SCRIPT });
    expect(element.querySelector('[data-test="debate-now-text"]')?.textContent).toBe(SCRIPT[3].text);
  });

  it('renders a supplied disclosure', () => {
    const { element } = debatePlayer({ script: SCRIPT, disclosure: 'AI-PRESENTED — verify against the record.' });
    expect(element.querySelector('[data-test="debate-disclosure"]')?.textContent).toContain('AI-PRESENTED');
  });
});

describe('debatePlayer with speech synthesis', () => {
  it('speaks the current line with that voice profile', () => {
    const { spoken } = installSpeech();
    const { element } = debatePlayer({ script: SCRIPT });
    element.querySelector<HTMLButtonElement>('[data-test="debate-play"]')?.click();

    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe(SCRIPT[0].text);
    expect(spoken[0].pitch).toBe(VOICE_PROFILE.narrator.pitch);
    expect(spoken[0].rate).toBe(VOICE_PROFILE.narrator.rate);
  });

  it('gives each perspective a distinct pitch and rate', () => {
    const { spoken } = installSpeech();
    const { element } = debatePlayer({ script: SCRIPT });
    element.querySelectorAll<HTMLButtonElement>('[data-test="debate-line"]')[1].click();
    element.querySelector<HTMLButtonElement>('[data-test="debate-play"]')?.click();

    expect(spoken[0].pitch).toBe(VOICE_PROFILE.conservative.pitch);
    expect(spoken[0].rate).toBe(VOICE_PROFILE.conservative.rate);
  });

  it('advances to the next line when the current one finishes', () => {
    const { spoken } = installSpeech();
    const { element } = debatePlayer({ script: SCRIPT });
    element.querySelector<HTMLButtonElement>('[data-test="debate-play"]')?.click();
    spoken[0].listeners.end?.forEach((fn) => fn());

    expect(spoken).toHaveLength(2);
    expect(spoken[1].text).toBe(SCRIPT[1].text);
    expect(JSON.parse(localStorage.getItem(DEBATE_POSITION_KEY) ?? 'null')).toBe(1);
  });

  it('stops narrating at the end of the script', () => {
    const { spoken } = installSpeech();
    localStorage.setItem(DEBATE_POSITION_KEY, JSON.stringify(3));
    const { element } = debatePlayer({ script: SCRIPT });
    const play = element.querySelector<HTMLButtonElement>('[data-test="debate-play"]');
    play?.click();
    spoken[0].listeners.end?.forEach((fn) => fn());

    expect(spoken).toHaveLength(1);
    expect(play?.getAttribute('aria-pressed')).toBe('false');
  });

  it('cancels narration on pause and on destroy', () => {
    const { cancel } = installSpeech();
    const player = debatePlayer({ script: SCRIPT });
    const play = player.element.querySelector<HTMLButtonElement>('[data-test="debate-play"]');
    play?.click();
    play?.click();
    expect(cancel).toHaveBeenCalled();

    cancel.mockClear();
    player.destroy();
    expect(cancel).toHaveBeenCalled();
  });

  it('enables the audio controls when speech is available', () => {
    installSpeech();
    const { element } = debatePlayer({ script: SCRIPT });
    expect(element.querySelector<HTMLButtonElement>('[data-test="debate-play"]')?.disabled).toBe(false);
    expect(element.querySelector('[data-test="debate-speech-unavailable"]')).toBeNull();
  });
});
