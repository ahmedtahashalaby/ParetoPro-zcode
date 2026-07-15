/**
 * Pareto Pro Enterprise — Bar Renderer
 * -----------------------------------
 * Renders the clustered bar chart: rounded rectangles with optional
 * gradient fills, borders, drop shadows, ABC coloring, hover highlight,
 * and selection dimming. Uses a keyed D3 enter/update/exit join to keep
 * DOM updates minimal and bookmarks stable.
 *
 * @module    bars
 * @version   1.0.0
 */

import * as d3Selection from "d3-selection";

import {
    ParetoPoint,
    Settings,
    ABCClass
} from "./interfaces";
import { ThemePalette } from "./theme";
import { AxisState } from "./axis";
import { AnimationConfig, animate, enterInitial } from "./animations";
import { LAYER_IDS } from "./constants";
import { clamp } from "./utils";

type D3Sel<G extends d3Selection.BaseType = SVGGElement>
    = d3Selection.Selection<G, ParetoPoint, d3Selection.BaseType, unknown>;

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Render the bars into the chart root, keyed by point identity.
 * Returns the bar selection so {selection.ts} can attach handlers.
 */
export function drawBars(
    root: d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown>,
    points: ReadonlyArray<ParetoPoint>,
    state: AxisState,
    settings: Settings,
    palette: ThemePalette,
    offset: { x: number; y: number },
    animation: AnimationConfig
): d3Selection.Selection<SVGRectElement, ParetoPoint, d3Selection.BaseType, unknown> {
    let g = root.select<SVGGElement>(`#${LAYER_IDS.BARS}`);
    if (g.empty()) {
        g = root.append("g").attr("id", LAYER_IDS.BARS);
    }
    g.attr("transform", `translate(${offset.x},${offset.y})`);

    // Ensure the gradient + shadow defs exist once.
    ensureDefs(root, settings, palette);

    const bandStep = state.x.step();
    const bandInner = state.x.bandwidth();
    // Apply user bar-width percentage (10..100) — truncates the bar within band.
    const barWidth = Math.max(2, (bandInner * settings.columns.width) / 100);

    const sel = g.selectAll<SVGRectElement, ParetoPoint>("rect.ppe-bar")
        .data(points, d => d.key);

    const enter = sel.enter()
        .append("rect")
        .attr("class", d => barClass(d, settings, palette))
        .attr("data-key", d => d.key)
        .attr("x", d => bandCenterX(d, state, barWidth))
        .attr("y", state.plot.height)
        .attr("width", barWidth)
        .attr("height", 0)
        .attr("rx", settings.columns.radius)
        .attr("ry", settings.columns.radius)
        .attr("fill", d => barFill(d, settings, palette, bandInner))
        .attr("stroke", settings.columns.borderColor)
        .attr("stroke-width", settings.columns.borderWidth)
        .attr("opacity", 0)
        .style("cursor", "pointer")
        .style("filter", settings.columns.shadow ? "url(#ppe-bar-shadow)" : null);

    sel.exit()
        .transition()
        .duration(animation.degraded ? 0 : Math.min(200, animation.duration))
        .attr("height", 0)
        .attr("y", state.plot.height)
        .attr("opacity", 0)
        .remove();

    const merged = enter.merge(sel as D3Sel<SVGRectElement>);

    // Apply enter-initial state on entering bars before animating.
    const init = enterInitial(animation.type);
    merged
        .attr("x", d => bandCenterX(d, state, barWidth))
        .attr("width", barWidth)
        .attr("rx", settings.columns.radius)
        .attr("ry", settings.columns.radius)
        .attr("fill", d => barFill(d, settings, palette, bandInner))
        .attr("stroke", settings.columns.borderColor)
        .attr("stroke-width", settings.columns.borderWidth)
        .attr("opacity", d => pointOpacity(d, settings))
        .style("filter", settings.columns.shadow ? "url(#ppe-bar-shadow)" : null)
        .attr("class", d => barClass(d, settings, palette));

    const t = animate(merged as unknown as d3Selection.Selection<SVGRectElement, ParetoPoint, d3Selection.BaseType, unknown>, animation);
    t
        .attr("y", d => barY(d, state))
        .attr("height", d => Math.max(0.5, barHeight(d, state)))
        .tween("opacity-fade", function (this: SVGRectElement, d: ParetoPoint) {
            const target = pointOpacity(d, settings);
            const start = Number(this.getAttribute("data-fade-from") || init.opacity);
            const interp = d3Selection.interpolateNumber(start, target);
            return (tt: number) => { this.setAttribute("opacity", String(interp(tt))); };
        });

    // Store band step so labels can re-use it without re-deriving.
    g.attr("data-band-step", String(bandStep));

    return merged;
}

