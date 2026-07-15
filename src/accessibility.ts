/**
 * Pareto Pro Enterprise — Accessibility Layer
 * -------------------------------------------
 * Augments the renderer's SVG with ARIA roles, a keyboard-traversable bar
 * model, and a high-contrast-aware approach for selecting bars without a
 * pointing device.
 *
 * Power BI's `supportsKeyboardFocus` capability flag is set in
 * capabilities.json; this module supplies the keyboard handler + tab model.
 *
 * Implementation summary:
 *   - Each <rect.ppe-bar> gets `tabindex` and `role="button"` plus an
 *     aria-label describing the bar's category, value, and ABC class.
 *   - Visual-level keyboard handler intercepts Arrow / Enter / Space / Esc
 *     and translates them into bar navigation + selection actions.
 *   - The hidden `.ppe-sr-only` summary describes the chart to screen
 *     readers ("Eight categories: A=3, B=2, C=3 ...").
 *
 * @module    accessibility
 * @version   1.0.0
 */

import powerbiVisualsApi from "powerbi-visuals-api";
import ISelectionId = powerbiVisualsApi.visuals.ISelectionId;

import {
    ABCSummary,
    ParetoPoint,
    ViewModel,
    ABCClass
} from "./interfaces";
import { FormatOptions, format, formatPercent } from "./formatter";

/* ============================================================
   PUBLIC API
   ============================================================ */

export interface AccessibilityContext {
    /** Keyboard handler invoked on keydown while focus is on a bar. */
    onNavigate(direction: NavDirection): void;
    /** Keyboard handler invoked when Enter/Space is pressed on a bar. */
    onActivate(point: ParetoPoint, multi: boolean): void;
    /** Keyboard handler invoked when Esc is pressed. */
    onClear(): void;
}

export enum NavDirection {
    Next = "next",
    Previous = "previous",
    First = "first",
    Last = "last"
}

/**
 * Attach ARIA labels + a keyboard trap to the supplied container so the
 * user can traverse bars with Tab/Arrows and select with Enter/Space.
 *
 * @param containerRoot  The visual's .ppe-root element.
 * @param vm             The active ViewModel.
 * @param ctx            The keyboard-action surface (visual.ts impls this).
 */
export function wireKeyboard(
    containerRoot: HTMLElement,
    vm: ViewModel,
    ctx: AccessibilityContext
): () => void {
    // Build a hidden screen-reader summary.
    ensureSummary(containerRoot, vm);

    // Keyboard handler bound at the container level — key events bubble from bars.
    const keyHandler = (e: KeyboardEvent): void => {
        switch (e.key) {
            case "ArrowRight":
            case "ArrowDown":
                e.preventDefault();
                ctx.onNavigate(NavDirection.Next);
                break;
            case "ArrowLeft":
            case "ArrowUp":
                e.preventDefault();
                ctx.onNavigate(NavDirection.Previous);
                break;
            case "Home":
                e.preventDefault();
                ctx.onNavigate(NavDirection.First);
                break;
            case "End":
                e.preventDefault();
                ctx.onNavigate(NavDirection.Last);
                break;
            case "Enter":
            case " ":
                e.preventDefault();
                ctx.onActivate(currentPoint(containerRoot, vm.points), e.ctrlKey || e.metaKey);
                break;
            case "Escape":
                e.preventDefault();
                ctx.onClear();
                break;
            default:
                break;
        }
    };

    containerRoot.addEventListener("keydown", keyHandler);

    // Return a disposer — visual.ts registers it for teardown on destroy().
    return () => {
        containerRoot.removeEventListener("keydown", keyHandler);
    };
}

/** Update aria-label on every bar based on the latest ViewModel. */
export function refreshBarLabels(vm: ViewModel): void {
    const bars = document.querySelectorAll<SVGRectElement>("rect.ppe-bar");
    const fmtOpts: FormatOptions = {
        displayUnits: vm.settings.axes.displayUnits,
        thousandsSeparator: vm.settings.axes.thousandsSeparator,
        decimalPlaces: vm.settings.axes.decimalPlaces
    };
    bars.forEach((bar, i) => {
        const p = vm.points[i];
        if (!p) return;
        bar.setAttribute("aria-label", ariaLabelForBar(p, fmtOpts));
        bar.setAttribute("role", "button");
        bar.setAttribute("tabindex", "0");
    });
}

