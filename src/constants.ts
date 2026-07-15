/**
 * Pareto Pro Enterprise — Constants & Defaults
 * --------------------------------------------
 * Central registry of magic numbers, layout metrics, default settings,
 * cache sizes, and threshold bounds. No runtime logic lives here.
 *
 * @module    constants
 * @version   1.0.0
 */

import {
    ABCClass,
    AnimationType,
    DashStyle,
    DisplayUnitMode,
    LayoutMode,
    LineType,
    MarkerShape,
    PaletteName,
    ThemeMode,
    LegendPosition
} from "./interfaces";

/* ============================================================
   VISUAL METADATA
   ============================================================ */
export const VISUAL_NAME = "Pareto Pro Enterprise";
export const VISUAL_VERSION = "1.0.0";

/* ============================================================
   GEOMETRY / SPATIAL METRICS (px)
   ============================================================ */
export const MARGIN = {
    TOP: 12,
    RIGHT: 56,
    BOTTOM: 56,
    LEFT: 56
} as const;

export const VERTICAL_GAP = 8;
export const HORIZONTAL_GAP = 8;

export const TITLE_HEIGHT = 28;
export const SUBTITLE_HEIGHT = 16;
export const CARDS_HEIGHT = 72;
export const LEGEND_HEIGHT = 32;
export const TABLE_ROW_HEIGHT = 24;
export const TABLE_HEADER_HEIGHT = 26;

export const AXIS_TITLE_GAP = 8;
export const TICK_LABEL_WIDTH = 48;
export const CATEGORY_LABEL_MAX_ANGLE = 45;

/** Maximum bar corner radius — clamps user input. */
export const MAX_BAR_RADIUS = 24;

/* ============================================================
   RESPONSIVE BREAKPOINTS
   ============================================================ */
export const BREAKPOINT_PHONE_MAX = 480;
export const BREAKPOINT_TABLET_MAX = 768;

/* ============================================================
   PERFORMANCE
   ============================================================ */
/** LRU cache capacity for memoized domain computations. */
export const MEMO_CACHE_SIZE = 5;

/** Beyond this point count, virtual rendering activates. */
export const VIRTUAL_THRESHOLD = 4000;

/** Power BI data-reduction window size (top-N categories rendered). */
export const DATA_REDUCTION_WINDOW = 30000;

/** Frame budget (ms) before auto-degrading animations. */
export const FRAME_BUDGET_MS = 14;

/** Animation duration floor when degraded. */
export const MIN_ANIMATION_DURATION = 0;
export const MAX_ANIMATION_DURATION = 3000;

/* ============================================================
   ABC ANALYSIS — DEFAULT THRESHOLDS (% of cumulative value)
   ============================================================ */
export const ABC_DEFAULTS = {
    THRESHOLD_A: 80,
    THRESHOLD_B: 95,
    THRESHOLD_C: 100,
    COLOR_A: { normal: "#107c10", light: "#7bb47b", dark: "#0e6e0e" },
    COLOR_B: { normal: "#ca5010", light: "#e08a55", dark: "#b0450c" },
    COLOR_C: { normal: "#6c757d", light: "#9aa0a6", dark: "#5a6269" }
} as const;

export const ABC_CLASS_ORDER: ABCClass[] = [ABCClass.A, ABCClass.B, ABCClass.C];

/* ============================================================
   DEFAULT REFERENCE LINES (the spec's stock set)
   ============================================================ */
export const DEFAULT_REFERENCE_VALUES = [80, 90, 95];

/* ============================================================
   DASH STYLE → SVG stroke-dasharray
   ============================================================ */
export const DASH_PATTERNS: Record<DashStyle, string> = {
    [DashStyle.Solid]: "none",
    [DashStyle.Dashed]: "8,4",
    [DashStyle.Dotted]: "2,4",
    [DashStyle.DashDot]: "8,4,2,4"
};

/* ============================================================
   D3 SCALING
   ============================================================ */
export const SCALE_PCT_MIN = 0;
export const SCALE_PCT_MAX = 100;
export const SCALE_VALUE_MIN = 0;

/** Secondary axis tick count. */
export const AXIS_RIGHT_TICKS = 5;
export const AXIS_LEFT_TICKS = 6;

/* ============================================================
   DEFAULT SETTINGS — mirror capabilities.json defaults
   ============================================================ */
