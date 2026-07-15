/**
 * Pareto Pro Enterprise — Settings Resolution & Formatting Model API
 * ------------------------------------------------------------------
 * Two cooperating responsibilities:
 *
 *   1. {@link resolveSettings} — Build the fully typed {@link Settings}
 *      aggregate from the dataView metadata objects + Power BI host theme,
 *      merging user overrides onto the {@link DEFAULT_SETTINGS} baseline.
 *
 *   2. {@link buildFormattingModel} — Produce the modern Formatting
 *      Model API objects describing the format pane. This drives the
 *      native Fluent format pane with no manual DOM manipulation.
 *
 * @module    settings
 * @version   1.0.0
 */

import powerbiVisualsApi from "powerbi-visuals-api";
import powerbi = powerbiVisualsApi;
import DataViewMetadata = powerbiVisualsApi.powerbi.DataViewMetadata;
import DataViewObject = powerbiVisualsApi.powerbi.DataViewObject;
import DataViewObjects = powerbiVisualsApi.powerbi.DataViewObjects;
import IVisualHost = powerbiVisualsApi.extensibility.IVisualHost;

import * as settingsModel from "powerbi-visuals-utils-formattingutils/lib/src/interfaces";
import { FormattingModelHelpers } from "powerbi-visuals-utils-formattingutils";

import {
    Settings,
    GeneralSettings,
    ColumnSettings,
    ParetoLineSettings,
    TargetLineSettings,
    ReferenceLinesSettings,
    CardsSettings,
    TableSettings,
    LegendSettings,
    TooltipSettings,
    AnimationSettings,
    AxesSettings,
    GridSettings,
    ThemeSettings,
    StatisticsSettings,
    ABCAnalysisSettings,
    ReferenceLine,
    ThemeMode,
    LayoutMode,
    LineType,
    MarkerShape,
    DashStyle,
    DisplayUnitMode,
    LegendPosition,
    PaletteName,
    AnimationType
} from "./interfaces";
import { DEFAULT_SETTINGS, DATA_ROLES, CLAMPS } from "./constants";
import { clamp } from "./utils";

/* ============================================================
   OBJECT NAMES — must match capabilities.json property keys
   ============================================================ */

const OBJECT_NAMES = {
    general: "general",
    columns: "columns",
    paretoLine: "paretoLine",
    targetLine: "targetLine",
    referenceLines: "referenceLines",
    cards: "cards",
    table: "table",
    legend: "legend",
    tooltip: "tooltip",
    animation: "animation",
    axes: "axes",
    grid: "grid",
    theme: "theme",
    statistics: "statistics",
    abcAnalysis: "abcAnalysis"
} as const;

/* ============================================================
   READERS — typed property accessors over dataView objects
   ============================================================ */

/** Read a primitive property value, coerced to a number. */
function getNumber(metadata: DataViewMetadata, objName: string, propName: string, fallback: number): number {
    const value = DataViewObjects.getObjectValue(
        metadata && metadata.objects,
        objName,
        propName
    );
    if (value == null) return fallback;
    if (typeof value === "number") {
        return isFinite(value) ? value : fallback;
    }
    const n = Number(value);
    return isFinite(n) ? n : fallback;
}

/** Read a primitive property value, coerced to a boolean. */
function getBool(metadata: DataViewMetadata, objName: string, propName: string, fallback: boolean): boolean {
    const value = DataViewObjects.getObjectValue(
        metadata && metadata.objects,
        objName,
        propName
    );
    return typeof value === "boolean" ? value : fallback;
}

/** Read a primitive property value, coerced to a string. */
function getString(metadata: DataViewMetadata, objName: string, propName: string, fallback: string): string {
    const value = DataViewObjects.getObjectValue(
        metadata && metadata.objects,
        objName,
        propName
    );
    return typeof value === "string" ? value : fallback;
}

/** Read a Fill color (Power BI stored as { solid: { color: "#xx" } }). */
function getColor(metadata: DataViewMetadata, objName: string, propName: string, fallback: string): string {
    const obj = DataViewObjects.getObject(
        metadata && metadata.objects,
        objName
    );
    if (!obj) return fallback;
    const propValue = (obj as unknown as Record<string, unknown>)[propName];
    if (!propValue) return fallback;
    // Fill format: { solid: { color: "#RRGGBB" } }
    const fill = propValue as { solid?: { color?: string } };
    if (fill && fill.solid && fill.solid.color) {
        return fill.solid.color;
    }
    if (typeof propValue === "string") {
        return propValue;
    }
    return fallback;
}

/** Read an enumeration-backed value and coerce via a transformer. */
function getEnum<T extends string>(
    metadata: DataViewMetadata,
    objName: string,
    propName: string,
    allowedValues: readonly T[],
    fallback: T
): T {
    const raw = DataViewObjects.getObjectValue(
        metadata && metadata.objects,
        objName,
        propName
    );
    if (typeof raw !== "string") return fallback;
    const v = raw as T;
    return (allowedValues as readonly string[]).indexOf(v) >= 0 ? v : fallback;
}

