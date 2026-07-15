/**
 * Pareto Pro Enterprise — Generic Utilities
 * -----------------------------------------
 * Pure helpers for colors, geometry, DOM, IDs, arrays, and class
 * composition. No module-level state — every export is a pure function.
 *
 * @module    utils
 * @version   1.0.0
 */

import * as d3Scale from "d3-scale";
import * as d3Color from "d3-color";

import { DashStyle } from "./interfaces";
import { DASH_PATTERNS } from "./constants";

/* ============================================================
   ID & KEYS
   ============================================================ */

/**
 * A monotonically increasing counter scoped to this module — safe for
 * generating visual-internal ids without depending on crypto.
 */
let idCounter = 0;

/** Produce a unique DOM-safe id with a supplied prefix. Thread-safe per visual. */
export function uniqueId(prefix: string): string {
    idCounter = (idCounter + 1) % 1e9;
    return `${prefix}-${idCounter.toString(36)}`;
}

/** Reset the id counter — useful for deterministic tests. */
export function resetUniqueId(): void {
    idCounter = 0;
}

/* ============================================================
   CLASS COMPOSITION
   ============================================================ */

/**
 * Filter an object of class keys → booleans into a class string.
 * @example classnames({ "ppe-bar": true, "ppe-bar--dimmed": isDimmed })
 */
export function classnames(classes: Record<string, boolean | null | undefined>): string {
    const out: string[] = [];
    for (const key in classes) {
        if (classes[key]) {
            out.push(key);
        }
    }
    return out.join(" ");
}

/* ============================================================
   ARRAYS
   ============================================================ */

/** Stable numeric sort: descending — used by the Pareto engine's sort step. */
export function sortByValueDesc<T>(arr: T[], valueOf: (item: T) => number): T[] {
    // Decorate–Sort–Undecorate keeps stable order on ties.
    const decorated = arr.map((x, i) => ({ v: valueOf(x), i, x }));
    decorated.sort((a, b) => {
        if (b.v !== a.v) return b.v - a.v;
        return a.i - b.i; // stable on ties
    });
    return decorated.map(d => d.x);
}

/** Sum an iterable of numbers; ignores null/undefined/non-finite entries. */
export function sum(values: Iterable<number>): number {
    let total = 0;
    for (const v of values) {
        if (Number.isFinite(v)) {
            total += v;
        }
    }
    return total;
}

/** Map an iterable into an array. */
export function toList<T>(xs: Iterable<T>): T[] {
    return Array.from(xs);
}

/** Clamp `v` to [min, max]. */
export function clamp(v: number, min: number, max: number): number {
    if (v < min) return min;
    if (v > max) return max;
    return v;
}

/** Round `v` to `dp` decimal places (defaults to 2). */
export function round(v: number, dp: number = 2): number {
    if (!Number.isFinite(v)) return 0;
    const m = Math.pow(10, dp);
    return Math.round(v * m) / m;
}

/* ============================================================
   COLOR HELPERS — built on d3-color
   ============================================================ */

/** Average compute color lightness (0..1) using d3-color lab conversion. */
export function colorLightness(hex: string): number {
    try {
        const c = d3Color.lab(d3Color.rgb(hex));
        return c.l / 100;
    } catch {
        return 0.5;
    }
}

/** Compute a readable contrast color (black or white) for a hex background. */
export function readableOn(hex: string): string {
    return colorLightness(hex) > 0.55 ? "#242424" : "#ffffff";
}

/** Lighten (T>0) or darken (T<0) a hex color by amount -1..1 (clamped). */
export function adjustColor(hex: string, amount: number): string {
    const t = clamp(amount, -1, 1);
    const c = d3Color.rgb(hex);
    if (!c) {
        return hex;
    }
    const target = t < 0 ? 0 : 255;
    const k = Math.abs(t);
    const r = Math.round(c.r + (target - c.r) * k);
    const g = Math.round(c.g + (target - c.g) * k);
    const b = Math.round(c.b + (target - c.b) * k);
    return d3Color.rgb(r, g, b).formatHex();
}

/** Build an interpolation function across a color array (d3-scale). */
export function colorScale(domainColors: string[]): (t: number) => string {
    return d3Scale.scaleLinear<string>()
        .domain(domainColors.map((_, i) => i / (domainColors.length - 1 || 1)))
        .range(domainColors)
        .interpolate(d3Scale.interpolateRgb) as (t: number) => string;
}

/** Build an SVG linear gradient definition string for [start,end]. */
export function gradientStops(start: string, end: string): string {
    return `${start}, ${end}`;
}

