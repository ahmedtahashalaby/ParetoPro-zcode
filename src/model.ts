/**
 * Pareto Pro Enterprise — ViewModel Builder
 * -----------------------------------------
 * The composition root of the pure domain layer. Orchestrates the pipeline:
 *
 *   dataProcessor -> paretoEngine -> abcAnalysis -> statistics
 *                                                       |
 *                                            immutable ViewModel
 *
 * Strictly pure: accepts already-extracted inputs (no Power BI host here)
 * and emits the one immutable object every renderer will read from.
 *
 * @module    model
 * @version   1.0.0
 */

import powerbiVisualsApi from "powerbi-visuals-api";
import DataViewMetadata = powerbiVisualsApi.powerbi.DataViewMetadata;

import {
    ABCSummary,
    ParetoPoint,
    Settings,
    Statistics,
    Totals,
    ViewModel,
    VisualState,
    Layout
} from "./interfaces";
import { RawRow } from "./dataProcessor";
import { buildParetoPoints } from "./paretoEngine";
import { summarizeABC } from "./abcAnalysis";
import { computeStatistics, computeTotals } from "./statistics";
import { NORMAL_STATE } from "./errorHandler";
import { hashString } from "./utils";

/* ============================================================
   BUILD INPUTS
   ============================================================ */

export interface BuildInputs {
    readonly rows: ReadonlyArray<RawRow>;
    readonly hasHighlights: boolean;
    readonly settings: Settings;
    readonly layout: Layout;
    readonly metadata: DataViewMetadata;
    /** Visual state from the integrity gate. */
    readonly state: VisualState;
    /** Stability seed used to keep point keys reproducible across renders. */
    readonly seed?: number;
}

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Build an immutable ViewModel from the supplied inputs.
 *
 * Pure and synchronous; safe to memoize at the caller level. The caller is
 * expected to short-circuit before invoking when BuildInputs.state is an
 * unrecoverable edge-case state — those are surfaced by the visual root
 * directly. This builder assumes points can be produced.
 */
export function buildViewModel(inputs: BuildInputs): ViewModel {
    const {
        rows,
        hasHighlights,
        settings,
        layout,
        metadata,
        state
    } = inputs;

    const points: ParetoPoint[] = buildParetoPoints(rows, {
        thresholdA: settings.abcAnalysis.thresholdA,
        thresholdB: settings.abcAnalysis.thresholdB,
        useABCClassification: settings.abcAnalysis.enabled,
        hasHighlights
    });

    const totals: Totals = computeTotals(points);
    const statistics: Statistics = computeStatistics(points);
    const abcSummary: ABCSummary = summarizeABC(
        points,
        settings.abcAnalysis.thresholdA,
        settings.abcAnalysis.thresholdB
    );

    const signature = signatureFor(inputs, points.length);

    return {
        state: state || NORMAL_STATE,
        points,
        totals,
        statistics,
        abcSummary,
        settings,
        layout,
        hasHighlights,
        metadata,
        signature
    };
}

/* ============================================================
   SIGNATURE — used by performance.ts to detect "no change" calls
   ============================================================ */

function signatureFor(inputs: BuildInputs, pointCount: number): string {
    // Cheap, stable signature: row hash + layout hash + settings hash + count.
    // The renderer can compare signatures to skip the draw step entirely.
    const rows = inputs.rows;
    let head = "empty";
    let tail = "empty";
    let mid = "empty";
    if (rows.length > 0) {
        const h = rows[0];
        const t = rows[rows.length - 1];
        const m = rows[(rows.length >> 1)];
        head = `${h.category}:${h.value}:${h.isHighlighted ? "1" : "0"}`;
        tail = `${t.category}:${t.value}:${t.isHighlighted ? "1" : "0"}`;
        mid = `${m.category}:${m.value}:${m.isHighlighted ? "1" : "0"}`;
    }
    const layoutHash = `${inputs.layout.viewport.width}x${inputs.layout.viewport.height}`;
    const abcHash = `a${inputs.settings.abcAnalysis.thresholdA}/b${inputs.settings.abcAnalysis.thresholdB}/${inputs.settings.abcAnalysis.enabled ? "1" : "0"}`;
    const raw = `${rows.length}|${pointCount}|${head}|${tail}|${mid}|${layoutHash}|${abcHash}|${inputs.hasHighlights ? "hl" : "nohl"}`;
    return hashString(raw);
}