/* ============================================================
   ENUM ALLOWED-VALUE REGISTRIES (for typed lookups)
   ============================================================ */

const THEME_MODES: readonly ThemeMode[] = [
    ThemeMode.Auto, ThemeMode.Light, ThemeMode.Dark, ThemeMode.Corporate
];
const LAYOUT_MODES: readonly LayoutMode[] = [
    LayoutMode.Auto, LayoutMode.ChartOnly, LayoutMode.FullDashboard
];
const LINE_TYPES: readonly LineType[] = [
    LineType.Straight, LineType.Smooth, LineType.Bezier
];
const MARKER_SHAPES: readonly MarkerShape[] = [
    MarkerShape.Circle, MarkerShape.Diamond, MarkerShape.Square
];
const DASH_STYLES: readonly DashStyle[] = [
    DashStyle.Solid, DashStyle.Dashed, DashStyle.Dotted, DashStyle.DashDot
];
const DISPLAY_UNITS: readonly DisplayUnitMode[] = [
    DisplayUnitMode.Auto, DisplayUnitMode.None, DisplayUnitMode.Thousands,
    DisplayUnitMode.Millions, DisplayUnitMode.Billions
];
const LEGEND_POSITIONS: readonly LegendPosition[] = [
    LegendPosition.Top, LegendPosition.Bottom, LegendPosition.Left, LegendPosition.Right
];
const PALETTES: readonly PaletteName[] = [
    PaletteName.Default, PaletteName.Warm, PaletteName.Cool, PaletteName.Monochrome
];
const ANIMATION_TYPES: readonly AnimationType[] = [
    AnimationType.None, AnimationType.Fade, AnimationType.Grow,
    AnimationType.Slide, AnimationType.Bounce, AnimationType.Elastic
];

/* ============================================================
   PER-CARD RESOLVERS
   ============================================================ */

function resolveGeneral(metadata: DataViewMetadata): GeneralSettings {
    return {
        titleText: getString(metadata, OBJECT_NAMES.general, "titleText", DEFAULT_SETTINGS.general.titleText),
        showTitle: getBool(metadata, OBJECT_NAMES.general, "showTitle", DEFAULT_SETTINGS.general.showTitle),
        layoutMode: getEnum(metadata, OBJECT_NAMES.general, "layoutMode", LAYOUT_MODES, DEFAULT_SETTINGS.general.layoutMode),
        theme: getEnum(metadata, OBJECT_NAMES.general, "theme", THEME_MODES, DEFAULT_SETTINGS.general.theme)
    };
}

function resolveColumns(metadata: DataViewMetadata): ColumnSettings {
    return {
        show: getBool(metadata, OBJECT_NAMES.columns, "show", DEFAULT_SETTINGS.columns.show),
        radius: clamp(getNumber(metadata, OBJECT_NAMES.columns, "radius", DEFAULT_SETTINGS.columns.radius), CLAMPS.BAR_RADIUS.MIN, CLAMPS.BAR_RADIUS.MAX),
        useGradient: getBool(metadata, OBJECT_NAMES.columns, "useGradient", DEFAULT_SETTINGS.columns.useGradient),
        fillColor: getColor(metadata, OBJECT_NAMES.columns, "fillColor", DEFAULT_SETTINGS.columns.fillColor),
        gradientStartColor: getColor(metadata, OBJECT_NAMES.columns, "gradientStartColor", DEFAULT_SETTINGS.columns.gradientStartColor),
        gradientEndColor: getColor(metadata, OBJECT_NAMES.columns, "gradientEndColor", DEFAULT_SETTINGS.columns.gradientEndColor),
        borderColor: getColor(metadata, OBJECT_NAMES.columns, "borderColor", DEFAULT_SETTINGS.columns.borderColor),
        borderWidth: clamp(getNumber(metadata, OBJECT_NAMES.columns, "borderWidth", DEFAULT_SETTINGS.columns.borderWidth), CLAMPS.BAR_BORDER_WIDTH.MIN, CLAMPS.BAR_BORDER_WIDTH.MAX),
        shadow: getBool(metadata, OBJECT_NAMES.columns, "shadow", DEFAULT_SETTINGS.columns.shadow),
        opacity: clamp(getNumber(metadata, OBJECT_NAMES.columns, "opacity", DEFAULT_SETTINGS.columns.opacity), CLAMPS.BAR_OPACITY.MIN, CLAMPS.BAR_OPACITY.MAX),
        width: clamp(getNumber(metadata, OBJECT_NAMES.columns, "width", DEFAULT_SETTINGS.columns.width), CLAMPS.BAR_WIDTH_PCT.MIN, CLAMPS.BAR_WIDTH_PCT.MAX),
        gap: clamp(getNumber(metadata, OBJECT_NAMES.columns, "gap", DEFAULT_SETTINGS.columns.gap), CLAMPS.BAR_GAP.MIN, CLAMPS.BAR_GAP.MAX),
        useABCColors: getBool(metadata, OBJECT_NAMES.columns, "useABCColors", DEFAULT_SETTINGS.columns.useABCColors)
    };
}