/* ============================================================
   DASH STYLE → SVG
   ============================================================ */

export function dashArray(style: DashStyle): string {
    return DASH_PATTERNS[style];
}

/** Convert a percentage-as-integer (e.g. 80) to a decimal (0.80). */
export function pctToDecimal(p: number): number {
    return p / 100;
}

/* ============================================================
   GEOMETRY
   ============================================================ */

/**
 * Build a Cardinal-spline-like smooth path for the Pareto line.
 * Uses Catmull-Rom → cubic bezier conversion.
 *
 * @param points Array of [x,y] pairs, already scaled.
 * @param tension ∈ [0,1]; 0.5 is the conventional smooth default.
 * @returns An SVG path "d" string.
 */
export function catmullRomPath(points: Array<[number, number]>, tension: number = 0.5): string {
    if (!points.length) {
        return "";
    }
    if (points.length === 1) {
        return `M ${points[0][0]},${points[0][1]}`;
    }
    if (points.length === 2) {
        return `M ${points[0][0]},${points[0][1]} L ${points[1][0]},${points[1][1]}`;
    }

    const t = clamp(tension, 0, 1);
    let d = `M ${points[0][0]},${points[0][1]}`;

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i - 1] || points[i];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;

        const c1x = p1[0] + (p2[0] - p0[0]) * t / 6;
        const c1y = p1[1] + (p2[1] - p0[1]) * t / 6;
        const c2x = p2[0] - (p3[0] - p1[0]) * t / 6;
        const c2y = p2[1] - (p3[1] - p1[1]) * t / 6;

        d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
    return d;
}

/**
 * Convert a smooth path string to a polyline path (no Bezier).
 * @param points Scaled points.
 */
export function straightPath(points: Array<[number, number]>): string {
    if (!points.length) return "";
    let d = `M ${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i][0]},${points[i][1]}`;
    }
    return d;
}

/* ============================================================
   DOM / SVG
   ============================================================ */

/** Remove all children of an SVG or HTML element. */
export function clearChildren(node: HTMLElement | SVGElement): void {
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}

/**
 * Ensures a child SVG container group exists for a given id under `parent`,
 * creating it with optional <g> attrs if missing. Returns the <g> element
 * (typed as SVGGElement when SVG, HTMLElement when HTML).
 */
export function ensureGroup(parent: SVGElement | HTMLElement, id: string, isHTML: boolean = false): SVGElement | HTMLElement {
    let child = parent.querySelector<HTMLInputElement | SVGElement>(`#${id}`);
    if (!child) {
        if (isHTML) {
            child = document.createElement("div");
        } else {
            child = document.createElementNS("http://www.w3.org/2000/svg", "g");
        }
        child.setAttribute("id", id);
        parent.appendChild(child);
    }
    return child;
}

/* ============================================================
   STRINGS / FORMATTING LOCALE HELP (no side effects)
   ============================================================ */

/** Light, deterministic CSV escaping for a single field value. */
export function csvEscape(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
        return "";
    }
    const s = String(value);
    if (s.indexOf(",") >= 0 || s.indexOf("\"") >= 0 || s.indexOf("\n") >= 0) {
        return `"${s.replace(/"/g, "\"\"")}"`;
    }
    return s;
}

/** A stable hash for cache keys (djb2) over a string input. */
export function hashString(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h) + s.charCodeAt(i);
        h = h & 0xffffffff;
    }
    // Convert signed 32-bit to unsigned hex.
    return (h >>> 0).toString(16);
}

/* ============================================================
   DEBOUNCE (used by resize handlers)
   ============================================================ */

/** Debounced wrapper. Cancel via the returned cancel function. */
export function debounce<A extends unknown[]>(
    fn: (...args: A) => void,
    wait: number
): {
    (...args: A): void;
    cancel(): void;
    flush(): void;
} {
    let timer: number | null = null;
    let lastArgs: A | null = null;
    const wrapped = function (...args: A): void {
        lastArgs = args;
        if (timer !== null) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            timer = null;
            if (lastArgs) {
                fn(...lastArgs);
            }
        }, wait) as unknown as number;
    };
    (wrapped as unknown as { cancel: () => void }).cancel = () => {
        if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
        }
    };
    (wrapped as unknown as { flush: () => void }).flush = () => {
        if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
            if (lastArgs) {
                fn(...lastArgs);
            }
        }
    };
    return wrapped as unknown as {
        (...args: A): void;
        cancel(): void;
        flush(): void;
    };
}
