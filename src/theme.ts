/**
 * Pareto Pro Enterprise — Theme Engine
 * ------------------------------------
 * Central registry of Fluent-themed palettes for Light, Dark, Corporate,
 * and High-Contrast modes. Each palette supplies surface colors, axis
 * colors, grid colors, and the ABC class colors used by the bar renderer.
 *
 * Theme resolution flow:
 *   1. User picks ThemeMode.Auto/Light/Dark/Corporate in the format pane.
 *   2. {@link theme.resolveTheme} merges that choice with the Power BI
 *      host's reported background color (when Auto) and produces a fully
 *      resolved {@link ThemePalette}.
 *   3. Renderers read the palette — never raw CSS — ensuring a single
 *      source of truth for every colored element.
 *
 * @module    theme
 * @version   1.0.0
 */

import powerbiVisualsApi from "powerbi-visuals-api";
import VisualUpdateOptions = powerbiVisualsApi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbiVisualsApi.extensibility.IVisualHost;

import {
    ABCClass,
    PaletteName,
    ThemeMode
} from "./interfaces";
import { ABC_DEFAULTS } from "./constants";

/* ============================================================
   PALETTE — internal representation
   ============================================================ */

/**
 * A fully resolved palette. Every renderer reads from this struct so that
 * a theme switch is a pure data change — no CSS string concatenation.
 */
export interface ThemePalette {
    readonly mode: ThemeMode;
    readonly name: PaletteName;
    /** Background of the overall visual surface (transparent = use report). */
    readonly background: string;
    /** Card surface color. */
    readonly surface: string;
    /** Alternate surface (table stripes, header). */
    readonly surfaceAlt: string;
    /** Primary text color. */
    readonly text: string;
    /** Muted / secondary text color. */
    readonly textMuted: string;
    /** Border / divider color. */
    readonly border: string;
    /** Axis line + tick label color. */
    readonly axis: string;
    /** Major gridline color. */
    readonly grid: string;
    /** Minor gridline color. */
    readonly gridMinor: string;
    /** Drop-shadow tint (used in SVG filters and Card box-shadows). */
    readonly shadowTint: string;
    /** Accent color (selected element outline, legend marker, target line default). */
    readonly accent: string;
    /** Soft accent (hover row, dim overlays). */
    readonly accentSoft: string;
    /** ABC class colors keyed by class enumeration. */
    readonly abcColors: Record<ABCClass, string>;
    /** Pareto line default color. */
    readonly paretoLineColor: string;
    /** Marker default color. */
    readonly markerColor: string;
    /** Bars fill color when ABC colors are disabled. */
    readonly barFill: string;
    /** Gradient stops when gradient is enabled. */
    readonly gradient: { start: string; end: string };
}

/* ============================================================
   STATIC BASE PALETTES — one per ThemeMode
   ============================================================ */

const LIGHT_BASE: Omit<ThemePalette, "mode" | "name" | "abcColors"> = {
    background: "transparent",
    surface: "#ffffff",
    surfaceAlt: "#f5f7fa",
    text: "#242424",
    textMuted: "#616161",
    border: "#e6e8eb",
    axis: "#616161",
    grid: "#e9ecef",
    gridMinor: "#f0f2f5",
    shadowTint: "rgba(0,0,0,0.08)",
    accent: "#0078d4",
    accentSoft: "rgba(0,120,212,0.12)",
    paretoLineColor: "#d83b01",
    markerColor: "#d83b01",
    barFill: "#0078d4",
    gradient: { start: "#4db8ff", end: "#0078d4" }
};

const DARK_BASE: Omit<ThemePalette, "mode" | "name" | "abcColors"> = {
    background: "transparent",
    surface: "#2b2b2b",
    surfaceAlt: "#333333",
    text: "#ffffff",
    textMuted: "#c8c8c8",
    border: "#404040",
    axis: "#c8c8c8",
    grid: "#404040",
    gridMinor: "#383838",
    shadowTint: "rgba(0,0,0,0.35)",
    accent: "#4db8ff",
    accentSoft: "rgba(77,184,255,0.18)",
    paretoLineColor: "#ffb14d",
    markerColor: "#ffb14d",
    barFill: "#4db8ff",
    gradient: { start: "#7ad0ff", end: "#2b8ad6" }
};

const CORPORATE_BASE: Omit<ThemePalette, "mode" | "name" | "abcColors"> = {
    background: "transparent",
    surface: "#ffffff",
    surfaceAlt: "#f4f6f9",
    text: "#1b2a4a",
    textMuted: "#5a6a8a",
    border: "#d8dee9",
    axis: "#5a6a8a",
    grid: "#e3e8ef",
    gridMinor: "#eef1f6",
    shadowTint: "rgba(27,42,74,0.10)",
    accent: "#005a9e",
    accentSoft: "rgba(0,90,158,0.12)",
    paretoLineColor: "#c8553d",
    markerColor: "#c8553d",
    barFill: "#005a9e",
    gradient: { start: "#4d8cc4", end: "#005a9e" }
};

const HIGHCONTRAST_BASE: Omit<ThemePalette, "mode" | "name" | "abcColors"> = {
    background: "Window",
    surface: "Window",
    surfaceAlt: "Window",
    text: "WindowText",
    textMuted: "WindowText",
    border: "WindowText",
    axis: "WindowText",
    grid: "GrayText",
    gridMinor: "GrayText",
    shadowTint: "transparent",
    accent: "Highlight",
    accentSoft: "Highlight",
    paretoLineColor: "WindowText",
    markerColor: "WindowText",
    barFill: "Highlight",
    gradient: { start: "Highlight", end: "Highlight" }
};