export const DEFAULT_SETTINGS = {
    general: {
        titleText: "Pareto Analysis",
        showTitle: true,
        layoutMode: LayoutMode.Auto,
        theme: ThemeMode.Auto
    },
    columns: {
        show: true,
        radius: 4,
        useGradient: true,
        fillColor: "#0078d4",
        gradientStartColor: "#4db8ff",
        gradientEndColor: "#0078d4",
        borderColor: "#ffffff",
        borderWidth: 0,
        shadow: true,
        opacity: 90,
        width: 80,
        gap: 2,
        useABCColors: true
    },
    paretoLine: {
        show: true,
        lineType: LineType.Smooth,
        color: "#d83b01",
        width: 2,
        dashArray: DashStyle.Solid,
        showMarkers: true,
        markerShape: MarkerShape.Circle,
        markerSize: 5,
        markerColor: "#d83b01"
    },
    targetLine: {
        show: true,
        value: 80,
        color: "#e3008c",
        dashArray: DashStyle.Dashed,
        label: "80% Target"
    },
    referenceLines: {
        show: true,
        lines: []
    },
    cards: {
        show: true,
        fontSize: 14,
        backgroundColor: "#ffffff",
        fontColor: "#242424"
    },
    table: {
        show: false,
        fontSize: 11,
        showRank: true,
        showValue: true,
        showPercent: true,
        showRunningTotal: true,
        showABC: true,
        showVariance: false,
        maxRows: 12
    },
    legend: {
        show: true,
        position: LegendPosition.Bottom
    },
    tooltip: {
        showCategory: true,
        showValue: true,
        showPercent: true,
        showRunningTotal: true,
        showABC: true,
        showRank: true,
        showDifference: true,
        showAverage: true
    },
    animation: {
        enabled: true,
        type: AnimationType.Grow,
        duration: 800,
        delay: 30
    },
    axes: {
        dualAxis: true,
        showXTitle: false,
        showYTitle: true,
        xTitle: "Category",
        yTitle: "Value",
        displayUnits: DisplayUnitMode.Auto,
        thousandsSeparator: true,
        decimalPlaces: 0
    },
    grid: {
        showMajor: true,
        showMinor: false,
        color: "#e9ecef"
    },
    theme: {
        palette: PaletteName.Default
    },
    statistics: {
        showMedian: true,
        showStdDev: true,
        showGini: true
    },
    abcAnalysis: {
        enabled: true,
        thresholdA: ABC_DEFAULTS.THRESHOLD_A,
        thresholdB: ABC_DEFAULTS.THRESHOLD_B,
        colorA: ABC_DEFAULTS.COLOR_A.normal,
        colorB: ABC_DEFAULTS.COLOR_B.normal,
        colorC: ABC_DEFAULTS.COLOR_C.normal
    }
} as const;

/* ============================================================
   DATA ROLE CAPABILITY NAMES (must match capabilities.json)
   ============================================================ */
export const DATA_ROLES = {
    CATEGORY: "Category",
    MEASURE: "Measure",
    TOOLTIPS: "Tooltips"
} as const;

/* ============================================================
   SVG NAMESPACES / LAYER IDS
   ============================================================ */
export const SVG_NS = "http://www.w3.org/2000/svg";

export const LAYER_IDS = {
    ROOT: "ppe-root",
    CARDS_LAYER: "ppe-cards-layer",
    CHART_LAYER: "ppe-chart-layer",
    SVG: "ppe-chart",
    GRID: "ppe-grid",
    GRID_MINOR: "ppe-grid-minor",
    AXIS_X: "ppe-axis-x",
    AXIS_Y_LEFT: "ppe-axis-y-left",
    AXIS_Y_RIGHT: "ppe-axis-y-right",
    BARS: "ppe-bars",
    PARETO_LINE: "ppe-pareto-line",
    MARKERS: "ppe-markers",
    LABELS: "ppe-labels",
    TARGET_LINE: "ppe-target-line",
    REFERENCE_LINES: "ppe-reference-lines",
    LEGEND: "ppe-legend-layer",
    TABLE_LAYER: "ppe-table-layer",
    TITLE: "ppe-title",
    STATE: "ppe-state"
} as const;

/* ============================================================
   KPI CARD DEFINITIONS — the six cards specified
   ============================================================ */
export enum KpiCardId {
    TotalDefects = "totalDefects",
    TotalCategories = "totalCategories",
    Top80 = "top80",
    CurrentPercent = "currentPercent",
    Average = "average",
    Maximum = "maximum"
}

export interface KpiCardDefinition {
    readonly id: KpiCardId;
    readonly label: string;
    /** Whether the value should be formatted as a percentage. */
    readonly isPercent: boolean;
}

export const KPI_CARDS: KpiCardDefinition[] = [
    { id: KpiCardId.TotalDefects, label: "Total", isPercent: false },
    { id: KpiCardId.TotalCategories, label: "Categories", isPercent: false },
    { id: KpiCardId.Top80, label: "Top 80%", isPercent: false },
    { id: KpiCardId.CurrentPercent, label: "Current %", isPercent: true },
    { id: KpiCardId.Average, label: "Average", isPercent: false },
    { id: KpiCardId.Maximum, label: "Maximum", isPercent: false }
];

/* ============================================================
   CLAMP / VALIDATION RANGES
   ============================================================ */
export const CLAMPS = {
    BAR_WIDTH_PCT: { MIN: 10, MAX: 100 },
    BAR_OPACITY: { MIN: 10, MAX: 100 },
    BAR_BORDER_WIDTH: { MIN: 0, MAX: 8 },
    BAR_RADIUS: { MIN: 0, MAX: MAX_BAR_RADIUS },
    BAR_GAP: { MIN: 0, MAX: 20 },
    LINE_WIDTH: { MIN: 1, MAX: 12 },
    MARKER_SIZE: { MIN: 3, MAX: 16 },
    ANIMATION_DURATION: { MIN: MIN_ANIMATION_DURATION, MAX: MAX_ANIMATION_DURATION },
    ANIMATION_DELAY: { MIN: 0, MAX: 2000 },
    DECIMAL_PLACES: { MIN: 0, MAX: 6 },
    TABLE_MAX_ROWS: { MIN: 1, MAX: 1000 },
    ABC_THRESHOLD_A: { MIN: 1, MAX: 99 },
    ABC_THRESHOLD_B: { MIN: 2, MAX: 100 },
    TARGET_PCT: { MIN: 1, MAX: 100 }
} as const;

export const NAMED_DISPLAY_UNIT_FACTORS = {
    thousands: 1e3,
    millions: 1e6,
    billions: 1e9
} as const;
