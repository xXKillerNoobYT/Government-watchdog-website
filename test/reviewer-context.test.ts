import { describe, expect, it, vi } from 'vitest';
import { ReviewerRequestError } from '../src/data/api';
import {
  ReviewerContextStore,
  type ReviewerContextState,
} from '../src/state/reviewer-context';
import type { ReadApiResponse } from '../src/types/read-api';

function model(id: string): ReadApiResponse {
  return Object.freeze({
    scope: 'alpine',
    access: 'reviewer_internal',
    records: Object.freeze([Object.freeze({ statement_id: id, evidence: Object.freeze([]) })]),
  }) as unknown as ReadApiResponse;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('ReviewerContextStore', () => {
  it('starts loading and shares one cached in-flight and completed promise', async () => {
    const pending = deferred<ReadApiResponse>();
    const loader = vi.fn(() => pending.promise);
    const store = new ReviewerContextStore({ loader });

    expect(store.state).toEqual({ status: 'loading' });
    const first = store.load();
    const second = store.load();
    expect(first).toBe(second);
    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(1);

    const exactModel = model('one');
    pending.resolve(exactModel);
    const state = await first;
    expect(state).toEqual({ status: 'ready', data: exactModel });
    if (state.status === 'ready') expect(state.data).toBe(exactModel);
    expect(store.state).toBe(state);
    expect(store.load()).toBe(first);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it.each(['denied', 'unavailable', 'invalid'] as const)(
    'preserves a typed %s failure and does not retry implicitly',
    async (kind) => {
      const error = new ReviewerRequestError(kind, `${kind} test`);
      const loader = vi.fn(async () => Promise.reject(error));
      const store = new ReviewerContextStore({ loader });

      const first = store.load();
      const state = await first;
      expect(state).toEqual({ status: kind, error });
      expect(store.state).toBe(state);
      expect(store.load()).toBe(first);
      expect(loader).toHaveBeenCalledTimes(1);
    },
  );

  it('classifies an untyped loader failure as unavailable', async () => {
    const store = new ReviewerContextStore({
      loader: async () => Promise.reject(new Error('socket closed')),
    });
    const state = await store.load();
    expect(state.status).toBe('unavailable');
    if (state.status === 'unavailable') {
      expect(state.error).toBeInstanceOf(ReviewerRequestError);
      expect(state.error.cause).toEqual(new Error('socket closed'));
    }
  });

  it('captures a synchronous loader throw as an unavailable state', async () => {
    const store = new ReviewerContextStore({
      loader: (() => {
        throw new Error('synchronous setup failure');
      }) as () => Promise<ReadApiResponse>,
    });
    await expect(store.load()).resolves.toMatchObject({ status: 'unavailable' });
  });

  it('retries only when explicitly requested', async () => {
    let call = 0;
    const store = new ReviewerContextStore({
      loader: async () => {
        call += 1;
        if (call === 1) throw new ReviewerRequestError('unavailable', 'offline');
        return model('after-retry');
      },
    });

    expect((await store.load()).status).toBe('unavailable');
    const retried = await store.retry();
    expect(retried.status).toBe('ready');
    expect(call).toBe(2);
  });

  it('does not let a superseded request overwrite a newer retry', async () => {
    const oldRequest = deferred<ReadApiResponse>();
    const newRequest = deferred<ReadApiResponse>();
    const loader = vi.fn()
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const store = new ReviewerContextStore({ loader });

    const oldStatePromise = store.load();
    const newStatePromise = store.retry();
    newRequest.resolve(model('new'));
    const newState = await newStatePromise;
    oldRequest.resolve(model('old'));
    const oldCallerState = await oldStatePromise;

    expect(oldCallerState).toBe(newState);
    expect((oldCallerState as Extract<ReviewerContextState, { status: 'ready' }>).data.records?.[0]?.statement_id)
      .toBe('new');
    expect(store.state).toBe(newState);
    expect((store.state as Extract<ReviewerContextState, { status: 'ready' }>).data.records?.[0]?.statement_id)
      .toBe('new');
  });
});
