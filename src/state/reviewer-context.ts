/**
 * App-boot reviewer-context state.
 *
 * Every canonical route reads this same store. A cached promise—not merely a
 * cached value—ensures concurrent mounts share one request and one normalized
 * object identity. Failures remain cached until an explicit retry.
 */

import {
  fetchReviewerInternal,
  ReviewerRequestError,
  type ReviewerRequestFailureKind,
} from '../data/api';
import type { ReadApiResponse } from '../types/read-api';

export interface ReviewerContextLoading {
  status: 'loading';
}

export interface ReviewerContextReady {
  status: 'ready';
  data: ReadApiResponse;
}

export interface ReviewerContextFailure {
  status: ReviewerRequestFailureKind;
  error: ReviewerRequestError;
}

export type ReviewerContextState =
  | ReviewerContextLoading
  | ReviewerContextReady
  | ReviewerContextFailure;

export type ReviewerContextLoader = () => Promise<ReadApiResponse>;

export interface ReviewerContextStoreOptions {
  loader?: ReviewerContextLoader;
}

const LOADING: ReviewerContextLoading = Object.freeze({ status: 'loading' });

function classifiedFailure(error: unknown): ReviewerRequestError {
  if (error instanceof ReviewerRequestError) return error;
  return new ReviewerRequestError('unavailable', 'reviewer context loader failed', {
    cause: error,
  });
}

export class ReviewerContextStore {
  readonly #loader: ReviewerContextLoader;
  #requestVersion = 0;
  #cached: Promise<ReviewerContextState> | null = null;
  #state: ReviewerContextState = LOADING;

  constructor(options: ReviewerContextStoreOptions = {}) {
    this.#loader = options.loader ?? (() => fetchReviewerInternal());
  }

  get state(): ReviewerContextState {
    return this.#state;
  }

  /**
   * Start or reuse the one app-boot request. The completed promise remains
   * cached as well, so route changes cannot create a second implicit fetch.
   */
  load(): Promise<ReviewerContextState> {
    if (this.#cached) return this.#cached;
    return this.#startRequest();
  }

  /** The only operation allowed to replace the cached request/result. */
  retry(): Promise<ReviewerContextState> {
    this.#cached = null;
    return this.#startRequest();
  }

  #startRequest(): Promise<ReviewerContextState> {
    const version = ++this.#requestVersion;
    this.#state = LOADING;
    const request = Promise.resolve()
      .then(() => this.#loader())
      .then((data): ReviewerContextState => Object.freeze({ status: 'ready', data }))
      .catch((error: unknown): ReviewerContextState => {
        const classified = classifiedFailure(error);
        return Object.freeze({ status: classified.kind, error: classified });
      })
      .then((state) => {
        // A retry may supersede an older in-flight request. Its late result must
        // neither overwrite the newer request's state nor resolve an old caller
        // with stale civic data. Chaining to the current cached promise also
        // follows any later retry that supersedes that request in turn.
        if (version !== this.#requestVersion) return this.#cached ?? this.#state;
        this.#state = state;
        return state;
      });
    this.#cached = request;
    return request;
  }
}
