/**
 * Pareto Pro Enterprise — Core Type Contracts
 * -------------------------------------------
 * Every cross-module contract lives here. Strong typing is the backbone
 * of the architecture: the pure domain layer (Tier 2) consumes and produces
 * only these types, keeping it free of DOM, D3, and Power BI dependencies.
 *
 * @module    interfaces
 * @version   1.0.0
 */

import powerbiVisualsApi from "powerbi-visuals-api";
import ISelectionId = powerbiVisualsApi.visuals.ISelectionId;
import DataViewMetadata = powerbiVisualsApi.powerbi.DataViewMetadata;
import VisualUpdateOptions = powerbiVisualsApi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbiVisualsApi.extensibility.IVisualHost;

/**
 * Enumeration of ABC classification codes.
 * Class A — the vital few driving the largest cumulative percentage.
 * Class B — the intermediate group.
 * Class C — the trivial many contributing the remainder.
 */
export enum ABCClass {
    A = "A",
    B = "B",
    C = "C"
}

/**
 * Pareto chart data point — fully computed, immutable.
 * One instance per category row in the rendered dataset.
 */
export interface ParetoPoint {
    /** Stable identity across renders (used as d3 key). */
    readonly key: string;
    /** Display name of the category. */
    readonly category: string;
    /** Raw aggregated value for the category. */
    readonly value: number;
    /** 1-based rank when sorted descending by value. */
    readonly rank: number;
    /** Percentage of the total that this single category represents (0–100). */
    readonly percent: number;
    /** Cumulative percentage including this category (0–100). */
    readonly cumulativePercent: number;
    /** Running total of value including this category. */
    readonly runningTotal: number;
    /** ABC classification derived from the cumulative percentage. */
    readonly abcClass: ABCClass;
    /** Difference between this category's value and the previous (ranked) one. */
    readonly variance: number;
    /** Whether this point is currently highlighted by a Power BI cross-filter. */
    readonly isHighlight: boolean;
    /** Whether this point has been selected via the Selection Manager. */
    readonly isSelected: boolean;
    /** Power BI selection identifier for cross-filtering and bookmarks. */
    readonly identity: ISelectionId;
}

/**
 * Aggregate totals computed over the entire dataset (never sampled).
 * Used by KPI cards and statistics panels.
 */
export interface Totals {
    readonly total: number;
    readonly count: number;
    readonly average: number;
    readonly maximum: number;
    readonly minimum: number;
}

/**
 * Advanced descriptive statistics.
 * All metrics are computed over the full (non-reduced) value set.
 */
export interface Statistics {
    readonly mean: number;
    readonly median: number;
    readonly mode: number;
    readonly standardDeviation: number;
    readonly variance: number;
    readonly skewness: number;
    readonly kurtosis: number;
    /** Gini coefficient — measures inequality of the distribution (0–1). */
    readonly gini: number;
    readonly range: number;
}

/**
 * Summary of ABC classification — counts and shares per class.
 */
export interface ABCClassSummary {
    readonly className: ABCClass;
    readonly count: number;
    /** Share of total distinct categories, as a percentage (0–100). */
    readonly countPercent: number;
    /** Share of total value contributed, as a percentage (0–100). */
    readonly valuePercent: number;
}

export interface ABCSummary {
    readonly classes: ABCClassSummary[];
    /** Cumulative % threshold marking the A→B boundary (default 80). */
    readonly thresholdA: number;
    /** Cumulative % threshold marking the B→C boundary (default 95). */
    readonly thresholdB: number;
}

/**
 * A single user-defined reference line on the secondary (percentage) axis.
 * The visual supports an unlimited number of these.
 */
export interface ReferenceLine {
    readonly id: string;
    /** Percentage value (0–100) where the line sits on the secondary axis. */
    readonly value: number;
    readonly label: string;
    readonly color: string;
    readonly dashStyle: DashStyle;
    readonly width: number;
}

/* ============================================================
   ENUMERATIONS
   ============================================================ */

export enum ThemeMode {
    Auto = "auto",
    Light = "light",
    Dark = "dark",
    Corporate = "corporate",
    HighContrast = "hc"
}

