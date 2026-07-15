/**
 * Pareto Pro Enterprise — Axis Module
 * ----------------------------------
 * Builds the dual-axis geometry: x band scale (categories), primary
 * linear y-axis (values), and secondary linear y-axis (cumulative %).
 *
 * Only this module owns axis DOM, scales, ticks, and titles. Renderers
 * for bars, line, and labels consume the immutable {@link AxisState}
 * it produces.
 *
 * @module    axis
 * @version   1.0.0
 */

import * as d3Selection from "d3-selection";
import * as d3Scale from "d3-scale";
import * as d3Array from "d3-array";
import * as d3Axis from "d3-axis";

import {
    Layout,
    ParetoPoint,
    Settings,
    Rect
} from "./interfaces";
import { ThemePalette } from "./theme";
import {
    AXIS_LEFT_TICKS,
    AXIS_RIGHT_TICKS,
    LAYER_IDS,
    SCALE_PCT_MAX,
    SCALE_PCT_MIN,
    SCALE_VALUE_MIN
} from "./constants";
import { displayUnitLabel, FormatOptions } from "./formatter";

type FnSel = (sel: d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown>) => void;

/* ============================================================
   AXIS STATE
   ============================================================ */

export interface AxisState {
    readonly x: d3Scale.ScaleBand<string>;
    readonly yLeft: d3Scale.ScaleLinear<number, number>;
    readonly yRight: d3Scale.ScaleLinear<number, number>;
    readonly plot: Rect;
    readonly formatLeft: (v: number) => string;
    readonly formatRight: (v: number) => string;
}

/* ============================================================
   PUBLIC API
   ============================================================ */

export function buildAxisState(
    points: ReadonlyArray<ParetoPoint>,
    layout: Layout,
    settings: Settings
): AxisState {
    const plot: Rect = {
        x: 0,
        y: 0,
        width: Math.max(10, layout.chart.width - layout.marginLeft - layout.marginRight),
        height: Math.max(10, layout.chart.height - layout.marginTop - layout.marginBottom)
    };

    const categories = points.map(p => p.category);
    const x = d3Scale.scaleBand<string>()
        .domain(categories)
        .range([0, plot.width])
        .paddingInner(innerPad(settings.columns.gap))
        .paddingOuter(0.1)
        .align(0.5);

    const maxVal = d3Array.max(points, p => p.value) || 0;
    const yLeft = d3Scale.scaleLinear()
        .domain([SCALE_VALUE_MIN, maxVal * 1.05 || 1])
        .range([plot.height, 0])
        .nice();

    const yRight = d3Scale.scaleLinear()
        .domain([SCALE_PCT_MIN, SCALE_PCT_MAX])
        .range([plot.height, 0]);

    const fmtLeftOpts: FormatOptions = {
        displayUnits: settings.axes.displayUnits,
        thousandsSeparator: settings.axes.thousandsSeparator,
        decimalPlaces: settings.axes.decimalPlaces
    };

    return {
        x,
        yLeft,
        yRight,
        plot,
        formatLeft: (v: number) => formatValue(v, fmtLeftOpts),
        formatRight: (v: number) => `${Math.round(v)}%`
    };
}

/**
 * Render the axes, gridlines, and titles into the chart <g>.
 */
export function drawAxes(
    root: d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown>,
    state: AxisState,
    settings: Settings,
    palette: ThemePalette,
    offset: { x: number; y: number }
): void {
    drawGrid(root, state, palette, offset, settings.grid.showMajor, settings.grid.showMinor);

    const gLeft = ensureGroup(root, LAYER_IDS.AXIS_Y_LEFT);
    const leftAxis = d3Axis.axisLeft(state.yLeft)
        .ticks(AXIS_LEFT_TICKS)
        .tickFormat(v => state.formatLeft(Number(v)));
    applyAxis(gLeft, leftAxis, `${offset.x},${offset.y}`);

    if (settings.axes.dualAxis) {
        const gRight = ensureGroup(root, LAYER_IDS.AXIS_Y_RIGHT);
        const rightAxis = d3Axis.axisRight(state.yRight)
            .ticks(AXIS_RIGHT_TICKS)
            .tickFormat(v => state.formatRight(Number(v)));
        applyAxis(gRight, rightAxis, `${offset.x + state.plot.width},${offset.y}`);
    } else {
        root.select(`#${LAYER_IDS.AXIS_Y_RIGHT}`).remove();
    }

    const gX = ensureGroup(root, LAYER_IDS.AXIS_X);
    const xAxis = d3Axis.axisBottom(state.x).tickSize(0);
    applyAxis(gX, xAxis, `${offset.x},${offset.y + state.plot.height}`);

    gX.selectAll<SVGTextElement, unknown>(".tick text")
        .attr("transform", "rotate(-35)")
        .style("text-anchor", "end")
        .text(function (this: SVGTextElement, d: unknown) {
            const s = String(d);
            return s.length > 16 ? s.slice(0, 15) + "..." : s;
        });

    drawAxisTitles(root, state, settings, palette, offset);
}

/* ============================================================
   INTERNAL
   ============================================================ */

