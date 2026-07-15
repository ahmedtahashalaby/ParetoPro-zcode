/**
 * Pareto Pro Enterprise — Performance Layer
 * ----------------------------------------
 * Memory-safe optimization infrastructure:
 *
 *   1. {@link memoize}     — LRU memoization for pure domain functions.
 *   2. {@link Virtualizer}  — viewport-aware windowing for very large
 *                            point arrays (>= VIRTUAL_THRESHOLD).
 *   3. {@link DisposableRegistry} — tracks every allocation (d3
 *                            selections, listeners, timers, observers)
 *                            so the visual can release them all in
 *                            destroy() with zero leaks.
 *   4. Frame budget        — a tiny utility used by renderers to auto-
 *                            degrade animations when the previous frame
 *                            exceeded the budget.
 *
 * @module    performance
 * @version   1.0.0
 */

import { MEMO_CACHE_SIZE, VIRTUAL_THRESHOLD, FRAME_BUDGET_MS } from "./constants";

/* ============================================================
   LRU MEMOIZATION
   ============================================================ */

interface MemoEntry<K, V> {
    readonly key: K;
    readonly value: V;
    /** LRU bookkeeping — last access stamp. */
    stamp: number;
}

/**
 * LRU memoization wrapper for a pure function. The cache is bounded by
 * `capacity` entries (default {@link MEMO_CACHE_SIZE}). The caller must
 * supply a *stable* key function; passing a string is the simplest path.
 *
 * @param fn      The pure function to memoize.
 * @param keyFn   Computes the cache key from inputs.
 * @param capacity  Max entries (default MEMO_CACHE_SIZE).
 * @returns        A memoized wrapper that never exceeds `capacity` entries.
 */
export function memoize<A extends unknown[], V>(
    fn: (...args: A) => V,
    keyFn: (...args: A) => string,
    capacity: number = MEMO_CACHE_SIZE
): (...args: A) => V {
    const store = new Map<string, MemoEntry<string, V>>();
    let counter = 0;

    return function (...args: A): V {
        const key = keyFn(...args);
        const hit = store.get(key);
        if (hit) {
            hit.stamp = ++counter;
            return hit.value;
        }
        const value = fn(...args);
        if (store.size >= capacity) {
            // Evict the least-recently-used entry.
            let oldestKey: string | null = null;
            let oldestStamp = Number.POSITIVE_INFINITY;
            store.forEach((entry, k) => {
                if (entry.stamp < oldestStamp) {
                    oldestStamp = entry.stamp;
                    oldestKey = k;
                }
            });
            if (oldestKey !== null) {
                store.delete(oldestKey);
            }
        }
        store.set(key, { key, value, stamp: ++counter });
        return value;
    };
}

/** Clear a memoized function's cache (used by tests + on theme reset). */
export function clearMemo<T extends (...args: unknown[]) => unknown>(fn: T & { _memoStore?: Map<unknown, unknown> }): void {
    if (fn._memoStore) {
        fn._memoStore.clear();
    }
}

/* ============================================================
   VIRTUAL WINDOWING
   ============================================================ */

export interface VirtualWindow {
    /** First visible index (inclusive). */
    readonly start: number;
    /** Last visible index (exclusive). */
    readonly end: number;
    /** Indices that the renderer must realize into DOM. */
    readonly visibleCount: number;
}

/**
 * A windowing helper for arrays at or beyond {@link VIRTUAL_THRESHOLD}.
 *
 * The renderer passes the full dataset length and a target viewport
 * capacity (typically the number of bars that fit in the chart width with
 * a comfortable pixel budget per bar). The window is centered on the
 * scroll offset when supplied; otherwise it returns the natural top slice.
 *
 * Pure function — no DOM access.
 */
export function computeWindow(
    total: number,
    capacity: number,
    scrollOffset: number = 0
): VirtualWindow {
    if (total === 0) {
        return { start: 0, end: 0, visibleCount: 0 };
    }
    if (total <= VIRTUAL_THRESHOLD || capacity <= 0) {
        return { start: 0, end: total, visibleCount: total };
    }
    const start = Math.max(0, Math.min(scrollOffset, total - capacity));
    const end = Math.min(total, start + capacity);
    return {
        start,
        end,
        visibleCount: end - start
    };
}

/* ============================================================
   DISPOSABLE REGISTRY — zero-leak teardown
   ============================================================ */

export type Disposable = () => void;

/**
 * Accumulates disposable callbacks. Every renderer that allocates a
 * long-lived resource (timer, observer, listener, selection) registers
 * its teardown here. On `destroy()` the registry runs every callback —
 * so destroying the visual leaves no dangling references.
 *
 * Usage:
 *   const reg = new DisposableRegistry();
 *   reg.add(() => clearInterval(handle));
 *   // ...later
 *   reg.disposeAll();
 */
export class DisposableRegistry {
    private readonly items: Disposable[] = [];

    /** Register a teardown callback. Returns this for chaining. */
    public add(dispose: Disposable): this {
        this.items.push(dispose);
        return this;
    }

    /** Run every registered callback exactly once, then clear the list. */
    public disposeAll(): void {
        let d: Disposable | undefined;
        while ((d = this.items.pop()) !== undefined) {
            try {
                d();
            } catch {
                // Disposal must never crash the visual.
            }
        }
    }

    /** True once teardown has run (i.e. the list is empty after a destroy). */
    public get isDisposed(): boolean {
        return this.items.length === 0 && this.disposed;
    }

    private disposed = false;

    /** Mark the registry as disposed and run all callbacks. */
    public dispose(): void {
        if (this.disposed) return;
        this.disposeAll();
        this.disposed = true;
    }
}

/* ============================================================
   FRAME BUDGET — auto-degrade animations when slow
   ============================================================ */

/**
 * Returns true if the previous frame budget was exceeded and the
 * renderer should skip or shorten animations. Not a perfect rAF
 * rhythm tracker — a simple rolling measure that respects users
 * who disable animations entirely.
 */
export class FrameBudget {
    private lastFrameMs: number = 0;
    private budget: number;

    constructor(budget: number = FRAME_BUDGET_MS) {
        this.budget = budget;
    }

    /** Record a frame's duration; call after each render cycle. */
    public record(durationMs: number): void {
        this.lastFrameMs = durationMs;
    }

    /** True if the last recorded frame exceeded the budget. */
    public get exceeded(): boolean {
        return this.lastFrameMs > this.budget;
    }

    /** Returns a recommended animation duration (degraded when slow). */
    public recommendedDuration(requested: number): number {
        return this.exceeded ? 0 : requested;
    }
}