export enum LayoutMode {
    Auto = "auto",
    ChartOnly = "chartOnly",
    FullDashboard = "fullDashboard"
}

export enum ViewportBreakpoint {
    Desktop = "desktop",
    Tablet = "tablet",
    Phone = "phone"
}

export enum LineType {
    Straight = "straight",
    Smooth = "smooth",
    Bezier = "bezier"
}

export enum MarkerShape {
    Circle = "circle",
    Diamond = "diamond",
    Square = "square"
}

export enum DashStyle {
    Solid = "solid",
    Dashed = "dashed",
    Dotted = "dotted",
    DashDot = "dashDot"
}

export enum AnimationType {
    None = "none",
    Fade = "fade",
    Grow = "grow",
    Slide = "slide",
    Bounce = "bounce",
    Elastic = "elastic"
}

export enum DisplayUnitMode {
    Auto = "auto",
    None = "none",
    Thousands = "thousands",
    Millions = "millions",
    Billions = "billions"
}

export enum LegendPosition {
    Top = "top",
    Bottom = "bottom",
    Left = "left",
    Right = "right"
}

export enum PaletteName {
    Default = "default",
    Warm = "warm",
    Cool = "cool",
    Monochrome = "monochrome"
}

/* ============================================================
   FORMAT PANE SETTINGS (typed mirror of capabilities.json objects)
   ============================================================ */

export interface GeneralSettings {
    readonly titleText: string;
    readonly showTitle: boolean;
    readonly layoutMode: LayoutMode;
    readonly theme: ThemeMode;
}

export interface ColumnSettings {
    readonly show: boolean;
    readonly radius: number;
    readonly useGradient: boolean;
    readonly fillColor: string;
    readonly gradientStartColor: string;
    readonly gradientEndColor: string;
    readonly borderColor: string;
    readonly borderWidth: number;
    readonly shadow: boolean;
    readonly opacity: number;
    readonly width: number;
    readonly gap: number;
    readonly useABCColors: boolean;
}

export interface ParetoLineSettings {
    readonly show: boolean;
    readonly lineType: LineType;
    readonly color: string;
    readonly width: number;
    readonly dashArray: DashStyle;
    readonly showMarkers: boolean;
    readonly markerShape: MarkerShape;
    readonly markerSize: number;
    readonly markerColor: string;
}

export interface TargetLineSettings {
    readonly show: boolean;
    readonly value: number;
    readonly color: string;
    readonly dashArray: DashStyle;
    readonly label: string;
}

export interface ReferenceLinesSettings {
    readonly show: boolean;
    readonly lines: ReferenceLine[];
}

export interface CardsSettings {
    readonly show: boolean;
    readonly fontSize: number;
    readonly backgroundColor: string;
    readonly fontColor: string;
}

export interface TableSettings {
    readonly show: boolean;
    readonly fontSize: number;
    readonly showRank: boolean;
    readonly showValue: boolean;
    readonly showPercent: boolean;
    readonly showRunningTotal: boolean;
    readonly showABC: boolean;
    readonly showVariance: boolean;
    readonly maxRows: number;
}

export interface LegendSettings {
    readonly show: boolean;
    readonly position: LegendPosition;
}

export interface TooltipSettings {
    readonly showCategory: boolean;
    readonly showValue: boolean;
    readonly showPercent: boolean;
    readonly showRunningTotal: boolean;
    readonly showABC: boolean;
    readonly showRank: boolean;
    readonly showDifference: boolean;
    readonly showAverage: boolean;
}

export interface AnimationSettings {
    readonly enabled: boolean;
    readonly type: AnimationType;
    readonly duration: number;
    readonly delay: number;
}

export interface AxesSettings {
    readonly dualAxis: boolean;
    readonly showXTitle: boolean;
    readonly showYTitle: boolean;
    readonly xTitle: string;
    readonly yTitle: string;
    readonly displayUnits: DisplayUnitMode;
    readonly thousandsSeparator: boolean;
    readonly decimalPlaces: number;
}

export interface GridSettings {
    readonly showMajor: boolean;
    readonly showMinor: boolean;
    readonly color: string;
}

