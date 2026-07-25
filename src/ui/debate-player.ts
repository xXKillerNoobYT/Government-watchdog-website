/**
 * Roundtable debate player (MOTY Newsletter screen).
 *
 * Reads an already-authored script aloud with the browser's own speech
 * synthesis and highlights the current line. It never writes, edits, reorders,
 * or relabels a line: the script is supplied by the caller and every voice is a
 * disclosed perspective label, not a person.
 *
 * Speech synthesis is optional. Where it is unavailable — jsdom, locked-down
 * browsers — the transcript, line highlighting, and position memory all still
 * work and the audio controls render disabled with an explicit note.
 */

import { readDebatePosition, writeDebatePosition } from '../state/local-store';
import { GW_TOKENS } from './tokens';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export type DebateVoice = 'narrator' | 'conservative' | 'progressive' | 'libertarian';

export interface DebateLine {
  voice: DebateVoice;
  /** Disclosed perspective label shown in the transcript. */
  speaker: string;
  text: string;
}

/** Per-voice delivery so listeners can tell the perspectives apart by ear. */
export const VOICE_PROFILE: Record<DebateVoice, { pitch: number; rate: number }> = {
  narrator: { pitch: 1.0, rate: 1.0 },
  conservative: { pitch: 0.72, rate: 0.97 },
  progressive: { pitch: 1.28, rate: 1.06 },
  libertarian: { pitch: 0.9, rate: 1.1 },
};

export const SPEECH_UNAVAILABLE_NOTE =
  'Audio playback is unavailable in this browser. The full transcript is below and stays in sync with your place in the discussion.';

interface SpeechHost {
  speechSynthesis?: SpeechSynthesis;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
}

function speechHost(): SpeechHost {
  return (typeof window === 'undefined' ? {} : window) as SpeechHost;
}

export function speechAvailable(): boolean {
  const host = speechHost();
  return typeof host.speechSynthesis !== 'undefined' && typeof host.SpeechSynthesisUtterance === 'function';
}

/** Stops any in-flight narration — call before re-rendering or leaving a route. */
export function cancelDebateSpeech(): void {
  const host = speechHost();
  try {
    host.speechSynthesis?.cancel();
  } catch {
    /* A browser that refuses to cancel must not break navigation. */
  }
}

export const DEBATE_PLAYER_STYLE = `${GW_TOKENS}
.gw-debate{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-3);border:var(--gw-border-w) solid var(--gw-border);border-radius:var(--gw-radius-lg);background:var(--gw-surface);padding:var(--gw-space-4)}
.gw-debate-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--gw-space-3)}
.gw-debate-chip{border:var(--gw-border-w) solid var(--gw-caution-line);border-radius:var(--gw-radius-sm);background:var(--gw-caution-bg);color:var(--gw-caution-text);padding:0 var(--gw-space-2);font:700 var(--gw-text-badge)/1.6 var(--gw-font-mono);letter-spacing:.05em}
.gw-debate-controls{display:flex;flex-wrap:wrap;gap:var(--gw-space-2)}
.gw-debate-controls button{min-height:var(--gw-tap-min);min-width:var(--gw-tap-min);border:var(--gw-border-w) solid var(--gw-border-strong);border-radius:var(--gw-radius);background:transparent;color:var(--gw-text);padding:0 var(--gw-space-3);font-size:var(--gw-text-sm)}
.gw-debate-controls button[disabled]{opacity:.55}
.gw-debate-note{margin:0;font-size:var(--gw-text-sm);color:var(--gw-text-muted);max-width:62ch}
.gw-debate-now{border-left:3px solid var(--gw-accent);background:var(--gw-surface-subtle);border-radius:0 var(--gw-radius-md) var(--gw-radius-md) 0;padding:var(--gw-space-3);display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-1)}
.gw-debate-now b{font:800 var(--gw-text-kicker)/1.3 var(--gw-font);letter-spacing:.08em;text-transform:uppercase;color:var(--gw-text-secondary)}
.gw-debate-now p{margin:0;color:var(--gw-text)}
.gw-debate-transcript{display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-2)}
.gw-debate-transcript summary{cursor:pointer;font-size:var(--gw-text-sm);color:var(--gw-text-secondary);min-height:var(--gw-tap-min);display:flex;align-items:center}
.gw-debate-lines{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1fr);gap:var(--gw-space-1)}
.gw-debate-line{width:100%;text-align:left;min-height:var(--gw-tap-min);border:var(--gw-border-w) solid transparent;border-radius:var(--gw-radius-sm);background:transparent;color:var(--gw-text-secondary);padding:var(--gw-space-2);font-size:var(--gw-text-sm);display:grid;grid-template-columns:minmax(0,1fr);gap:2px}
.gw-debate-line[aria-current="true"]{border-color:var(--gw-accent);background:var(--gw-surface-accent-tint);color:var(--gw-text)}
.gw-debate-line b{font-size:var(--gw-text-badge);letter-spacing:.04em;color:var(--gw-text-muted)}
`;

export function ensureDebatePlayerStyle(): void {
  if (document.getElementById('gw-debate-player-style')) return;
  document.head.append(el('style', { id: 'gw-debate-player-style' }, [DEBATE_PLAYER_STYLE]));
}

export interface DebatePlayerSpec {
  script: DebateLine[];
  /** Listen-length chip copy, e.g. "≈15-MIN LISTEN". */
  lengthLabel?: string;
  /** Disclosure rendered above the controls. Required for AI-authored scripts. */
  disclosure?: string;
}