/* ============================================================
   INTERNAL
   ============================================================ */

function barClass(d: ParetoPoint, settings: Settings, palette: ThemePalette): string {
    void palette;
    const classes = ["ppe-bar"];
    if (d.isSelected) classes.push("ppe-bar--selected");
    if (settings.columns.useABCColors) classes.push(`ppe-bar--abc-${d.abcClass.toLowerCase()}`);
    return classes.join(" ");
}

/** Resolve the fillSpec for a particular bar. */
function barFill(
    d: ParetoPoint,
    settings: Settings,
    palette: ThemePalette,
    bandWidth: number
): string {
    void bandWidth;
    let baseColor: string;
    if (settings.columns.useABCColors) {
        baseColor = abcColor(d.abcClass, settings, palette);
    } else if (settings.columns.useGradient) {
        return `url(#ppe-bar-gradient)`;
    } else {
        baseColor = settings.columns.fillColor;
    }
    if (settings.columns.useGradient && settings.columns.useABCColors) {
        // Optional gradient anchored on the ABC class color: pass the color via defs later.
        return baseColor;
    }
    return baseColor;
}

function abcColor(cls: ABCClass, settings: Settings, palette: ThemePalette): string {
    if (settings.abcAnalysis.enabled) {
        switch (cls) {
            case ABCClass.A: return settings.abcAnalysis.colorA;
            case ABCClass.B: return settings.abcAnalysis.colorB;
            case ABCClass.C: return settings.abcAnalysis.colorC;
            default: return settings.columns.fillColor;
        }
    }
    return palette.abcColors[cls];
}

function bandCenterX(d: ParetoPoint, state: AxisState, barWidth: number): number {
    const bandX = state.x(d.category) || 0;
    return bandX + (state.x.bandwidth() - barWidth) / 2;
}

function barY(d: ParetoPoint, state: AxisState): number {
    return state.yLeft(d.value);
}

function barHeight(d: ParetoPoint, state: AxisState): number {
    return Math.max(0, state.plot.height - state.yLeft(d.value));
}

function pointOpacity(d: ParetoPoint, settings: Settings): number {
    const dimmed = d.isHighlight && settings.columns.useABCColors && !d.isSelected;
    const baseOpacity = clamp(settings.columns.opacity, 10, 100) / 100;
    return dimmed ? Math.min(0.4, baseOpacity) : baseOpacity;
}

/* ============================================================
   SVG DEFS — gradient, drop shadow (created once per visual root)
   ============================================================ */

function ensureDefs(
    root: d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown>,
    settings: Settings,
    palette: ThemePalette
): void {
    let defs = root.select<SVGDefsElement>("defs");
    if (defs.empty()) {
        defs = root.append("defs");
    }

    void palette;

    // Linear gradient — start at top, end at bottom.
    const startColor = settings.columns.useABCColors
        ? settings.abcAnalysis.colorA
        : settings.columns.gradientStartColor;
    const endColor = settings.columns.useABCColors
        ? settings.abcAnalysis.colorC
        : settings.columns.gradientEndColor;

    let grad = defs.select<SVGLinearGradientElement>("#ppe-bar-gradient");
    if (grad.empty()) {
        grad = defs.append("linearGradient")
            .attr("id", "ppe-bar-gradient")
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "0%").attr("y2", "100%");
        grad.append("stop").attr("offset", "0%");
        grad.append("stop").attr("offset", "100%");
    }
    grad.select("stop:nth-child(1)").attr("stop-color", startColor);
    grad.select("stop:nth-child(2)").attr("stop-color", endColor);

    // Drop shadow filter.
    let shadow = defs.select<SVGFilterElement>("#ppe-bar-shadow");
    if (shadow.empty()) {
        shadow = defs.append("filter")
            .attr("id", "ppe-bar-shadow")
            .attr("x", "-20%").attr("y", "-20%")
            .attr("width", "140%").attr("height", "140%");
        shadow.append("feDropShadow")
            .attr("dx", "0").attr("dy", "2")
            .attr("stdDeviation", "2")
            .attr("flood-color", "rgba(0,0,0,0.18)");
    }
}
