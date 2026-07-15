/**
 * Pareto Pro Enterprise — Data Processor (Power BI DataView → Domain)
 * ---------------------------------------------------------------
 * Translates the Power BI categorical DataView into a flat list of
 * {@link RawRow} records the rest of the domain engine can compute on.
 *
 * Responsibilities:
 *   - Read the bound Category + Measure data roles.
 *   - Coerce values to finite numbers, distinguishing highlight data.
 *   - Preserve Power BI ISelectionId instances for cross-filtering.
 *   - Surface a normalized cross-highlight flag for the ViewModel.
 *
 * The processor never sorts, ranks, or classifies — that lives in the
 * downstream pareto/abc engines. It only *normalizes* the input.
 *
 * @module    dataProcessor
 * @version   1.0.0
 */

import powerbiVisualsApi from "powerbi-visuals-api";
import DataViewCategorical = powerbiVisualsApi.powerbi.DataViewCategorical;
import DataViewValueColumns = powerbiVisualsApi.powerbi.DataViewValueColumns;
import DataViewCategoryColumn = powerbiVisualsApi.powerbi.DataViewCategoryColumn;
import PrimitiveValue = powerbiVisualsApi.powerbi.PrimitiveValue;
import ISelectionId = powerbiVisualsApi.visuals.ISelectionId;
import IVisualHost = powerbiVisualsApi.extensibility.IVisualHost;

import { DATA_ROLES } from "./constants";

/* ============================================================
   DOMAIN ROW
   ============================================================ */

export interface RawRow {
    readonly category: string;
    readonly value: number;
    readonly highlightValue: number | null;
    readonly isHighlighted: boolean;
    readonly identity: ISelectionId;
}

export interface ProcessorResult {
    readonly rows: RawRow[];
    readonly hasHighlights: boolean;
    readonly measureDisplayName: string;
    readonly categoryDisplayName: string;
}

/* ============================================================
   PUBLIC API
   ============================================================ */

export function transform(
    categorical: DataViewCategorical | null | undefined,
    host: IVisualHost
): ProcessorResult {
    const empty: ProcessorResult = {
        rows: [],
        hasHighlights: false,
        measureDisplayName: "",
        categoryDisplayName: ""
    };
    if (!categorical) {
        return empty;
    }

    const categories = categorical.categories || [];
    const values = categorical.values;
    if (categories.length === 0 || !values || values.length === 0) {
        return empty;
    }

    const catColumn: DataViewCategoryColumn = categories[0];
    const catValues = catColumn ? catColumn.values : [];
    if (!catValues || catValues.length === 0) {
        return empty;
    }

    const measureCol = values[0];
    const measureValues: PrimitiveValue[] = measureCol ? measureCol.values : [];
    const highlightValues: PrimitiveValue[] =
        measureCol && (measureCol as unknown as { highlights?: PrimitiveValue[] }).highlights
            ? (measureCol as unknown as { highlights?: PrimitiveValue[] }).highlights as PrimitiveValue[]
            : [];

    const measureName = measureCol ? (measureCol.source ? measureCol.source.displayName : "") : "";
    const categoryName = catColumn.source ? catColumn.source.displayName : "";

    const rowCount = catValues.length;
    const rows: RawRow[] = new Array(rowCount);
    let anyHighlights = false;

    const identities = buildIdentities(catColumn, catValues, host);

    for (let i = 0; i < rowCount; i++) {
        const rawCat = catValues[i];
        const rawVal = measureValues[i];
        const highlightRaw = highlightValues.length > 0 ? highlightValues[i] : null;

        const category = stringifyCategory(rawCat);
        const value = coerceNumber(rawVal);
        const hasHighlight = highlightRaw !== null && highlightRaw !== undefined;
        const highlightValue = hasHighlight ? coerceNumber(highlightRaw) : null;
        if (hasHighlight) {
            anyHighlights = true;
        }

        rows[i] = {
            category,
            value,
            highlightValue,
            isHighlighted: hasHighlight,
            identity: identities[i]
        };
    }

    return {
        rows,
        hasHighlights: anyHighlights,
        measureDisplayName: measureName,
        categoryDisplayName: categoryName
    };
}

/* ============================================================
   INTERNAL HELPERS
   ============================================================ */

function coerceNumber(v: PrimitiveValue): number {
    if (typeof v === "number") {
        return Number.isFinite(v) ? v : 0;
    }
    if (v === null || v === undefined) {
        return 0;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function stringifyCategory(v: PrimitiveValue): string {
    if (v === null || v === undefined) {
        return "(Blank)";
    }
    if (typeof v === "string") {
        return v.length ? v : "(Blank)";
    }
    if (typeof v === "number" || typeof v === "boolean") {
        return String(v);
    }
    if (v instanceof Date) {
        return v.toISOString().slice(0, 10);
    }
    const obj = v as { __identity?: string; value?: unknown };
    if (obj && typeof obj.__identity === "string") {
        return obj.__identity;
    }
    if (obj && obj.value !== undefined) {
        return String(obj.value);
    }
    return "(Blank)";
}

function buildIdentities(
    catColumn: DataViewCategoryColumn,
    catValues: PrimitiveValue[],
    host: IVisualHost
): ISelectionId[] {
    const n = catValues.length;
    const result: ISelectionId[] = new Array(n);
    let builder: powerbiVisualsApi.extensibility.ISelectionIdBuilder | null = null;
    try {
        builder = host.createSelectionIdBuilder();
    } catch {
        builder = null;
    }

    for (let i = 0; i < n; i++) {
        let id: ISelectionId | null = null;
        if (builder && catColumn.source) {
            try {
                id = builder.withCategory(catColumn, i).createSelectionId();
            } catch {
                id = null;
            }
        }
        result[i] = id || nullId();
    }
    return result;
}

function nullId(): ISelectionId {
    return {
        equals: (): boolean => false,
        includes: (): boolean => false,
        getKey: (): string => "",
        getSqlLiteral: (): string => "",
        toJSON: (): unknown => null
    } as unknown as ISelectionId;
}

/* ============================================================
   FIELD PRESENCE
   ============================================================ */

export function hasCategoryAndMeasure(categorical: DataViewCategorical | null | undefined): boolean {
    if (!categorical) return false;
    const cats = categorical.categories || [];
    const vals = categorical.values;
    return cats.length > 0 && !!vals && valuesHasAtLeastOneNumeric(vals);
}

function valuesHasAtLeastOneNumeric(values: DataViewValueColumns): boolean {
    if (!values || values.length === 0) return false;
    for (let i = 0; i < values.length; i++) {
        const col = values[i];
        if (col && col.values) {
            return true;
        }
    }
    return false;
}

/* ============================================================
   SIGNATURE (for memoization keys)
   ============================================================ */

export function rowsSignature(rows: RawRow[], measureName: string): string {
    if (rows.length === 0) {
        return "empty";
    }
    const n = rows.length;
    const head = rows[0];
    const tail = rows[n - 1];
    const mid = rows[(n >> 1)];
    let s = `${n}|${measureName}|${head.category}|${head.value}|${tail.category}|${tail.value}|${mid.category}|${mid.value}`;
    if (rows.some(r => r.isHighlighted)) {
        s += "|hl";
    }
    return s;
}

export function areDataRolesBound(categorical: DataViewCategorical | null | undefined): boolean {
    return hasCategoryAndMeasure(categorical);
}

export const ROLES = DATA_ROLES;
