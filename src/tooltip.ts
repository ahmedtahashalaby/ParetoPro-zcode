/**
 * Pareto Pro Enterprise — Tooltip Service Integration
 * ---------------------------------------------------
 * Builds and shows / hides Power BI tooltips via the host's
 * {@link ITooltipService}. Honors per-field toggles so the user can
 * decide which tooltip rows appear (Category, Value, %, Running Total,
 * ABC, Rank, Difference, Average).
 *
 * Uses the older TooltipDataItem[] API (still the supported path for
 * static visuals) — supportsEnhancedTooltips is enabled in capabilities,
 * so multi-row HTML tooltips render natively in the host.
 *
 * @module    tooltip
 * @version   1.0.0
 */

import powerbiVisualsApi from "powerbi-visuals-api";
import TooltipDataItem = powerbiVisualsApi.extensibility.TooltipDataItem;
import ISelectionId = powerbiVisualsApi.visuals.ISelectionId;
import ITooltipService = powerbiVisualsApi.extensibility.ITooltipService;

import { ParetoPoint, Settings, Totals, TooltipSettings, ABCClass } from "./interfaces";
import { FormatOptions, format, formatPercent, formatRank } from "./formatter";

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Show the tooltip for a Pareto point.
 *
 * @param service      Host tooltip service.
 * @param point        The Pareto point behind the hovered bar/marker.
 * @param totals       Totals used to derive the "Average" tooltip row.
 * @param settings     Active Settings — selects which tooltip rows show.
 * @param screenCoords  Pointer coordinates in the host's coordinate space.
 * @param identity      Selection id of the hovered point (used to anchor
 *                       cross-filter / drill behaviors in the host).
 */
export function showTooltip(
    service: ITooltipService,
    point: ParetoPoint,
    totals: Totals,
    settings: Settings,
    screenCoords: { x: number; y: number },
    identity: ISelectionId
): void {
    const items = buildTooltipItems(point, totals, settings.tooltip, settings);
    service.show({
        coordinates: screenCoords,
        dataItems: items,
        identities: [identity],
        isTouchEvent: false
    });
}

/** Hide whatever tooltip is currently visible. */
export function hideTooltip(service: ITooltipService): void {
    service.hide();
}

/* ============================================================
   INTERNAL — build the data rows
   ============================================================ */

function buildTooltipItems(
    point: ParetoPoint,
    totals: Totals,
    toggles: TooltipSettings,
    settings: Settings
): TooltipDataItem[] {
    const fmtOpts: FormatOptions = {
        displayUnits: settings.axes.displayUnits,
        thousandsSeparator: settings.axes.thousandsSeparator,
        decimalPlaces: settings.axes.decimalPlaces
    };

    const items: TooltipDataItem[] = [];

    if (toggles.showCategory) {
        items.push(row("Category", point.category));
    }
    if (toggles.showValue) {
        items.push(row("Value", format(point.value, fmtOpts)));
    }
    if (toggles.showPercent) {
        items.push(row("% of Total", formatPercent(point.percent, fmtOpts)));
    }
    if (toggles.showRunningTotal) {
        items.push(row("Running Total", format(point.runningTotal, fmtOpts)));
    }
    if (toggles.showABC) {
        items.push(row("ABC", abcLabel(point.abcClass)));
    }
    if (toggles.showRank) {
        items.push(row("Rank", formatRank(point.rank)));
    }
    if (toggles.showDifference) {
        items.push(row("Difference vs Previous", format(point.variance, fmtOpts)));
    }
    if (toggles.showAverage) {
        items.push(row("Average", format(totals.average, fmtOpts)));
    }
    // Always include a cumulative % row for clarity, even if it isn't a
    // toggle — the tooltip is the primary place users see the running %.
    items.push(row("Cumulative %", formatPercent(point.cumulativePercent, fmtOpts)));

    return items;
}

function row(displayName: string, value: string): TooltipDataItem {
    return {
        displayName,
        value,
        header: "",
        color: "",
        opacity: 1
    };
}

function abcLabel(cls: ABCClass): string {
    switch (cls) {
        case ABCClass.A: return "A  —  Vital few";
        case ABCClass.B: return "B  —  Intermediate";
        case ABCClass.C: return "C  —  Trivial many";
        default:
            return cls;
    }
}