function resolveParetoLine(metadata: DataViewMetadata): ParetoLineSettings {
    return {
        show: getBool(metadata, OBJECT_NAMES.paretoLine, "show", DEFAULT_SETTINGS.paretoLine.show),
        lineType: getEnum(metadata, OBJECT_NAMES.paretoLine, "lineType", LINE_TYPES, DEFAULT_SETTINGS.paretoLine.lineType),
        color: getColor(metadata, OBJECT_NAMES.paretoLine, "color", DEFAULT_SETTINGS.paretoLine.color),
        width: clamp(getNumber(metadata, OBJECT_NAMES.paretoLine, "width", DEFAULT_SETTINGS.paretoLine.width), CLAMPS.LINE_WIDTH.MIN, CLAMPS.LINE_WIDTH.MAX),
        dashArray: getEnum(metadata, OBJECT_NAMES.paretoLine, "dashArray", DASH_STYLES, DEFAULT_SETTINGS.paretoLine.dashArray),
        showMarkers: getBool(metadata, OBJECT_NAMES.paretoLine, "showMarkers", DEFAULT_SETTINGS.paretoLine.showMarkers),
        markerShape: getEnum(metadata, OBJECT_NAMES.paretoLine, "markerShape", MARKER_SHAPES, DEFAULT_SETTINGS.paretoLine.markerShape),
        markerSize: clamp(getNumber(metadata, OBJECT_NAMES.paretoLine, "markerSize", DEFAULT_SETTINGS.paretoLine.markerSize), CLAMPS.MARKER_SIZE.MIN, CLAMPS.MARKER_SIZE.MAX),
        markerColor: getColor(metadata, OBJECT_NAMES.paretoLine, "markerColor", DEFAULT_SETTINGS.paretoLine.markerColor)
    };
}

function resolveTargetLine(metadata: DataViewMetadata): TargetLineSettings {
    return {
        show: getBool(metadata, OBJECT_NAMES.targetLine, "show", DEFAULT_SETTINGS.targetLine.show),
        value: clamp(getNumber(metadata, OBJECT_NAMES.targetLine, "value", DEFAULT_SETTINGS.targetLine.value), CLAMPS.TARGET_PCT.MIN, CLAMPS.TARGET_PCT.MAX),
        color: getColor(metadata, OBJECT_NAMES.targetLine, "color", DEFAULT_SETTINGS.targetLine.color),
        dashArray: getEnum(metadata, OBJECT_NAMES.targetLine, "dashArray", DASH_STYLES, DEFAULT_SETTINGS.targetLine.dashArray),
        label: getString(metadata, OBJECT_NAMES.targetLine, "label", DEFAULT_SETTINGS.targetLine.label)
    };
}

function resolveReferenceLines(metadata: DataViewMetadata): ReferenceLinesSettings {
    // Reference lines are stored as an array of user dict rows; we read what's there.
    const show = getBool(metadata, OBJECT_NAMES.referenceLines, "show", DEFAULT_SETTINGS.referenceLines.show);
    const lines: ReferenceLine[] = [];
    const obj = DataViewObjects.getObject(metadata && metadata.objects, OBJECT_NAMES.referenceLines);
    if (obj) {
        const raw = (obj as unknown as Record<string, unknown>)["lines"];
        if (Array.isArray(raw)) {
            for (const r of raw) {
                const row = r as Record<string, unknown>;
                lines.push({
                    id: String(row["id"] || `ref-${lines.length + 1}`),
                    value: clamp(Number(row["value"]) || 80, CLAMPS.TARGET_PCT.MIN, CLAMPS.TARGET_PCT.MAX),
                    label: String(row["label"] || `${row["value"] || 80}%`),
                    color: String(row["color"] || "#b0b0b0"),
                    dashStyle: DASH_STYLES.indexOf(String(row["dash"]) as DashStyle) >= 0
                        ? String(row["dash"]) as DashStyle
                        : DashStyle.Dashed,
                    width: clamp(Number(row["width"]) || 1, CLAMPS.LINE_WIDTH.MIN, CLAMPS.LINE_WIDTH.MAX)
                });
            }
        }
    }
    return { show, lines };
}