function applyAxis(
    g: d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown>,
    axis: d3Axis.Axis<SVGGElement>,
    translate: string
): void {
    g
        .attr("class", "ppe-axis")
        .attr("transform", `translate(${translate})`)
        .transition()
        .duration(200)
        .call(axis as unknown as FnSel) as unknown as d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown>;
}

function drawGrid(
    root: d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown>,
    state: AxisState,
    palette: ThemePalette,
    offset: { x: number; y: number },
    showMajor: boolean,
    showMinor: boolean
): void {
    void palette;
    if (showMajor) {
        const gMajor = ensureGroup(root, LAYER_IDS.GRID);
        const grid = d3Axis.axisLeft(state.yLeft)
            .ticks(AXIS_LEFT_TICKS)
            .tickSize(-state.plot.width)
            .tickFormat(() => "");
        gMajor
            .attr("class", "ppe-grid")
            .attr("transform", `translate(${offset.x},${offset.y})`)
            .call(grid as unknown as FnSel);
        gMajor.selectAll("path").remove();
    } else {
        root.select(`#${LAYER_IDS.GRID}`).remove();
    }

    if (showMinor) {
        const gMinor = ensureGroup(root, LAYER_IDS.GRID_MINOR);
        const minor = d3Axis.axisLeft(state.yLeft)
            .ticks(AXIS_LEFT_TICKS * 2)
            .tickSize(-state.plot.width)
            .tickFormat(() => "");
        gMinor
            .attr("class", "ppe-grid ppe-grid--minor")
            .attr("transform", `translate(${offset.x},${offset.y})`)
            .call(minor as unknown as FnSel);
        gMinor.selectAll("path").remove();
    } else {
        root.select(`#${LAYER_IDS.GRID_MINOR}`).remove();
    }
}

function drawAxisTitles(
    root: d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown>,
    state: AxisState,
    settings: Settings,
    palette: ThemePalette,
    offset: { x: number; y: number }
): void {
    if (settings.axes.showYTitle) {
        const cy = offset.y + state.plot.height / 2;
        const yTitle = ensureText(root, "ppe-ytitle", -offset.x - 4, cy);
        yTitle
            .attr("class", "ppe-axis-title")
            .attr("text-anchor", "middle")
            .attr("transform", `rotate(-90 ${-offset.x - 4} ${cy})`)
            .text(fillTitle(settings.axes.yTitle, "Value"));
    } else {
        root.select("#ppe-ytitle").remove();
    }

    if (settings.axes.showXTitle) {
        const xTitle = ensureText(root, "ppe-xtitle", offset.x + state.plot.width / 2, offset.y + state.plot.height + 42);
        xTitle
            .attr("class", "ppe-axis-title")
            .attr("text-anchor", "middle")
            .text(fillTitle(settings.axes.xTitle, "Category"));
    } else {
        root.select("#ppe-xtitle").remove();
    }

    if (settings.axes.dualAxis) {
        const rightLabel = ensureText(root, "ppe-rightlabel", offset.x + state.plot.width + 10, offset.y - 4);
        rightLabel
            .attr("class", "ppe-axis-title")
            .attr("text-anchor", "start")
            .text("Cumulative %");
    } else {
        root.select("#ppe-rightlabel").remove();
    }

    const opts: FormatOptions = {
        displayUnits: settings.axes.displayUnits,
        thousandsSeparator: settings.axes.thousandsSeparator,
        decimalPlaces: settings.axes.decimalPlaces
    };
    const hint = displayUnitLabel(opts);
    if (hint) {
        const lh = ensureText(root, "ppe-leftlabel", offset.x - 6, offset.y - 8);
        lh.attr("class", "ppe-axis-title").attr("text-anchor", "end").text(hint);
    } else {
        root.select("#ppe-leftlabel").remove();
    }
}

function fillTitle(userProvided: string, fallback: string): string {
    if (userProvided && userProvided.trim()) {
        return userProvided;
    }
    return fallback;
}

function ensureText(
    root: d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown>,
    id: string,
    x: number,
    y: number
): d3Selection.Selection<SVGTextElement, unknown, d3Selection.BaseType, unknown> {
    let sel = root.select<SVGTextElement>(`#${id}`);
    if (sel.empty()) {
        sel = root.append("text").attr("id", id);
    }
    return sel.attr("x", x).attr("y", y);
}

function innerPad(gap: number): number {
    return Math.max(0.05, Math.min(0.5, gap / 20));
}

function formatValue(v: number, opts: FormatOptions): string {
    if (!Number.isFinite(v)) {
        return "";
    }
    const dp = opts.decimalPlaces > 0 ? opts.decimalPlaces : 1;
    if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(dp)}B`;
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(dp)}M`;
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(dp)}K`;
    return v.toFixed(opts.decimalPlaces > 0 ? opts.decimalPlaces : 0);
}

function ensureGroup(
    root: d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown>,
    id: string
): d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown> {
    let sel = root.select<SVGGElement>(`#${id}`);
    if (sel.empty()) {
        sel = root.append("g").attr("id", id);
    }
    return sel;
}
