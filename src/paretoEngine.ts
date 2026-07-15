/**
 * Pareto Pro Enterprise — Pareto Engine
 * -------------------------------------
 * The modeling heart of the visual: ranks, computes running totals,
 * and derives the cumulative percentage that defines the Pareto curve.
 *
 * Pure & idempotent: same input rows produce the same output points,
 * byte-for-byte. Single descending sort + one linear scan; O(n log n)
 * time, O(n) space.
 *
 * @module    paretoEngine
 * @version   1.0.0
 */

import { ABCClass, ParetoPoint } from "./interfaces";
import { RawRow } from "./dataProcessor";
import { sortByValueDesc, uniqueId } from "./utils";
import { classifyABC } from "./abcAnalysis";

/* ============================================================
   OPTIONS
   ============================================================ */

export interface ParetoEngineOptions {
    /** Cumulative-% threshold marking the A->B boundary (default 80). */
    readonly thresholdA: number;
    /** Cumulative-% threshold marking the B->C boundary (default 95). */
    readonly thresholdB: number;
    /** When true, classify each point using the ABC thresholds. */
    readonly useABCClassification: boolean;
    /** Whether the first column carries Power BI highlight metadata. */
    readonly hasHighlights: boolean;
}

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Transform a list of raw rows into fully ranked Pareto points.
 *
 * Algorithm:
 *   1. Sort rows by value descending (stable on ties).
 *   2. Compute the total once.
 *   3. Single linear pass to derive:
 *        - rank          (1-based index)
 *        - percent       (single-category share of total)
 *        - runningTotal  (sum through this row)
 *        - cumulativePct (runningTotal / total * 100)
 *        - variance       (value[i] - value[i-1]; 0 for the first)
 *        - abcClass       (derived from cumulativePct vs. thresholds)
 *   4. Stamp highlight state on each result.
 *
 * @param rows     Raw rows from dataProcessor.transform.
 * @param options  Engine options.
 * @returns        An array of immutable ParetoPoints, ranked descending.
 */
export function buildParetoPoints(
    rows: ReadonlyArray<RawRow>,
    options: ParetoEngineOptions
): ParetoPoint[] {
    if (rows.length === 0) {
        return [];
    }

    // 1. Stable descending sort.
    const ordered = sortByValueDesc(rows.slice(), r => r.value);

    // 2. Total — uses the effective value (highlight if available).
    let total = 0;
    for (let i = 0; i < ordered.length; i++) {
        total += effectiveValue(ordered[i], options.hasHighlights);
    }
    // Guard against an all-zero / non-positive aggregate; treat as 1 to avoid NaN.
    const denominator = total > 0 ? total : 1;

    // 3. Single pass to compute running totals + percentages + variance.
    const points = new Array<ParetoPoint>(ordered.length);
    let running = 0;
    let previousValue = 0;
    let hasPrevious = false;
    for (let i = 0; i < ordered.length; i++) {
        const row = ordered[i];
        const v = effectiveValue(row, options.hasHighlights);
        running += v;
        const percent = (v / denominator) * 100;
        const cumulativePercent = (running / denominator) * 100;
        const variance = hasPrevious ? v - previousValue : 0;

        const abcClass = options.useABCClassification
            ? classifyABC(cumulativePercent, options.thresholdA, options.thresholdB)
            : ABCClass.A; // If ABC is disabled, every bar gets the same nominal class.

        points[i] = {
            key: uniqueId("pt"),
            category: row.category,
            value: v,
            rank: i + 1,
            percent,
            cumulativePercent,
            runningTotal: running,
            abcClass,
            variance,
            isHighlight: row.isHighlighted,
            isSelected: false, // selection state is patched later (selection.ts)
            identity: row.identity
        };

        previousValue = v;
        hasPrevious = true;
    }

    return points;
}

/**
 * Count how many points fall within the Top-80% window, inclusive of
 * the boundary-straddling category. Used by the "Top 80%" KPI card.
 * Pure read-only over an already-built point array.
 */
export function countTop80(points: ReadonlyArray<ParetoPoint>): number {
    let count = 0;
    for (let i = 0; i < points.length; i++) {
        count++;
        if (points[i].cumulativePercent >= 80) {
            break;
        }
    }
    // When the data has zero points, count stays 0.
    // Include the boundary "first-met-or-exceeded" category once.
    return count;
}

/* ============================================================
   HELPERS
   ============================================================ */

/**
 * Determine which value to use for a row when highlights are active.
 * If the visual is in cross-filter mode, the highlight represents the
 * post-filter subset; we use that to drive the Pareto curve so the chart
 * surfaces the filtered subset rather than the universe.
 */
function effectiveValue(row: RawRow, hasHighlights: boolean): number {
    if (!hasHighlights) {
        return row.value;
    }
    return row.highlightValue != null ? row.highlightValue : 0;
}