function resolveCards(metadata: DataViewMetadata): CardsSettings {
    return {
        show: getBool(metadata, OBJECT_NAMES.cards, "show", DEFAULT_SETTINGS.cards.show),
        fontSize: getNumber(metadata, OBJECT_NAMES.cards, "fontSize", DEFAULT_SETTINGS.cards.fontSize),
        backgroundColor: getColor(metadata, OBJECT_NAMES.cards, "backgroundColor", DEFAULT_SETTINGS.cards.backgroundColor),
        fontColor: getColor(metadata, OBJECT_NAMES.cards, "fontColor", DEFAULT_SETTINGS.cards.fontColor)
    };
}

function resolveTable(metadata: DataViewMetadata): TableSettings {
    return {
        show: getBool(metadata, OBJECT_NAMES.table, "show", DEFAULT_SETTINGS.table.show),
        fontSize: getNumber(metadata, OBJECT_NAMES.table, "fontSize", DEFAULT_SETTINGS.table.fontSize),
        showRank: getBool(metadata, OBJECT_NAMES.table, "showRank", DEFAULT_SETTINGS.table.showRank),
        showValue: getBool(metadata, OBJECT_NAMES.table, "showValue", DEFAULT_SETTINGS.table.showValue),
        showPercent: getBool(metadata, OBJECT_NAMES.table, "showPercent", DEFAULT_SETTINGS.table.showPercent),
        showRunningTotal: getBool(metadata, OBJECT_NAMES.table, "showRunningTotal", DEFAULT_SETTINGS.table.showRunningTotal),
        showABC: getBool(metadata, OBJECT_NAMES.table, "showABC", DEFAULT_SETTINGS.table.showABC),
        showVariance: getBool(metadata, OBJECT_NAMES.table, "showVariance", DEFAULT_SETTINGS.table.showVariance),
        maxRows: clamp(getNumber(metadata, OBJECT_NAMES.table, "maxRows", DEFAULT_SETTINGS.table.maxRows), CLAMPS.TABLE_MAX_ROWS.MIN, CLAMPS.TABLE_MAX_ROWS.MAX)
    };
}

function resolveLegend(metadata: DataViewMetadata): LegendSettings {
    return {
        show: getBool(metadata, OBJECT_NAMES.legend, "show", DEFAULT_SETTINGS.legend.show),
        position: getEnum(metadata, OBJECT_NAMES.legend, "position", LEGEND_POSITIONS, DEFAULT_SETTINGS.legend.position)
    };
}

function resolveTooltip(metadata: DataViewMetadata): TooltipSettings {
    return {
        showCategory: getBool(metadata, OBJECT_NAMES.tooltip, "showCategory", DEFAULT_SETTINGS.tooltip.showCategory),
        showValue: getBool(metadata, OBJECT_NAMES.tooltip, "showValue", DEFAULT_SETTINGS.tooltip.showValue),
        showPercent: getBool(metadata, OBJECT_NAMES.tooltip, "showPercent", DEFAULT_SETTINGS.tooltip.showPercent),
        showRunningTotal: getBool(metadata, OBJECT_NAMES.tooltip, "showRunningTotal", DEFAULT_SETTINGS.tooltip.showRunningTotal),
        showABC: getBool(metadata, OBJECT_NAMES.tooltip, "showABC", DEFAULT_SETTINGS.tooltip.showABC),
        showRank: getBool(metadata, OBJECT_NAMES.tooltip, "showRank", DEFAULT_SETTINGS.tooltip.showRank),
        showDifference: getBool(metadata, OBJECT_NAMES.tooltip, "showDifference", DEFAULT_SETTINGS.tooltip.showDifference),
        showAverage: getBool(metadata, OBJECT_NAMES.tooltip, "showAverage", DEFAULT_SETTINGS.tooltip.showAverage)
    };
}

function resolveAnimation(metadata: DataViewMetadata): AnimationSettings {
    return {
        enabled: getBool(metadata, OBJECT_NAMES.animation, "enabled", DEFAULT_SETTINGS.animation.enabled),
        type: getEnum(metadata, OBJECT_NAMES.animation, "type", ANIMATION_TYPES, DEFAULT_SETTINGS.animation.type),
        duration: clamp(getNumber(metadata, OBJECT_NAMES.animation, "duration", DEFAULT_SETTINGS.animation.duration), CLAMPS.ANIMATION_DURATION.MIN, CLAMPS.ANIMATION_DURATION.MAX),
        delay: clamp(getNumber(metadata, OBJECT_NAMES.animation, "delay", DEFAULT_SETTINGS.animation.delay), CLAMPS.ANIMATION_DELAY.MIN, CLAMPS.ANIMATION_DELAY.MAX)
    };
}

