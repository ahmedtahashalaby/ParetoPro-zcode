/**
 * Pareto Pro Enterprise — Descriptive Statistics
 * ----------------------------------------------
 * Computes mean, median, mode, standard deviation, variance, skewness,
 * kurtosis, range, and the Gini coefficient for a numeric sample.
 * All functions are pure and allocation-light; the heaviest use a single
 * sorted-copy scan.
 *
 * @module    statistics
 * @version   1.0.0
 */

import { ParetoPoint, Statistics, Totals } from "./interfaces";

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Compute the full {@link Statistics} aggregate from a Pareto point array.
 * The values used are the per-category `value` fields (sorted by rank).
 *
 * @param points The Pareto points produced by the engine.
 * @returns     A populated Statistics record. Empty input => zeros.
 */
export function computeStatistics(points: ReadonlyArray<ParetoPoint>): Statistics {
    const n = points.length;
    if (n === 0) {
        return ZERO_STATISTICS;
    }

    const values = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        values[i] = points[i].value;
    }

    const mean = meanOf(values);
    const variance = varianceOf(values, mean);
    const stdDev = Math.sqrt(variance);
    const median = medianOf(values);
    const mode = modeOf(values);
    const skewness = skewnessOf(values, mean, stdDev);
    const kurtosis = kurtosisOf(values, mean, stdDev);
    const gini = giniOf(values);
    const range = rangeOf(values);

    return {
        mean,
        median,
        mode,
        standardDeviation: stdDev,
        variance,
        skewness,
        kurtosis,
        gini,
        range
    };
}

/**
 * Compute aggregate totals (sum, count, average, max, min) for the KPI
 * cards. Derived from the per-category values rather than the row count,
 * so they correctly reflect the dataset's shape after aggregation.
 */
export function computeTotals(points: ReadonlyArray<ParetoPoint>): Totals {
    const n = points.length;
    if (n === 0) {
        return ZERO_TOTALS;
    }
    let total = 0;
    let max = Number.NEGATIVE_INFINITY;
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) {
        const v = points[i].value;
        total += v;
        if (v > max) max = v;
        if (v < min) min = v;
    }
    return {
        total,
        count: n,
        average: total / n,
        maximum: max,
        minimum: min
    };
}

/* ============================================================
   INTERNAL HELPERS — typed arrays keep the hot loop allocation-free
   ============================================================ */

/** Arithmetic mean from a typed numeric array. */
export function meanOf(values: Float64Array): number {
    if (values.length === 0) return 0;
    let s = 0;
    for (let i = 0; i < values.length; i++) {
        s += values[i];
    }
    return s / values.length;
}

/** Sample variance (Bessel-corrected, n-1). */
export function varianceOf(values: Float64Array, mean: number): number {
    const n = values.length;
    if (n < 2) return 0;
    let acc = 0;
    for (let i = 0; i < n; i++) {
        const d = values[i] - mean;
        acc += d * d;
    }
    return acc / (n - 1);
}

/** Median via sort copy. Stable O(n log n). */
export function medianOf(values: Float64Array): number {
    const n = values.length;
    if (n === 0) return 0;
    const sorted = Float64Array.from(values).sort();
    const mid = n >> 1;
    if (n % 2 === 1) {
        return sorted[mid];
    }
    return (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Mode via a frequency sweep over a sorted copy. Returns the first mode. */
export function modeOf(values: Float64Array): number {
    const n = values.length;
    if (n === 0) return 0;
    const sorted = Float64Array.from(values).sort();
    let bestValue = sorted[0];
    let bestCount = 1;
    let curValue = sorted[0];
    let curCount = 1;
    for (let i = 1; i < n; i++) {
        if (sorted[i] === curValue) {
            curCount++;
            if (curCount > bestCount) {
                bestCount = curCount;
                bestValue = curValue;
            }
        } else {
            curValue = sorted[i];
            curCount = 1;
        }
    }
    return bestValue;
}

/** Fisher-Pearson skewness coefficient. */
export function skewnessOf(values: Float64Array, mean: number, stdDev: number): number {
    const n = values.length;
    if (n < 3 || stdDev === 0) return 0;
    let acc = 0;
    for (let i = 0; i < n; i++) {
        const d = (values[i] - mean) / stdDev;
        acc += d * d * d;
    }
    return acc / n;
}

/** Excess kurtosis (kurtosis - 3, so normal => 0). */
export function kurtosisOf(values: Float64Array, mean: number, stdDev: number): number {
    const n = values.length;
    if (n < 4 || stdDev === 0) return 0;
    let acc = 0;
    for (let i = 0; i < n; i++) {
        const d = (values[i] - mean) / stdDev;
        acc += d * d * d * d;
    }
    return acc / n - 3;
}

/**
 * Gini coefficient — measure of inequality for the distribution.
 * Uses the standard formula over a sorted copy:
 *   G = (sum_i (2i - n - 1) * x_i) / (n * sum_i x_i)
 * Result is 0 (perfect equality) to 1 (perfect inequality).
 * A Pareto distribution typically lands in the 0.4-0.7 range.
 */
export function giniOf(values: Float64Array): number {
    const n = values.length;
    if (n < 2) return 0;
    const sorted = Float64Array.from(values).sort();
    let sum = 0;
    for (let i = 0; i < n; i++) {
        sum += sorted[i];
    }
    if (sum === 0) return 0;
    let acc = 0;
    for (let i = 0; i < n; i++) {
        // i is 0-based; rank r = i + 1
        acc += (2 * (i + 1) - n - 1) * sorted[i];
    }
    return acc / (n * sum);
}

/** Max - min. */
export function rangeOf(values: Float64Array): number {
    if (values.length === 0) return 0;
    let max = Number.NEGATIVE_INFINITY;
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < values.length; i++) {
        if (values[i] > max) max = values[i];
        if (values[i] < min) min = values[i];
    }
    return max - min;
}

/* ============================================================
   ZERO SENTINELS — keep allocation minimal for empty inputs
   ============================================================ */

const ZERO_STATISTICS: Statistics = {
    mean: 0,
    median: 0,
    mode: 0,
    standardDeviation: 0,
    variance: 0,
    skewness: 0,
    kurtosis: 0,
    gini: 0,
    range: 0
};

const ZERO_TOTALS: Totals = {
    total: 0,
    count: 0,
    average: 0,
    maximum: 0,
    minimum: 0
};