/* ============================================================
   ABC COLOR OVERRIDES — per palette flavor
   ============================================================ */

interface PaletteABC {
    readonly A: string;
    readonly B: string;
    readonly C: string;
}

const PALETTE_FLAVOR_ABC: Record<PaletteName, PaletteABC> = {
    [PaletteName.Default]: {
        A: ABC_DEFAULTS.COLOR_A.normal,
        B: ABC_DEFAULTS.COLOR_B.normal,
        C: ABC_DEFAULTS.COLOR_C.normal
    },
    [PaletteName.Warm]: {
        A: "#c23616",
        B: "#e58e26",
        C: "#d2ab66"
    },
    [PaletteName.Cool]: {
        A: "#0a3d62",
        B: "#3867d6",
        C: "#74b9ff"
    },
    [PaletteName.Monochrome]: {
        A: "#242424",
        B: "#616161",
        C: "#a8a8a8"
    }
};

function abcColorsFor(palette: PaletteName): Record<ABCClass, string> {
    const f = PALETTE_FLAVOR_ABC[palette];
    return {
        [ABCClass.A]: f.A,
        [ABCClass.B]: f.B,
        [ABCClass.C]: f.C
    };
}

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Resolve the active theme palette from a user-picked mode + host info.
 *
 * - {@link ThemeMode.Auto}: chooses Light or Dark based on the report's
 *   average background luminance, with High-Contrast override applied
 *   when the visual host reports it.
 * - Explicit modes force that base regardless of report context.
 *
 * @param userMode      The mode the user picked in the format pane.
 * @param paletteFlavor The ABC-palette flavor (Default/Warm/Cool/Monochrome).
 * @param options       The Power BI update options (used for viewport + theme).
 * @param host          The visual host (used to query high-contrast state).
 * @returns             A fully resolved, immutable {@link ThemePalette}.
 */
export function resolveTheme(
    userMode: ThemeMode,
    paletteFlavor: PaletteName,
    options: VisualUpdateOptions,
    host: IVisualHost
): ThemePalette {
    // High-contrast always wins — it's an OS-level accessibility setting.
    const colorPalette: powerbiVisualsApi.extensibility.IColorPalette =
        host.colorPalette;
    if (host.highContrast && host.highContrast.enabled) {
        return withMode(HIGHCONTRAST_BASE, ThemeMode.HighContrast, paletteFlavor);
    }

    if (userMode === ThemeMode.Light) {
        return withMode(LIGHT_BASE, ThemeMode.Light, paletteFlavor);
    }
    if (userMode === ThemeMode.Dark) {
        return withMode(DARK_BASE, ThemeMode.Dark, paletteFlavor);
    }
    if (userMode === ThemeMode.Corporate) {
        return withMode(CORPORATE_BASE, ThemeMode.Corporate, paletteFlavor);
    }

    // Auto: pick from the host's reported background if we can read it.
    const effectiveMode = inferModeFromHost(host);
    if (effectiveMode === ThemeMode.Dark) {
        return withMode(DARK_BASE, ThemeMode.Dark, paletteFlavor);
    }
    if (effectiveMode === ThemeMode.Corporate) {
        return withMode(CORPORATE_BASE, ThemeMode.Corporate, paletteFlavor);
    }
    return withMode(LIGHT_BASE, ThemeMode.Light, paletteFlavor);
}

/**
 * Build a fully populated palette from a base + resolved mode + flavor.
 * All overridden (per-flavor) ABC colors take precedence over user ABC
 * settings — those are applied later by {@link settings.ts}.
 */
function withMode(
    base: Omit<ThemePalette, "mode" | "name" | "abcColors">,
    mode: ThemeMode,
    flavor: PaletteName
): ThemePalette {
    return {
        ...base,
        mode,
        name: flavor,
        abcColors: abcColorsFor(flavor)
    };
}

/**
 * Inspect the host's color palette to guess dark vs light.
 * Falls back to a luminance probe of `colorPalette.background`.
 */
function inferModeFromHost(host: IVisualHost): ThemeMode {
    try {
        const cp = host.colorPalette;
        const bg = cp && cp.background ? cp.background.value : "#ffffff";
        return isColorDark(bg) ? ThemeMode.Dark : ThemeMode.Light;
    } catch {
        return ThemeMode.Light;
    }
}

/**
 * W3C-ish relative luminance probe: returns true for dark colors.
 * @param hex A leading-# hex string (e.g. "#1b2a4a"); other formats return false.
 */
function isColorDark(hex: string): boolean {
    if (!hex || hex[0] !== "#" || hex.length < 7) {
        return false;
    }
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    // Rec. 709 luma — fast and sufficient for theme decisions.
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luma < 0.45;
}

/**
 * Return the CSS modifier class for the root container — drives the
 * LESS variables in `style/visual.less`.
 */
export function themeModeClass(mode: ThemeMode): string {
    switch (mode) {
        case ThemeMode.Dark:        return "ppe-theme--dark";
        case ThemeMode.Corporate:   return "ppe-theme--corporate";
        case ThemeMode.HighContrast:return "ppe-theme--hc";
        case ThemeMode.Light:
        case ThemeMode.Auto:
        default:                   return "ppe-theme--light";
    }
}
