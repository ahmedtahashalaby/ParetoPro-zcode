/**
 * Pareto Pro Enterprise — Interactive Target Line
 * ----------------------------------------------
 * Renders the user-configured target line (a single reference value on
 * the cumulative-% secondary axis), with its label and dash style.
 *
 * "Interactive" means:
 *   - The line is clickable to toggle a quick cross-filter mode (driven by
 *     selection.ts), keeping logic with the line that draws it.
 *   - The renderer exposes the line geometry so the tooltip service can
 *     show "80% target" on hover.
 *
 * @module    targetLine
 * @version   1.0.0
 */

import * as d3Selection from "d3-selection";

import { Settings } from "./interfaces";
import { AxisState } from "./axis";
import { LAYER_IDS } from "./constants";
import { dashArray } from "./utils";
import { DashStyle } from "./interfaces";

type D3SelectionLike<G extends d3Selection.BaseType>
    = d3Selection.Selection<G, unknown, d3Selection.BaseType, unknown>;

/* ============================================================
   PUBLIC API
   ============================================================ */

export interface TargetLineRender {
    /** x of the line — full plot width. */
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
    readonly labelX: number;
    readonly labelY: number;
    readonly label: string;
    readonly color: string;
    readonly dash: string;
    readonly width: number;
}

/**
 * Build the geometry of the target line. Pure (no DOM writes).
 * @returns `null` when the target line is disabled.
 */
export function buildTargetLine(
    state: AxisState,
    settings: Settings
): TargetLineRender | null {
    const t = settings.targetLine;
    if (!t.show) return null;
    const yPct = clampPercent(t.value);
    const y = state.yRight(yPct);
    return {
        x1: 0,
        y1: y,
        x2: state.plot.width,
        y2: y,
        labelX: state.plot.width - 4,
        labelY: y - 4,
        label: t.label || `${yPct}% Target`,
        color: t.color,
        dash: dashArray(t.dashArray as DashStyle),
        width: 2
    };
}

/**
 * Render the target line + label. The line is clickable via the supplied
 * `onClick` callback so selection.ts can wire up cross-filter behavior.
 */
export function drawTargetLine(
    root: D3SelectionLike<SVGGElement>,
    state: AxisState,
    settings: Settings,
    offset: { x: number; y: number },
    onClick: () => void
): void {
    const g = ensureGroup(root, LAYER_IDS.TARGET_LINE);
    g.attr("transform", `translate(${offset.x},${offset.y})`);
    const spec = buildTargetLine(state, settings);
    if (!spec) {
        g.remove();
        return;
    }

    const line = ensureLine(g, "ppe-target-line__line");
    line
        .attr("x1", spec.x1)
        .attr("y1", spec.y1)
        .attr("x2", spec.x2)
        .attr("y2", spec.y2)
        .attr("stroke", spec.color)
        .attr("stroke-width", spec.width)
        .attr("stroke-dasharray", spec.dash)
        .attr("class", "ppe-target-line")
        .attr("pointer-events", "stroke")
        .style("cursor", "pointer")
        .on("click", onClick);

    const label = ensureText(g, "ppe-target-line__label");
    label
        .attr("x", spec.labelX)
        .attr("y", spec.labelY)
        .attr("text-anchor", "end")
        .attr("class", "ppe-target-label")
        .attr("fill", spec.color)
        .text(spec.label);
}

/* ============================================================
   INTERNAL — element helpers
   ============================================================ */

function clampPercent(p: number): number {
    if (!Number.isFinite(p)) return 80;
    return Math.max(0, Math.min(100, p));
}

function ensureGroup(
    root: D3SelectionLike<SVGGElement>,
    id: string
): D3SelectionLike<SVGGElement> {
    let g = root.select<SVGGElement>(`#${id}`);
    if (g.empty()) {
        g = root.append("g").attr("id", id);
    }
    return g;
}

function ensureLine(
    g: D3SelectionLike<SVGGElement>,
    cls: string
): D3SelectionLike<SVGLineElement> {
    let sel = g.select<SVGLineElement>(".ppe-target-line__line");
    if (sel.empty()) {
        sel = g.append("line").attr("class", cls);
    }
    return sel;
}

function ensureText(
    g: D3SelectionLike<SVGGElement>,
    id: string
): D3SelectionLike<SVGTextElement> {
    let sel = g.select<SVGTextElement>(`#${id}`);
    if (sel.empty()) {
        sel = g.append("text").attr("id", id);
    }
    return sel;
}