function resolveAxes(metadata: DataViewMetadata): AxesSettings {
    return {
        dualAxis: getBool(metadata, OBJECT_NAMES.axes, "dualAxis", DEFAULT_SETTINGS.axes.dualAxis),
        showXTitle: getBool(metadata, OBJECT_NAMES.axes, "showXTitle", DEFAULT_SETTINGS.axes.showXTitle),
        showYTitle: getBool(metadata, OBJECT_NAMES.axes, "showYTitle", DEFAULT_SETTINGS.axes.showYTitle),
        xTitle: getString(metadata, OBJECT_NAMES.axes, "xTitle", DEFAULT_SETTINGS.axes.xTitle),
        yTitle: getString(metadata, OBJECT_NAMES.axes, "yTitle", DEFAULT_SETTINGS.axes.yTitle),
        displayUnits: getEnum(metadata, OBJECT_NAMES.axes, "displayUnits", DISPLAY_UNITS, DEFAULT_SETTINGS.axes.displayUnits),
        thousandsSeparator: getBool(metadata, OBJECT_NAMES.axes, "thousandsSeparator", DEFAULT_SETTINGS.axes.thousandsSeparator),
        decimalPlaces: clamp(getNumber(metadata, OBJECT_NAMES.axes, "decimalPlaces", DEFAULT_SETTINGS.axes.decimalPlaces), CLAMPS.DECIMAL_PLACES.MIN, CLAMPS.DECIMAL_PLACES.MAX)
    };
}

function resolveGrid(metadata: DataViewMetadata): GridSettings {
    return {
        showMajor: getBool(metadata, OBJECT_NAMES.grid, "showMajor", DEFAULT_SETTINGS.grid.showMajor),
        showMinor: getBool(metadata, OBJECT_NAMES.grid, "showMinor", DEFAULT_SETTINGS.grid.showMinor),
        color: getColor(metadata, OBJECT_NAMES.grid, "color", DEFAULT_SETTINGS.grid.color)
    };
}

function resolveThemeSettings(metadata: DataViewMetadata): ThemeSettings {
    return {
        palette: getEnum(metadata, OBJECT_NAMES.theme, "palette", PALETTES, DEFAULT_SETTINGS.theme.palette)
    };
}

function resolveStatisticsSettings(metadata: DataViewMetadata): StatisticsSettings {
    return {
        showMedian: getBool(metadata, OBJECT_NAMES.statistics, "showMedian", DEFAULT_SETTINGS.statistics.showMedian),
        showStdDev: getBool(metadata, OBJECT_NAMES.statistics, "showStdDev", DEFAULT_SETTINGS.statistics.showStdDev),
        showGini: getBool(metadata, OBJECT_NAMES.statistics, "showGini", DEFAULT_SETTINGS.statistics.showGini)
    };
}

function resolveABCAnalysis(metadata: DataViewMetadata): ABCAnalysisSettings {
    const tA = clamp(getNumber(metadata, OBJECT_NAMES.abcAnalysis, "thresholdA", DEFAULT_SETTINGS.abcAnalysis.thresholdA), CLAMPS.ABC_THRESHOLD_A.MIN, CLAMPS.ABC_THRESHOLD_A.MAX);
    let tB = clamp(getNumber(metadata, OBJECT_NAMES.abcAnalysis, "thresholdB", DEFAULT_SETTINGS.abcAnalysis.thresholdB), CLAMPS.ABC_THRESHOLD_B.MIN, CLAMPS.ABC_THRESHOLD_B.MAX);
    // Guarantee B > A; otherwise nudge them apart.
    if (tB <= tA) {
        tB = Math.min(100, tA + 1);
    }
    return {
        enabled: getBool(metadata, OBJECT_NAMES.abcAnalysis, "enabled", DEFAULT_SETTINGS.abcAnalysis.enabled),
        thresholdA: tA,
        thresholdB: tB,
        colorA: getColor(metadata, OBJECT_NAMES.abcAnalysis, "colorA", DEFAULT_SETTINGS.abcAnalysis.colorA),
        colorB: getColor(metadata, OBJECT_NAMES.abcAnalysis, "colorB", DEFAULT_SETTINGS.abcAnalysis.colorB),
        colorC: getColor(metadata, OBJECT_NAMES.abcAnalysis, "colorC", DEFAULT_SETTINGS.abcAnalysis.colorC)
    };
}

/* ============================================================
   COMBINE — the shoulder of all sub-resolvers
   ============================================================ */

/** Build the fully typed {@link Settings} aggregate. Pure synchronously callable. */
export function resolveSettings(metadata: DataViewMetadata | null | undefined): Settings {
    const md: DataViewMetadata = metadata || ({ objects: undefined } as unknown as DataViewMetadata);
    return {
        general: resolveGeneral(md),
        columns: resolveColumns(md),
        paretoLine: resolveParetoLine(md),
        targetLine: resolveTargetLine(md),
        referenceLines: resolveReferenceLines(md),
        cards: resolveCards(md),
        table: resolveTable(md),
        legend: resolveLegend(md),
        tooltip: resolveTooltip(md),
        animation: resolveAnimation(md),
        axes: resolveAxes(md),
        grid: resolveGrid(md),
        theme: resolveThemeSettings(md),
        statistics: resolveStatisticsSettings(md),
        abcAnalysis: resolveABCAnalysis(md)
    };
}

