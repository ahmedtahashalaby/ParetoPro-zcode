/**
 * Pareto Pro Enterprise — Responsive Layout Engine
 * ------------------------------------------------
 * Computes the pixel regions for every visual panel (title, cards, chart,
 * legend, table) from the current viewport and the user's layout mode.
 *
 * Pure function over (viewport + settings) — no DOM reads. The visual
 * calls {@link computeLayout} once per update cycle and passes the result
 * into the ViewModel, where every renderer consumes it.
 *
 * Breakpoints:
 *   - Phone  (<=480 px wide): cards collapse, legend shrinks.
 *   - Tablet (<=768 px wide): cards regular, legend kept, table optional.
 *   - Desktop (>768 px): full dashboard layout.
 *
 * @module    responsive
 * @version   1.0.0
 */

import {
    Layout,
    LayoutMode,
    Rect,
    Settings,
    ViewportBreakpoint
} from "./interfaces";
import {
    BREAKPOINT_PHONE_MAX,
    BREAKPOINT_TABLET_MAX,
    CARDS_HEIGHT,
    HORIZONTAL_GAP,
    LEGEND_HEIGHT,
    MARGIN,
    TABLE_HEADER_HEIGHT,
    TABLE_ROW_HEIGHT,
    TITLE_HEIGHT,
    VERTICAL_GAP
} from "./constants";

/* ============================================================
   PUBLIC API
   ============================================================ */

export function computeLayout(
    viewportW: number,
    viewportH: number,
    settings: Settings
): Layout {
    const w = Math.max(0, viewportW);
    const h = Math.max(0, viewportH);
    const breakpoint = resolveBreakpoint(w);

    const layoutMode = settings.general.layoutMode;
    const cardsEnabled = decideCards(layoutMode, settings.cards.show, w, breakpoint);
    const tableEnabled = decideTable(layoutMode, settings.table.show, w, breakpoint);
    const legendEnabled = decideLegend(layoutMode, settings.legend.show, w, breakpoint);

    // Vertical cursor — top to bottom allocation.
    let top = 0;

    const titleH = settings.general.showTitle ? TITLE_HEIGHT : 0;
    const title: Rect = { x: 0, y: top, width: w, height: titleH };
    top += titleH + (titleH > 0 ? VERTICAL_GAP : 0);

    const cardsH = cardsEnabled ? CARDS_HEIGHT : 0;
    const cards: Rect = {
        x: HORIZONTAL_GAP,
        y: top,
        width: w - HORIZONTAL_GAP * 2,
        height: cardsH
    };
    top += cardsH + (cardsH > 0 ? VERTICAL_GAP : 0);

    // Table + legend allocated from the bottom up.
    let bottom = h;
    let tableH = 0;
    if (tableEnabled) {
        tableH = computeTableHeight(settings, bottom - top);
        bottom -= tableH + (tableH > 0 ? VERTICAL_GAP : 0);
    }
    const table: Rect = {
        x: HORIZONTAL_GAP,
        y: bottom,
        width: w - HORIZONTAL_GAP * 2,
        height: tableH
    };

    let legendH = 0;
    if (legendEnabled) {
        legendH = LEGEND_HEIGHT;
        bottom -= legendH + VERTICAL_GAP;
    }
    const legend: Rect = {
        x: HORIZONTAL_GAP,
        y: bottom,
        width: w - HORIZONTAL_GAP * 2,
        height: legendH
    };

    const chartH = Math.max(60, bottom - top);
    const chart: Rect = { x: 0, y: top, width: w, height: chartH };

    return {
        viewport: { x: 0, y: 0, width: w, height: h },
        breakpoint,
        title,
        cards,
        chart,
        legend,
        table,
        cardsEnabled,
        tableEnabled,
        legendEnabled,
        marginLeft: MARGIN.LEFT,
        marginRight: MARGIN.RIGHT,
        marginTop: MARGIN.TOP,
        marginBottom: MARGIN.BOTTOM
    };
}

/* ============================================================
   INTERNAL — policy helpers
   ============================================================ */

function resolveBreakpoint(width: number): ViewportBreakpoint {
    if (width <= BREAKPOINT_PHONE_MAX) return ViewportBreakpoint.Phone;
    if (width <= BREAKPOINT_TABLET_MAX) return ViewportBreakpoint.Tablet;
    return ViewportBreakpoint.Desktop;
}

function decideCards(
    mode: LayoutMode,
    userWantsCards: boolean,
    width: number,
    breakpoint: ViewportBreakpoint
): boolean {
    if (mode === LayoutMode.ChartOnly) return false;
    if (mode === LayoutMode.FullDashboard) return userWantsCards;
    if (breakpoint === ViewportBreakpoint.Phone && width < 320) return false;
    return userWantsCards;
}

function decideTable(
    mode: LayoutMode,
    userWantsTable: boolean,
    width: number,
    breakpoint: ViewportBreakpoint
): boolean {
    void width;
    if (mode === LayoutMode.ChartOnly) return false;
    if (mode === LayoutMode.FullDashboard) return userWantsTable;
    if (breakpoint === ViewportBreakpoint.Phone) return false;
    return userWantsTable;
}

function decideLegend(
    mode: LayoutMode,
    userWantsLegend: boolean,
    width: number,
    breakpoint: ViewportBreakpoint
): boolean {
    void width;
    if (mode === LayoutMode.ChartOnly) return false;
    if (mode === LayoutMode.FullDashboard) return userWantsLegend;
    if (breakpoint === ViewportBreakpoint.Phone) return false;
    return userWantsLegend;
}

function computeTableHeight(settings: Settings, available: number): number {
    const maxRows = Math.max(1, settings.table.maxRows);
    const header = TABLE_HEADER_HEIGHT;
    const rows = TABLE_ROW_HEIGHT * Math.max(1, Math.min(maxRows, 100));
    const total = header + rows;
    return Math.min(total, Math.max(0, available - 8));
}