export interface DebatePlayerHandle {
  element: HTMLElement;
  /** Stops narration; safe to call more than once. */
  destroy(): void;
}

export function debatePlayer(spec: DebatePlayerSpec): DebatePlayerHandle {
  ensureDebatePlayerStyle();
  const available = speechAvailable();
  const total = spec.script.length;
  let index = Math.min(readDebatePosition(), Math.max(0, total - 1));
  let playing = false;

  const root = el('section', { class: 'gw-debate', 'data-test': 'debate-player' });

  const nowSpeaker = el('b', { 'data-test': 'debate-now-speaker' });
  const nowText = el('p', { 'data-test': 'debate-now-text' });
  const now = el('div', { class: 'gw-debate-now', role: 'status', 'aria-live': 'polite' }, [nowSpeaker, nowText]);

  const lineButtons: HTMLButtonElement[] = [];
  const lines = el('ul', { class: 'gw-debate-lines', 'data-test': 'debate-transcript-lines' });
  spec.script.forEach((line, position) => {
    const button = el('button', {
      type: 'button',
      class: 'gw-debate-line',
      'data-test': 'debate-line',
      'data-voice': line.voice,
      'data-line-index': String(position),
    }, [
      el('b', {}, [line.speaker]),
      el('span', {}, [line.text]),
    ]);
    button.addEventListener('click', () => {
      goTo(position);
      if (playing) speakCurrent();
    });
    lineButtons.push(button);
    lines.append(el('li', {}, [button]));
  });

  function paint(): void {
    const line = spec.script[index];
    nowSpeaker.textContent = line ? line.speaker : '';
    nowText.textContent = line ? line.text : '';
    lineButtons.forEach((button, position) => {
      button.setAttribute('aria-current', position === index ? 'true' : 'false');
    });
    playButton.textContent = playing ? 'Pause' : 'Play';
    playButton.setAttribute('aria-pressed', playing ? 'true' : 'false');
    prevButton.disabled = index === 0;
    nextButton.disabled = index >= total - 1;
  }

  function goTo(position: number): void {
    index = Math.min(Math.max(0, position), Math.max(0, total - 1));
    writeDebatePosition(index);
    paint();
  }

  function speakCurrent(): void {
    if (!available) return;
    const host = speechHost();
    const line = spec.script[index];
    if (!line || !host.speechSynthesis || !host.SpeechSynthesisUtterance) return;
    host.speechSynthesis.cancel();
    const utterance = new host.SpeechSynthesisUtterance(line.text);
    const profile = VOICE_PROFILE[line.voice] ?? VOICE_PROFILE.narrator;
    utterance.pitch = profile.pitch;
    utterance.rate = profile.rate;
    utterance.addEventListener('end', () => {
      if (!playing) return;
      if (index >= total - 1) {
        playing = false;
        paint();
        return;
      }
      goTo(index + 1);
      speakCurrent();
    });
    host.speechSynthesis.speak(utterance);
  }

  const playButton = el('button', {
    type: 'button',
    'data-test': 'debate-play',
    'aria-pressed': 'false',
  }, ['Play']) as HTMLButtonElement;
  const prevButton = el('button', { type: 'button', 'data-test': 'debate-prev' }, ['Previous']) as HTMLButtonElement;
  const nextButton = el('button', { type: 'button', 'data-test': 'debate-next' }, ['Next']) as HTMLButtonElement;
  const restartButton = el('button', { type: 'button', 'data-test': 'debate-restart' }, ['Restart']) as HTMLButtonElement;

  playButton.addEventListener('click', () => {
    playing = !playing;
    if (playing) speakCurrent();
    else cancelDebateSpeech();
    paint();
  });
  prevButton.addEventListener('click', () => {
    goTo(index - 1);
    if (playing) speakCurrent();
  });
  nextButton.addEventListener('click', () => {
    goTo(index + 1);
    if (playing) speakCurrent();
  });
  restartButton.addEventListener('click', () => {
    goTo(0);
    if (playing) speakCurrent();
  });

  if (!available) {
    for (const button of [playButton, prevButton, nextButton, restartButton]) {
      button.disabled = true;
    }
  }

  const head = el('div', { class: 'gw-debate-head' }, [
    el('span', { class: 'gw-debate-chip', 'data-test': 'debate-length' }, [spec.lengthLabel ?? '≈15-MIN LISTEN']),
    el('div', { class: 'gw-debate-controls' }, [playButton, prevButton, nextButton, restartButton]),
  ]);
  root.append(head);

  if (spec.disclosure) {
    root.append(el('p', { class: 'gw-debate-note', 'data-test': 'debate-disclosure' }, [spec.disclosure]));
  }
  if (!available) {
    root.append(el('p', {
      class: 'gw-debate-note',
      role: 'note',
      'data-test': 'debate-speech-unavailable',
    }, [SPEECH_UNAVAILABLE_NOTE]));
  }

  root.append(now, el('details', { class: 'gw-debate-transcript' }, [
    el('summary', { 'data-test': 'debate-transcript-toggle' }, ['Show transcript']),
    lines,
  ]));

  paint();
  if (!available) {
    prevButton.disabled = true;
    nextButton.disabled = true;
  }

  return {
    element: root,
    destroy(): void {
      playing = false;
      cancelDebateSpeech();
    },
  };
}