/* ============================================================
   FORMATTING MODEL API — describes the format-pane
   ============================================================ */

/**
 * Build the modern FormattingModel for the format pane.
 *
 * The Formatting Model API (introduced in visuals-api v5) replaces
 * enumerateObjectInstances with declarative card/group/slice descriptors
 * that the host renders into native Fluent UI. Each card maps to a
 * capabilities.json "objects" entry.
 *
 * @param dataView The host-supplied data view (used to populate persisted values).
 * @returns A FormattingModel containing every card declared in capabilities.
 */
export function buildFormattingModel(
    _dataView: powerbi.DataView | null
): settingsModel.FormattingModel {
    const model: settingsModel.FormattingModel = {
        cards: []
    };

    // ============================================================
    // GENERAL
    // ============================================================
    model.cards.push(makeCard("General", "formatting_general", [
        makeText("general", "titleText", "Title", "Title text shown above the chart"),
        makeToggle("general", "showTitle", "Show title", "Display the title above the chart"),
        makeComboBox("general", "layoutMode", "Layout", "Layout preset (auto, chart only, full dashboard)", [
            { value: "auto", displayName: "Auto" },
            { value: "chartOnly", displayName: "Chart only" },
            { value: "fullDashboard", displayName: "Full dashboard" }
        ]),
        makeComboBox("general", "theme", "Theme", "Visual color theme", [
            { value: "auto", displayName: "Auto (from report)" },
            { value: "light", displayName: "Light" },
            { value: "dark", displayName: "Dark" },
            { value: "corporate", displayName: "Corporate" }
        ])
    ]));

    // ============================================================
    // COLUMNS
    // ============================================================
    model.cards.push(makeCard("Columns", "formatting_columns", [
        makeToggle("columns", "show", "Show bars", null),
        makeInteger("columns", "radius", "Corner radius", 0, 24, null),
        makeToggle("columns", "useGradient", "Use gradient", null),
        makeColor("columns", "fillColor", "Fill color", null),
        makeColor("columns", "gradientStartColor", "Gradient start", null),
        makeColor("columns", "gradientEndColor", "Gradient end", null),
        makeColor("columns", "borderColor", "Border color", null),
        makeInteger("columns", "borderWidth", "Border width", 0, 8, null),
        makeToggle("columns", "shadow", "Drop shadow", null),
        makeInteger("columns", "opacity", "Opacity", 10, 100, null),
        makeInteger("columns", "width", "Bar width (%)", 10, 100, null),
        makeInteger("columns", "gap", "Bar gap", 0, 20, null),
        makeToggle("columns", "useABCColors", "Use ABC colors", null)
    ]));

    // ============================================================
    // PARETO LINE
    // ============================================================
    model.cards.push(makeCard("Pareto Line", "formatting_paretoLine", [
        makeToggle("paretoLine", "show", "Show Pareto line", null),
        makeComboBox("paretoLine", "lineType", "Line type", null, [
            { value: "straight", displayName: "Straight" },
            { value: "smooth", displayName: "Smooth" },
            { value: "bezier", displayName: "Bezier" }
        ]),
        makeColor("paretoLine", "color", "Line color", null),
        makeInteger("paretoLine", "width", "Line width", 1, 12, null),
        makeComboBox("paretoLine", "dashArray", "Dash style", null, [
            { value: "solid", displayName: "Solid" },
            { value: "dashed", displayName: "Dashed" },
            { value: "dotted", displayName: "Dotted" },
            { value: "dashDot", displayName: "Dash-Dot" }
        ]),
        makeToggle("paretoLine", "showMarkers", "Show markers", null),
        makeComboBox("paretoLine", "markerShape", "Marker shape", null, [
            { value: "circle", displayName: "Circle" },
            { value: "diamond", displayName: "Diamond" },
            { value: "square", displayName: "Square" }
        ]),
        makeInteger("paretoLine", "markerSize", "Marker size", 3, 16, null),
        makeColor("paretoLine", "markerColor", "Marker color", null)
    ]));

    // ============================================================
    // TARGET LINE
    // ============================================================
    model.cards.push(makeCard("Target Line", "formatting_targetLine", [
        makeToggle("targetLine", "show", "Show target line", null),
        makeInteger("targetLine", "value", "Target %", 1, 100, null),
        makeColor("targetLine", "color", "Line color", null),
        makeComboBox("targetLine", "dashArray", "Dash style", null, [
            { value: "solid", displayName: "Solid" },
            { value: "dashed", displayName: "Dashed" },
            { value: "dotted", displayName: "Dotted" },
            { value: "dashDot", displayName: "Dash-Dot" }
        ]),
        makeText("targetLine", "label", "Label", null)
    ]));

    // ============================================================
    // REFERENCE LINES
    // ============================================================
    model.cards.push(makeCard("Reference Lines", "formatting_referenceLines", [
        makeToggle("referenceLines", "show", "Show reference lines", "Unlimited user-defined lines on the secondary axis")
    ]));

    // ============================================================
    // CARDS
    // ============================================================
    model.cards.push(makeCard("Cards", "formatting_cards", [
        makeToggle("cards", "show", "Show KPI cards", null),
        makeInteger("cards", "fontSize", "Font size", 8, 32, null),
        makeColor("cards", "backgroundColor", "Background", null),
        makeColor("cards", "fontColor", "Font color", null)
    ]));

    // ============================================================
    // TABLE
    // ============================================================
    model.cards.push(makeCard("Table", "formatting_table", [
        makeToggle("table", "show", "Show summary table", null),
        makeInteger("table", "fontSize", "Font size", 8, 24, null),
        makeToggle("table", "showRank", "Show rank", null),
        makeToggle("table", "showValue", "Show value", null),
        makeToggle("table", "showPercent", "Show %", null),
        makeToggle("table", "showRunningTotal", "Show running total", null),
        makeToggle("table", "showABC", "Show ABC", null),
        makeToggle("table", "showVariance", "Show variance", null),
        makeInteger("table", "maxRows", "Max rows", 1, 1000, null)
    ]));

    // ============================================================
    // LEGEND
    // ============================================================
    model.cards.push(makeCard("Legend", "formatting_legend", [
        makeToggle("legend", "show", "Show legend", null),
        makeComboBox("legend", "position", "Position", null, [
            { value: "top", displayName: "Top" },
            { value: "bottom", displayName: "Bottom" },
            { value: "left", displayName: "Left" },
            { value: "right", displayName: "Right" }
        ])
    ]));

    // ============================================================
    // TOOLTIP
    // ============================================================
    model.cards.push(makeCard("Tooltip", "formatting_tooltip", [
        makeToggle("tooltip", "showCategory", "Show category", null),
        makeToggle("tooltip", "showValue", "Show value", null),
        makeToggle("tooltip", "showPercent", "Show %", null),
        makeToggle("tooltip", "showRunningTotal", "Show running total", null),
        makeToggle("tooltip", "showABC", "Show ABC", null),
        makeToggle("tooltip", "showRank", "Show rank", null),
        makeToggle("tooltip", "showDifference", "Show difference", null),
        makeToggle("tooltip", "showAverage", "Show average", null)
    ]));

    // ============================================================
    // ANIMATION
    // ============================================================
    model.cards.push(makeCard("Animation", "formatting_animation", [
        makeToggle("animation", "enabled", "Enable animation", null),
        makeComboBox("animation", "type", "Animation type", null, [
            { value: "fade", displayName: "Fade" },
            { value: "grow", displayName: "Grow" },
            { value: "slide", displayName: "Slide" },
            { value: "bounce", displayName: "Bounce" },
            { value: "elastic", displayName: "Elastic" }
        ]),
        makeInteger("animation", "duration", "Duration (ms)", 0, 3000, null),
        makeInteger("animation", "delay", "Delay (ms)", 0, 2000, null)
    ]));

    // ============================================================
    // AXES
    // ============================================================
    model.cards.push(makeCard("Axes", "formatting_axes", [
        makeToggle("axes", "dualAxis", "Dual axis", null),
        makeToggle("axes", "showXTitle", "Show X title", null),
        makeToggle("axes", "showYTitle", "Show Y title", null),
        makeText("axes", "xTitle", "X title", null),
        makeText("axes", "yTitle", "Y title", null),
        makeComboBox("axes", "displayUnits", "Display units", null, [
            { value: "auto", displayName: "Auto" },
            { value: "none", displayName: "None" },
            { value: "thousands", displayName: "Thousands (K)" },
            { value: "millions", displayName: "Millions (M)" },
            { value: "billions", displayName: "Billions (B)" }
        ]),
        makeToggle("axes", "thousandsSeparator", "Thousands separator", null),
        makeInteger("axes", "decimalPlaces", "Decimal places", 0, 6, null)
    ]));

    // ============================================================
    // GRID
    // ============================================================
    model.cards.push(makeCard("Grid", "formatting_grid", [
        makeToggle("grid", "showMajor", "Show major grid", null),
        makeToggle("grid", "showMinor", "Show minor grid", null),
        makeColor("grid", "color", "Grid color", null)
    ]));

    // ============================================================
    // THEME ENGINE
    // ============================================================
    model.cards.push(makeCard("Theme Engine", "formatting_theme", [
        makeComboBox("theme", "palette", "Palette", null, [
            { value: "default", displayName: "Default Fluent" },
            { value: "warm", displayName: "Warm" },
            { value: "cool", displayName: "Cool" },
            { value: "monochrome", displayName: "Monochrome" }
        ])
    ]));

    // ============================================================
    // STATISTICS
    // ============================================================
    model.cards.push(makeCard("Statistics", "formatting_statistics", [
        makeToggle("statistics", "showMedian", "Show median", null),
        makeToggle("statistics", "showStdDev", "Show std dev", null),
        makeToggle("statistics", "showGini", "Show Gini", null)
    ]));

    // ============================================================
    // ABC ANALYSIS
    // ============================================================
    model.cards.push(makeCard("ABC Analysis", "formatting_abcAnalysis", [
        makeToggle("abcAnalysis", "enabled", "Enable ABC", null),
        makeInteger("abcAnalysis", "thresholdA", "Class A threshold (%)", 1, 99, null),
        makeInteger("abcAnalysis", "thresholdB", "Class B threshold (%)", 2, 100, null),
        makeColor("abcAnalysis", "colorA", "Class A color", null),
        makeColor("abcAnalysis", "colorB", "Class B color", null),
        makeColor("abcAnalysis", "colorC", "Class C color", null)
    ]));

    return model;
}