export interface ThemeSettings {
    readonly palette: PaletteName;
}

export interface StatisticsSettings {
    readonly showMedian: boolean;
    readonly showStdDev: boolean;
    readonly showGini: boolean;
}

export interface ABCAnalysisSettings {
    readonly enabled: boolean;
    readonly thresholdA: number;
    readonly thresholdB: number;
    readonly colorA: string;
    readonly colorB: string;
    readonly colorC: string;
}

/**
 * Aggregate of all format-pane settings — fully resolved and typed.
 * Produced by {@link settings.ts} from the dataView metadata objects.
 */
export interface Settings {
    readonly general: GeneralSettings;
    readonly columns: ColumnSettings;
    readonly paretoLine: ParetoLineSettings;
    readonly targetLine: TargetLineSettings;
    readonly referenceLines: ReferenceLinesSettings;
    readonly cards: CardsSettings;
    readonly table: TableSettings;
    readonly legend: LegendSettings;
    readonly tooltip: TooltipSettings;
    readonly animation: AnimationSettings;
    readonly axes: AxesSettings;
    readonly grid: GridSettings;
    readonly theme: ThemeSettings;
    readonly statistics: StatisticsSettings;
    readonly abcAnalysis: ABCAnalysisSettings;
}

/* ============================================================
   LAYOUT
   ============================================================ */

/** Rectangular region of the SVG viewport. */
export interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/**
 * Computed layout — pixel regions reserved for every visual panel.
 * Determined by {@link responsive.ts} from the current viewport and settings.
 */
export interface Layout {
    readonly viewport: Rect;
    readonly breakpoint: ViewportBreakpoint;
    readonly title: Rect;
    readonly cards: Rect;
    readonly chart: Rect;
    readonly legend: Rect;
    readonly table: Rect;
    readonly cardsEnabled: boolean;
    readonly tableEnabled: boolean;
    readonly legendEnabled: boolean;
    /** Left margin (axes + titles). */
    readonly marginLeft: number;
    /** Right margin (secondary axis + titles). */
    readonly marginRight: number;
    /** Top margin (title + cards). */
    readonly marginTop: number;
    /** Bottom margin (legend + table). */
    readonly marginBottom: number;
}

/* ============================================================
   ERROR / EDGE CASES
   ============================================================ */

export enum VisualStateKind {
    /** Normal rendering — full view model. */
    Normal = "normal",
    /** No data supplied. */
    NoData = "noData",
    /** No category / measure field bound. */
    MissingField = "missingField",
    /** Only a single category present. */
    SingleCategory = "singleCategory",
    /** All values are null or empty. */
    NullValues = "nullValues",
    /** Negative values detected (Pareto is undefined). */
    NegativeValues = "negativeValues",
    /** Dataset exceeds a safe rendering threshold. */
    LargeDataset = "largeDataset",
    /** An unexpected error during processing. */
    Error = "error"
}

export interface VisualState {
    readonly kind: VisualStateKind;
    readonly title: string;
    readonly message: string;
    /** Whether the visual can still attempt a degraded render. */
    readonly recoverable: boolean;
}

/* ============================================================
   VIEW MODEL — the single source of truth for rendering
   ============================================================ */

export interface ViewModel {
    readonly state: VisualState;
    readonly points: ParetoPoint[];
    readonly totals: Totals;
    readonly statistics: Statistics;
    readonly abcSummary: ABCSummary;
    readonly settings: Settings;
    readonly layout: Layout;
    /** True when a Power BI cross-filter is active (highlight data present). */
    readonly hasHighlights: boolean;
    readonly metadata: DataViewMetadata;
    /** Cached signature for memoization — same key means same content. */
    readonly signature: string;
}

/* ============================================================
   HOST CONTEXT passed to rendering modules (avoids host coupling)
   ============================================================ */

export interface VisualContext {
    readonly host: IVisualHost;
    readonly options: VisualUpdateOptions;
    readonly container: HTMLElement;
    readonly selectionManager: powerbiVisualsApi.extensibility.ISelectionManager;
    readonly tooltipService: powerbiVisualsApi.extensibility.ITooltipService;
    readonly locale: string;
}
