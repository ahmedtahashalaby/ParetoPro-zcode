/**
 * Pareto Pro Enterprise — ABC Analysis
 * ------------------------------------
 * Classifies Pareto points into A/B/C classes using the cumulative-
 * percentage thresholds configured in the format pane.
 *
 *   Class A  — the "vital few" driving the largest cumulative share
 *              (cumulative% <= thresholdA, default 80)
 *   Class B  — the intermediate group (thresholdA < cumulative% <= thresholdB, default 95)
 *   Class C  — the "trivial many" trailing remainder (cumulative% >  thresholdB)
 *
 * The classifier is a pure function over a single cumulative percentage,
 * so it composes cleanly with {@link paretoEngine.buildParetoPoints}.
 *
 * @module    abcAnalysis
 * @version   1.0.0
 */

import {
    ABCClass,
    ABCClassSummary,
    ABCSummary,
    ParetoPoint
} from "./interfaces";
import { ABC_CLASS_ORDER } from "./constants";

/* ============================================================
   CLASSIFICATION — single-point pure function
   ============================================================ */

/**
 * Classify one point's cumulative percentage into A/B/C.
 *
 * The boundary semantics: a point's cumulative% falls into class A while
 * it is at or below thresholdA. Once cumulative% crosses thresholdA, the
 * *current* point is the first class-B contributor. Once cumulative% crosses
 * thresholdB, the current point is the first class-C contributor.
 *
 * @param cumulativePercent  Cumulative percentage for the point (0..100).
 * @param thresholdA          Class A boundary (e.g. 80). Must be < thresholdB.
 * @param thresholdB          Class B boundary (e.g. 95). Must be > thresholdA.
 * @returns                   The inclusive class for this point.
 */
export function classifyABC(
    cumulativePercent: number,
    thresholdA: number,
    thresholdB: number
): ABCClass {
    if (cumulativePercent <= thresholdA) {
        return ABCClass.A;
    }
    if (cumulativePercent <= thresholdB) {
        return ABCClass.B;
    }
    return ABCClass.C;
}

/* ============================================================
   SUMMARIZATION — pure read over the point list
   ============================================================ */

/**
 * Build a per-class summary (counts + shares) from an array of Pareto
 * points whose `abcClass` fields have already been set by the engine.
 *
 * The summary honors:
 *   - count         = how many points land in this class
 *   - countPercent  = count / total count  * 100
 *   - valuePercent  = sum of value in this class / grand total * 100
 *
 * @param points        The full Pareto point array (ranked desc).
 * @param thresholdA     Resolved A->B threshold (for the returned summary).
 * @param thresholdB     Resolved B->C threshold.
 * @returns              An {@link ABCSummary}.
 */
export function summarizeABC(
    points: ReadonlyArray<ParetoPoint>,
    thresholdA: number,
    thresholdB: number
): ABCSummary {
    const grand = sumOfValues(points);
    const safeGrand = grand > 0 ? grand : 1;
    const total = points.length;
    const safeTotal = total > 0 ? total : 1;

    const counts: Record<ABCClass, number> = {
        [ABCClass.A]: 0,
        [ABCClass.B]: 0,
        [ABCClass.C]: 0
    };
    const values: Record<ABCClass, number> = {
        [ABCClass.A]: 0,
        [ABCClass.B]: 0,
        [ABCClass.C]: 0
    };

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        counts[p.abcClass] = (counts[p.abcClass] || 0) + 1;
        values[p.abcClass] = (values[p.abcClass] || 0) + p.value;
    }

    const classes: ABCClassSummary[] = ABC_CLASS_ORDER.map(cls => ({
        className: cls,
        count: counts[cls],
        countPercent: (counts[cls] / safeTotal) * 100,
        valuePercent: (values[cls] / safeGrand) * 100
    }));

    return {
        classes,
        thresholdA,
        thresholdB
    };
}

/* ============================================================
   HELPERS
   ============================================================ */

function sumOfValues(points: ReadonlyArray<ParetoPoint>): number {
    let total = 0;
    for (let i = 0; i < points.length; i++) {
        total += points[i].value;
    }
    return total;
}