/* ============================================================
   FORMATTING MODEL HELPERS — declarative slice builders
   ============================================================ */

interface ComboBoxItem {
    readonly value: string;
    readonly displayName: string;
}

function makeCard(
    displayName: string,
    displayNameKey: string,
    groups: settingsModel.FormattingGroup[]
): settingsModel.FormattingCard {
    return {
        displayName,
        displayNameKey,
        description: "",
        uid: displayNameKey,
        groups,
        containers: undefined,
        annotation: undefined,
       selectorKey: undefined as unknown as string
    } as unknown as settingsModel.FormattingCard;
}

function makeGroup(
    objectName: string,
    slices: settingsModel.FormattingSlice[]
): settingsModel.FormattingGroup {
    return {
        uid: objectName,
        displayName: objectName,
        displayNameKey: objectName,
        slices
    } as unknown as settingsModel.FormattingGroup;
}

function makeText(objectName: string, propertyName: string, displayName: string, description: string | null): settingsModel.FormattingSlice {
    return {
        uid: `${objectName}-${propertyName}`,
        objectName,
        propertyName,
        displayName,
        displayNameKey: `${objectName}_${propertyName}`,
        description: description || "",
        control: {
            type: "TextInput",
            properties: { placeholder: displayName }
        } as unknown as settingsModel.FormattingControl
    } as unknown as settingsModel.FormattingSlice;
}

