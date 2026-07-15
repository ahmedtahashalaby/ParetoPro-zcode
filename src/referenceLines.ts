/**
 * Pareto Pro Enterprise — Reference Lines (unlimited)
 * ---------------------------------------------------
 * Renders an arbitrary number of user-defined reference lines on the
 * secondary (cumulative-%) axis, each with its own color, dash style,
 * label, and width.
 *
 * The classic stock set is 80 / 90 / 95 (already provided by
 * DEFAULT_REFERENCE_VALUES in constants.ts). Users can add unlimited
 * additional lines in the Format pane — they arrive here as a typed
 * ReferenceLine[] array via the resolved settings.
 *
 * @module    referenceLines
 * @version   1.0.0
 */

import * as d3Selection from "d3-selection";

import { ReferenceLine, Settings, DashStyle } from "./interfaces";
import { AxisState } from "./axis";
import { LAYER_IDS } from "./constants";
import { dashArray } from "./utils";

type D3SelectionLike<G extends d3Selection.BaseType, Datum = ReferenceLine>
    = d3Selection.Selection<G, Datum, d3Selection.BaseType, unknown>;

/* ============================================================
   PUBLIC API
   ============================================================ */

/** Render or update the set of reference lines with a keyed join. */
export function drawReferenceLines(
    root: D3SelectionLike<SVGGElement, unknown>,
    state: AxisState,
    settings: Settings,
    offset: { x: number; y: number }
): void {
    const group = ensureGroup(root, LAYER_IDS.REFERENCE_LINES);
    group.attr("transform", `translate(${offset.x},${offset.y})`);

    if (!settings.referenceLines.show) {
        group.remove();
        return;
    }

    const sel = group.selectAll<SVGLineElement, ReferenceLine>(".ppe-reference-line")
        .data(settings.referenceLines.lines, d => d.id);

    sel.exit()
        .transition()
        .duration(180)
        .attr("opacity", 0)
        .remove();

    const enter = sel.enter()
        .append("line")
        .attr("class", "ppe-reference-line")
        .attr("x1", 0)
        .attr("y1", d => state.yRight(clampPct(d.value)))
        .attr("x2", state.plot.width)
        .attr("y2", d => state.yRight(clampPct(d.value)))
        .attr("stroke", d => d.color)
        .attr("stroke-width", d => d.width)
        .attr("stroke-dasharray", d => dashString(d.dashStyle))
        .attr("opacity", 0);

    const merged = enter.merge(sel as D3SelectionLike<SVGLineElement>);

    merged.transition()
        .duration(200)
        .attr("y1", d => state.yRight(clampPct(d.value)))
        .attr("y2", d => state.yRight(clampPct(d.value)))
        .attr("x1", 0)
        .attr("x2", state.plot.width)
        .attr("stroke", d => d.color)
        .attr("stroke-width", d => d.width)
        .attr("stroke-dasharray", d => dashString(d.dashStyle))
        .attr("opacity", 1);

    // Labels — small text at the right edge of each line.
    const labelSel = group.selectAll<SVGTextElement, ReferenceLine>(".ppe-reference-label")
        .data(settings.referenceLines.lines, d => d.id);

    labelSel.exit().remove();

    const labelEnter = labelSel.enter()
        .append("text")
        .attr("class", "ppe-reference-label");

    const labelMerged = labelEnter.merge(labelSel as D3SelectionLike<SVGTextElement>);
    labelMerged
        .attr("x", state.plot.width - 6)
        .attr("y", d => state.yRight(clampPct(d.value)) - 4)
        .attr("text-anchor", "end")
        .attr("fill", d => d.color)
        .text(d => d.label || `${d.value}%`);
}

/* ============================================================
   INTERNAL
   ============================================================ */

function clampPct(v: number): number {
    if (!Number.isFinite(v)) return 80;
    return Math.max(0, Math.min(100, v));
}

function dashString(style: DashStyle): string {
    return dashArray(style);
}

function ensureGroup(
    root: D3SelectionLike<SVGGElement, unknown>,
    id: string
): D3SelectionLike<SVGGElement, unknown> {
    let g = root.select<SVGGElement>(`#${id}`);
    if (g.empty()) {
        g = root.append("g").attr("id", id);
    }
    return g;
}
