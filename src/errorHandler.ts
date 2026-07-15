/**
 * Pareto Pro Enterprise — Centralized Error & Edge-Case Handling
 * --------------------------------------------------------------
 * The integrity gate that runs before any domain computation.
 * It inspects the Power BI update options, classifies the visual state,
 * and short-circuits rendering into a graceful, non-crashing branch when
 * the data cannot support a Pareto analysis.
 *
 * Also acts as a global try/catch rail: any throw from the domain or
 * rendering tier is intercepted by {@link tryRun} and surfaced as a
 * VisualState so the visual always renders something coherent.
 *
 * @module    errorHandler
 * @version   1.0.0
 */

import powerbiVisualsApi from "powerbi-visuals-api";
import VisualUpdateOptions = powerbiVisualsApi.extensibility.visual.VisualUpdateOptions;

import {
    VisualState,
    VisualStateKind
} from "./interfaces";

/* ============================================================
   STATE STENCILS — keep copy centralized for consistent copy
   ============================================================ */

const STATE_MESSAGES: Record<VisualStateKind, { title: string; message: string; recoverable: boolean }> = {
    [VisualStateKind.Normal]: {
        title: "",
        message: "",
        recoverable: true
    },
    [VisualStateKind.NoData]: {
        title: "No data available",
        message: "Drag a Category and a Measure into the visual fields to build a Pareto analysis.",
        recoverable: false
    },
    [VisualStateKind.MissingField]: {
        title: "Bind a category and a measure",
        message: "Pareto Pro Enterprise needs a grouping field (Category) and at least one numeric measure (Measure).",
        recoverable: false
    },
    [VisualStateKind.SingleCategory]: {
        title: "Only one category",
        message: "A Pareto distribution requires multiple categories. Add more rows or change the grouping.",
        recoverable: true
    },
    [VisualStateKind.NullValues]: {
        title: "All values are empty",
        message: "The bound measure returned no numeric values for these categories. Try a different measure or check for null filters.",
        recoverable: false
    },
    [VisualStateKind.NegativeValues]: {
        title: "Negative values detected",
        message: "Pareto analysis is undefined for negative values. Use absolute values or filter out negatives.",
        recoverable: true
    },
    [VisualStateKind.LargeDataset]: {
        title: "Large dataset",
        message: "The dataset is large; rendering has been virtualized for performance.",
        recoverable: true
    },
    [VisualStateKind.Error]: {
        title: "Something went wrong",
        message: "An unexpected error occurred while rendering the visual. Please refresh the report or try again.",
        recoverable: false
    }
};

/** Construct a typed VisualState from its kind. */
export function forState(kind: VisualStateKind): VisualState {
    const stencil = STATE_MESSAGES[kind];
    return {
        kind,
        title: stencil.title,
        message: stencil.message,
        recoverable: stencil.recoverable
    };
}

/** A Normal state sentinel — used when validation passes cleanly. */
export const NORMAL_STATE: VisualState = forState(VisualStateKind.Normal);

/* ============================================================
   INTEGRITY GATE
   ============================================================ */

/**
 * A reading extracted from the dataView. It is kept as number/array
 * tuples to keep this module free of imports beyond api types.
 */
export interface IntegrityReading {
    readonly hasDataView: boolean;
    readonly hasCategories: boolean;
    readonly hasMeasure: boolean;
    readonly categoryCount: number;
    readonly valueCount: number;
    readonly anyNulls: boolean;
    readonly anyNegatives: boolean;
    readonly anyPositive: boolean;
}

/**
 * Decide whether the supplied options can produce a usable Pareto view
 * model. Pure and side-effect free — only reads from `options`.
 *
 * @returns A {@link VisualState}. {@link VisualStateKind.Normal} when the
 *          visual may render; otherwise an explanatory degenerate state.
 */
export function classifyState(reading: IntegrityReading): VisualState {
    if (!reading.hasDataView) {
        return forState(VisualStateKind.NoData);
    }
    if (!reading.hasCategories && !reading.hasMeasure) {
        return forState(VisualStateKind.MissingField);
    }
    if (!reading.hasMeasure) {
        return forState(VisualStateKind.MissingField);
    }
    if (reading.categoryCount === 0 || !reading.hasCategories) {
        return forState(VisualStateKind.NoData);
    }
    if (reading.categoryCount === 1) {
        return forState(VisualStateKind.SingleCategory);
    }
    if (!reading.anyPositive && reading.anyNulls) {
        return forState(VisualStateKind.NullValues);
    }
    if (reading.anyNegatives && reading.valueCount > 0) {
        return forState(VisualStateKind.NegativeValues);
    }
    return NORMAL_STATE;
}

/**
 * Run an operation and convert any throw into an Error VisualState.
 * Module callers use this to wrap risky composition (dataView parsing,
 * render orchestration). The error itself is logged to the host so a
 * report author can reproduce it.
 *
 * @param label    Short label identifying the operation (for logging).
 * @param host     The visual host — used to log on failure.
 * @param operation The synchronous operation to run.
 * @returns Either the operation result or an Error {@link VisualState}.
 */
export function tryRun<T>(
    label: string,
    operation: () => T
): T | VisualState {
    try {
        return operation();
    } catch (err) {
        // Swallow and degrade — never crash the report.
        const detail = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error(`[ParetoProEnterprise] ${label} failed: ${detail}`);
        return {
            kind: VisualStateKind.Error,
            title: "Something went wrong",
            message: `${label}: ${detail}`,
            recoverable: false
        };
    }
}

/**
 * Inspect a Power BI options object and build an {@link IntegrityReading}
 * describing what the visual can do with it.
 *
 * This function is intentionally tolerant — it must never throw.
 */
export function readIntegrity(options: VisualUpdateOptions): IntegrityReading {
    const empty: IntegrityReading = {
        hasDataView: false,
        hasCategories: false,
        hasMeasure: false,
        categoryCount: 0,
        valueCount: 0,
        anyNulls: false,
        anyNegatives: false,
        anyPositive: false
    };
    try {
        const views = options && options.dataViews ? options.dataViews : [];
        if (!views.length) {
            return empty;
        }
        const dv = views[0];
        if (!dv) {
            return empty;
        }
        const cat = dv.categorical ? dv.categorical.categories : null;
        const hasCat = !!(cat && cat.length > 0);
        const catValues = hasCat ? cat[0].values : [];
        const catCount = catValues.length;

        const vals = dv.categorical ? dv.categorical.values : null;
        const hasMeasure = !!(vals && vals.length > 0);
        let valueCount = 0;
        let anyNulls = false;
        let anyNegatives = false;
        let anyPositive = false;
        if (vals && vals.length > 0) {
            // Iterate the first bound measure (the Pareto value).
            const col = vals[0];
            const arr = col ? col.values : null;
            if (arr) {
                for (const v of arr) {
                    if (v === null || v === undefined) {
                        anyNulls = true;
                        continue;
                    }
                    const n = typeof v === "number" ? v : Number(v);
                    if (!isFinite(n)) {
                        anyNulls = true;
                        continue;
                    }
                    valueCount++;
                    if (n < 0) {
                        anyNegatives = true;
                    } else if (n > 0) {
                        anyPositive = true;
                    }
                }
            }
        }
        const hasDataview = true;
        return {
            hasDataView: hasDataview,
            hasCategories: hasCat,
            hasMeasure: hasMeasure,
            categoryCount: catCount,
            valueCount,
            anyNulls,
            anyNegatives,
            anyPositive
        };
    } catch {
        return empty;
    }
}