function makeToggle(objectName: string, propertyName: string, displayName: string, description: string | null): settingsModel.FormattingSlice {
    return {
        uid: `${objectName}-${propertyName}`,
        objectName,
        propertyName,
        displayName,
        displayNameKey: `${objectName}_${propertyName}`,
        description: description || "",
        control: {
            type: "ToggleSwitch",
            properties: {}
        } as unknown as settingsModel.FormattingControl
    } as unknown as settingsModel.FormattingSlice;
}

function makeInteger(objectName: string, propertyName: string, displayName: string, min: number, max: number, description: string | null): settingsModel.FormattingSlice {
    return {
        uid: `${objectName}-${propertyName}`,
        objectName,
        propertyName,
        displayName,
        displayNameKey: `${objectName}_${propertyName}`,
        description: description || "",
        control: {
            type: "NumUpDown",
            properties: { minimun: min, maximum: max }
        } as unknown as settingsModel.FormattingControl
    } as unknown as settingsModel.FormattingSlice;
}

function makeColor(objectName: string, propertyName: string, displayName: string, description: string | null): settingsModel.FormattingSlice {
    return {
        uid: `${objectName}-${propertyName}`,
        objectName,
        propertyName,
        displayName,
        displayNameKey: `${objectName}_${propertyName}`,
        description: description || "",
        control: {
            type: "ColorPicker",
            properties: {}
        } as unknown as settingsModel.FormattingControl
    } as unknown as settingsModel.FormattingSlice;
}

function makeComboBox(objectName: string, propertyName: string, displayName: string, description: string | null, items: ComboBoxItem[]): settingsModel.FormattingSlice {
    return {
        uid: `${objectName}-${propertyName}`,
        objectName,
        propertyName,
        displayName,
        displayNameKey: `${objectName}_${propertyName}`,
        description: description || "",
        control: {
            type: "ComboBox",
            properties: {
                items: items.map(i => ({ value: i.value, displayName: i.displayName }))
            }
        } as unknown as settingsModel.FormattingControl
    } as unknown as settingsModel.FormattingSlice;
}