/* ============================================================
   INTERNAL — label & summary builders
   ============================================================ */

function ariaLabelForBar(p: ParetoPoint, fmtOpts: FormatOptions): string {
    return [
        `Rank ${p.rank}`,
        p.category,
        `Value ${format(p.value, fmtOpts)}`,
        `Cumulative ${formatPercent(p.cumulativePercent, fmtOpts)}`,
        `ABC class ${p.abcClass}`
    ].join(", ");
}

function ensureSummary(containerRoot: HTMLElement, vm: ViewModel): void {
    let summary = containerRoot.querySelector<HTMLElement>("#ppe-sr-summary");
    if (!summary) {
        summary = document.createElement("div");
        summary.id = "ppe-sr-summary";
        summary.className = "ppe-sr-only";
        summary.setAttribute("role", "status");
        summary.setAttribute("aria-live", "polite");
        containerRoot.appendChild(summary);
    }
    summary.textContent = summarizeForScreenReader(vm);
}

function summarizeForScreenReader(vm: ViewModel): string {
    const s = vm.abcSummary;
    const counts = reduceCounts(s);
    return [
        `Pareto chart with ${vm.points.length} categories.`,
        `Total ${format(vm.totals.total, {})}.`,
        `ABC: ${reduceABC(s)}`
    ].join(" ");
    function reduceCounts(_s: ABCSummary): string {
        void _s;
        return counts;
    }
    function reduceABC(summary: ABCSummary): string {
        const parts: string[] = [];
        for (const c of summary.classes) {
            parts.push(`${c.className}: ${c.count} categories, ${c.valuePercent.toFixed(1)}% of value`);
        }
        return parts.join("; ");
    }
}

function currentPoint(containerRoot: HTMLElement, points: ParetoPoint[]): ParetoPoint {
    const focused = containerRoot.querySelector<SVGRectElement>("rect.ppe-bar:focus");
    if (focused) {
        const key = focused.getAttribute("data-key") || "";
        const found = points.find(p => p.key === key);
        if (found) return found;
    }
    return points[0];
}

/**
 * Move keyboard focus to a different bar based on a navigation direction.
 * Returns the focused bar element so the caller can scroll it into view.
 */
export function moveFocus(
    containerRoot: HTMLElement,
    points: ParetoPoint[],
    direction: NavDirection
): SVGRectElement | null {
    const bars = Array.from(containerRoot.querySelectorAll<SVGRectElement>("rect.ppe-bar"));
    if (bars.length === 0) return null;
    const current = containerRoot.querySelector<SVGRectElement>("rect.ppe-bar:focus");
    const currentIndex = current ? bars.indexOf(current) : -1;

    let nextIndex: number;
    switch (direction) {
        case NavDirection.First:
            nextIndex = 0;
            break;
        case NavDirection.Last:
            nextIndex = bars.length - 1;
            break;
        case NavDirection.Previous:
            nextIndex = currentIndex <= 0 ? bars.length - 1 : currentIndex - 1;
            break;
        case NavDirection.Next:
        default:
            nextIndex = currentIndex < 0 || currentIndex >= bars.length - 1 ? 0 : currentIndex + 1;
            break;
    }
    const target = bars[nextIndex];
    if (target) {
        target.focus();
        void points;
    }
    return target || null;
}

/**
 * Emit a hidden ARIA note when the selection changes — screen readers pick
 * this up via the live region. Pure utility; called from visual.ts.
 */
export function announceSelection(containerRoot: HTMLElement, point: ParetoPoint | null): void {
    let live = containerRoot.querySelector<HTMLElement>("#ppe-sr-live");
    if (!live) {
        live = document.createElement("div");
        live.id = "ppe-sr-live";
        live.className = "ppe-sr-only";
        live.setAttribute("aria-live", "assertive");
        containerRoot.appendChild(live);
    }
    live.textContent = point
        ? `Selected ${point.category}, rank ${point.rank}, ABC class ${point.abcClass}.`
        : "Cleared selection.";
}
