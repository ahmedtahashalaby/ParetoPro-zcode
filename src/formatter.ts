/**
 * Pareto Pro Enterprise — Value & Text Formatter
 * ----------------------------------------------
 * Locale-aware formatting for numbers, percentages, currency, and dates.
 *
 * Honors Power BI's display-unit choice from the Format pane
 * (Auto/None/K/M/B), a thousands-separator toggle, and a configurable
 * decimal-place count. Pure functions throughout — no host coupling,
 * fully unit-testable.
 *
 * @module    formatter
 * @version   1.0.0
 */

import { DisplayUnitMode } from "./interfaces";
import { NAMED_DISPLAY_UNIT_FACTORS } from "./constants";

/* ============================================================
   UNIT FACTORS & SUFFIXES
   ============================================================ */

const UNIT_FACTOR: Record<DisplayUnitMode, number> = {
    [DisplayUnitMode.Auto]: 0,
    [DisplayUnitMode.None]: 1,
    [DisplayUnitMode.Thousands]: NAMED_DISPLAY_UNIT_FACTORS.thousands,
    [DisplayUnitMode.Millions]: NAMED_DISPLAY_UNIT_FACTORS.millions,
    [DisplayUnitMode.Billions]: NAMED_DISPLAY_UNIT_FACTORS.billions
};

const UNIT_SUFFIX: Record<DisplayUnitMode, string> = {
    [DisplayUnitMode.Auto]: "",
    [DisplayUnitMode.None]: "",
    [DisplayUnitMode.Thousands]: "K",
    [DisplayUnitMode.Millions]: "M",
    [DisplayUnitMode.Billions]: "B"
};

/* ============================================================
   OPTIONS STRUCT (mirrors settings.ts AxesSettings subset)
   ============================================================ */

export interface FormatOptions {
    readonly displayUnits: DisplayUnitMode;
    readonly thousandsSeparator: boolean;
    readonly decimalPlaces: number;
    readonly locale?: string | null;
    readonly currency?: boolean;
    readonly isPercent?: boolean;
    readonly percentSuffix?: string;
}

const DEFAULT_OPTIONS: FormatOptions = {
    displayUnits: DisplayUnitMode.Auto,
    thousandsSeparator: true,
    decimalPlaces: 0,
    locale: "en-US",
    currency: false,
    isPercent: false,
    percentSuffix: "%"
};

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Format a numeric value into the user-facing short-form display string.
 * The result reflects display-unit compression and any chosen decimal
 * count. Nulls render as empty strings.
 *
 * @example format(1234567, { displayUnits: DisplayUnitMode.Auto }) // "1.23M"
 */
export function format(value: number | null | undefined, opts: Partial<FormatOptions> = {}): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return "";
    }
    const o: FormatOptions = Object.assign({}, DEFAULT_OPTIONS, opts);
    if (o.isPercent) {
        return formatPercent(value, o);
    }
    const { coeff, suffix, dp } = compress(value, o);
    return withSeparators(coeff.toFixed(dp), o.thousandsSeparator) + suffix;
}

/** Format a percentage value already expressed as 0–100. */
export function formatPercent(v: number, opts: Partial<FormatOptions> = {}): string {
    const o: FormatOptions = Object.assign({}, DEFAULT_OPTIONS, opts);
    if (!Number.isFinite(v)) {
        return "";
    }
    const dp = o.decimalPlaces > 0 ? o.decimalPlaces : 1;
    return `${withSeparators(v.toFixed(dp), o.thousandsSeparator)}${o.percentSuffix || "%"}`;
}

/** Format an integer rank without any unit compression. */
export function formatRank(rank: number): string {
    if (!Number.isFinite(rank)) {
        return "";
    }
    return String(Math.trunc(rank));
}

/** Format a number for CSV export — never locales the field. */
export function formatPlainNumber(value: number, decimalPlaces: number = 6): string {
    if (!Number.isFinite(value)) {
        return "";
    }
    return value.toFixed(decimalPlaces);
}

/** Escape a string for CSV (quotes, commas, newlines). */
export function formatCSVString(text: string): string {
    if (text == null) {
        return "";
    }
    const s = String(text);
    if (/[",\n]/.test(s)) {
        return `"${s.replace(/"/g, "\"\"")}"`;
    }
    return s;
}

/** Build a short axis-label hint indicating the active display unit, e.g. "(M)". */
export function displayUnitLabel(opts: FormatOptions): string {
    if (opts.displayUnits === DisplayUnitMode.None || opts.displayUnits === DisplayUnitMode.Auto) {
        return "";
    }
    return UNIT_SUFFIX[opts.displayUnits] ? `(${UNIT_SUFFIX[opts.displayUnits]})` : "";
}

/* ============================================================
   INTERNAL HELPERS
   ============================================================ */

interface CompressedValue {
    readonly coeff: number;
    readonly suffix: string;
    readonly dp: number;
}

/**
 * Compress `value` for display based on the chosen unit mode.
 * For Auto, the largest grouping under which the value is >= 1000 is picked.
 */
function compress(value: number, opts: FormatOptions): CompressedValue {
    const abs = Math.abs(value);
    const dp = opts.decimalPlaces > 0 ? opts.decimalPlaces : 0;

    // None, or Auto with value too small to compress.
    if (opts.displayUnits === DisplayUnitMode.None) {
        return { coeff: value, suffix: "", dp };
    }
    if (opts.displayUnits === DisplayUnitMode.Auto) {
        if (abs < 1000) {
            return { coeff: value, suffix: "", dp };
        }
        if (abs >= NAMED_DISPLAY_UNIT_FACTORS.billions) {
            return { coeff: value / NAMED_DISPLAY_UNIT_FACTORS.billions, suffix: "B", dp: dp === 0 ? 2 : dp };
        }
        if (abs >= NAMED_DISPLAY_UNIT_FACTORS.millions) {
            return { coeff: value / NAMED_DISPLAY_UNIT_FACTORS.millions, suffix: "M", dp: dp === 0 ? 2 : dp };
        }
        return { coeff: value / NAMED_DISPLAY_UNIT_FACTORS.thousands, suffix: "K", dp: dp === 0 ? 1 : dp };
    }

    // Explicit unit mode.
    const factor = UNIT_FACTOR[opts.displayUnits];
    const suffix = UNIT_SUFFIX[opts.displayUnits];
    return { coeff: value / factor, suffix, dp: dp === 0 ? 1 : dp };
}

/**
 * Insert thousands separators into a numeric string.
 * Manual insertion keeps the output deterministic (no Intl locale surprises).
 */
function withSeparators(intStr: string, enabled: boolean): string {
    if (!enabled) {
        return intStr;
    }
    const [intPart, fracPart] = intStr.split(".");
    const sign = intPart && intPart[0] === "-" ? "-" : "";
    const digits = sign ? intPart.slice(1) : intPart;
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    let result = sign + grouped;
    if (fracPart !== undefined && fracPart !== "") {
        result += "." + fracPart;
    }
    return result;
}
