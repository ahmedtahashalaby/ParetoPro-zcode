/**
 * Pareto Pro Enterprise — Data Labels
 * -----------------------------------
 * Optional text glyphs above each bar / on each marker. Shapes supported:
 * value, percentage, running total, category — each independently togglable.
 *
 * Labels have pointer-events: none so they never intercept the underlying
 * bar/marker hit areas. Auto-positioning keeps them clear of the bar top
 * by default.
 *
 * @module    labels
 * @version   1.0.0
 */

import * as d3Selection from "d3-selection";

import { ParetoPoint, Settings } from "./interfaces";
import { AxisState } from "./axis";
import { AnimationConfig } from "./animations";
import { LAYER_IDS } from "./constants";
import { FormatOptions, format, formatPercent } from "./formatter";

interface LabelRow {
    key: string;
    text: string;
    cls: string;
    x: number;
    y: number;
}

export interface LabelToggle {
    readonly category: boolean;
    readonly value: boolean;
    readonly percent: boolean;
    readonly runningTotal: boolean;
}

type D3Sel<G extends d3Selection.BaseType>
    = d3Selection.Selection<G, LabelRow, d3Selection.BaseType, unknown>;

/**
 * Render optional labels above each bar. The `toggles` argument is the
 * labeled subset from the Format pane.
 */
export function drawLabels(
    root: d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown>,
    points: ReadonlyArray<ParetoPoint>,
    state: AxisState,
    settings: Settings,
    toggles: LabelToggle,
    offset: { x: number; y: number },
    animation: AnimationConfig
): void {
    if (!toggles.category && !toggles.value && !toggles.percent && !toggles.runningTotal) {
        root.select(`#${LAYER_IDS.LABELS}`).remove();
        return;
    }

    let g = root.select<SVGGElement>(`#${LAYER_IDS.LABELS}`);
    if (g.empty()) {
        g = root.append("g").attr("id", LAYER_IDS.LABELS);
    }
    g.attr("transform", `translate(${offset.x},${offset.y})`)
        .attr("pointer-events", "none");

    const fmtOpts: FormatOptions = {
        displayUnits: settings.axes.displayUnits,
        thousandsSeparator: settings.axes.thousandsSeparator,
        decimalPlaces: settings.axes.decimalPlaces
    };

    const rowHeight = 11;
    const flat: LabelRow[] = [];
    for (const p of points) {
        const cx = (state.x(p.category) || 0) + state.x.bandwidth() / 2;
        const baseY = state.yLeft(p.value) - 4;
        const rows: Array<{ text: string; cls: string }> = [];
        if (toggles.value) rows.push({ text: format(p.value, fmtOpts), cls: "ppe-label" });
        if (toggles.percent) rows.push({ text: formatPercent(p.percent, fmtOpts), cls: "ppe-label ppe-label--percent" });
        if (toggles.category) rows.push({ text: truncate(p.category, 12), cls: "ppe-label" });
        if (toggles.runningTotal) rows.push({ text: format(p.runningTotal, fmtOpts), cls: "ppe-label" });
        rows.forEach((r, i) => {
            flat.push({
                key: `${p.key}-${i}`,
                text: r.text,
                cls: r.cls,
                x: cx,
                y: baseY - i * rowHeight
            });
        });
    }

    const sel = g.selectAll<SVGTextElement, LabelRow>("text.ppe-label")
        .data(flat, d => d.key);

    sel.exit()
        .transition()
        .duration(animation.degraded ? 0 : 200)
        .attr("opacity", 0)
        .remove();

    const enter = sel.enter()
        .append("text")
        .attr("class", d => d.cls)
        .attr("text-anchor", "middle")
        .attr("opacity", 0)
        .text(d => d.text);

    const merged = enter.merge(sel as D3Sel<SVGTextElement>);

    merged.transition()
        .duration(animation.degraded ? 0 : animation.duration)
        .attr("opacity", 1)
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .text(d => d.text)
        .attr("class", d => d.cls);

    void animation;
}

function truncate(s: string, max: number): string {
    return s.length > max ? `${s.slice(0, max - 1)}...` : s;
}
