/**
 * Pareto Pro Enterprise — Pareto Line Renderer
 * -------------------------------------------
 * Draws the cumulative-percentage line on the secondary (right) axis,
 * with optional smoothing (straight / smooth / bezier) and animated
 * markers (circle / diamond / square). Pure SVG path strings — no
 * canvas, no React.
 *
 * @module    line
 * @version   1.0.0
 */

import * as d3Selection from "d3-selection";

import { ParetoPoint, Settings, LineType, MarkerShape } from "./interfaces";
import { AxisState } from "./axis";
import { AnimationConfig, animate } from "./animations";
import { LAYER_IDS } from "./constants";
import { catmullRomPath, straightPath } from "./utils";

type D3Sel<G extends d3Selection.BaseType>
    = d3Selection.Selection<G, ParetoPoint, d3Selection.BaseType, unknown>;

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Render (or update) the Pareto line and its markers. Returns the marker
 * selection so {@link selection.ts} can attach tooltip + click handlers.
 */
export function drawLine(
    root: d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown>,
    points: ReadonlyArray<ParetoPoint>,
    state: AxisState,
    settings: Settings,
    offset: { x: number; y: number },
    animation: AnimationConfig
): D3Sel<SVGGElement> {
    if (!settings.paretoLine.show || points.length === 0) {
        root.select(`#${LAYER_IDS.PARETO_LINE}`).remove();
        root.select(`#${LAYER_IDS.MARKERS}`).remove();
        return root.selectAll<SVGGElement, ParetoPoint>(".ppe-marker");
    }

    const pathPts = linePoints(points, state);
    const dString = buildPath(pathPts, settings.paretoLine.lineType);

    // The <g> holding the path.
    let g = root.select<SVGGElement>(`#${LAYER_IDS.PARETO_LINE}`);
    if (g.empty()) {
        g = root.append("g").attr("id", LAYER_IDS.PARETO_LINE);
    }
    g.attr("transform", `translate(${offset.x},${offset.y})`);

    let path = g.select<SVGPathElement>(".ppe-pareto-line");
    if (path.empty()) {
        path = g.append("path").attr("class", "ppe-pareto-line")
            .attr("fill", "none")
            .attr("stroke", settings.paretoLine.color)
            .attr("stroke-width", settings.paretoLine.width)
            .attr("stroke-linecap", "round")
            .attr("stroke-linejoin", "round");
    }

    path.interrupt();
    path = path.transition()
        .duration(animation.degraded ? 0 : animation.duration)
        .ease(t => t)
        .attr("d", dString)
        .attr("stroke", settings.paretoLine.color)
        .attr("stroke-width", settings.paretoLine.width)
        .selection() as SVGPathSelection;

    // Markers group.
    if (settings.paretoLine.showMarkers) {
        return drawMarkers(root, points, state, settings, offset, animation);
    }
    root.select(`#${LAYER_IDS.MARKERS}`).remove();
    return root.selectAll<SVGGElement, ParetoPoint>(".ppe-marker");
}

type SVGPathSelection = d3Selection.Selection<SVGPathElement, unknown, d3Selection.BaseType, unknown>;

/* ============================================================
   INTERNAL — markers
   ============================================================ */

function drawMarkers(
    root: d3Selection.Selection<SVGGElement, unknown, d3Selection.BaseType, unknown>,
    points: ReadonlyArray<ParetoPoint>,
    state: AxisState,
    settings: Settings,
    offset: { x: number; y: number },
    animation: AnimationConfig
): D3Sel<SVGGElement> {
    let g = root.select<SVGGElement>(`#${LAYER_IDS.MARKERS}`);
    if (g.empty()) {
        g = root.append("g").attr("id", LAYER_IDS.MARKERS);
    }
    g.attr("transform", `translate(${offset.x},${offset.y})`);

    const sel = g.selectAll<SVGElement, ParetoPoint>(".ppe-marker")
        .data(points, d => d.key);

    sel.exit()
        .transition()
        .duration(animation.degraded ? 0 : 200)
        .attr("opacity", 0)
        .remove();

    const enter = sel.enter()
        .append(markerElementName(settings.paretoLine.markerShape))
        .attr("class", "ppe-marker")
        .attr("opacity", 0)
        .style("cursor", "pointer");

    const merged = enter.merge(sel as D3Sel<SVGElement>);

    // Apply shape-specific geometry every render.
    applyMarkerGeometry(
        merged as D3Sel<SVGElement>,
        points,
        state,
        settings
    );

    const t = animate(merged as D3Sel<SVGElement>, animation);
    t.attr("opacity", d => (d.isHighlight && !d.isSelected) ? 0.35 : 1);

    return merged as D3Sel<SVGGElement>;
}

function markerElementName(shape: MarkerShape): keyof SVGElementTagNameMap {
    switch (shape) {
        case MarkerShape.Square: return "rect";
        case MarkerShape.Diamond: return "rect";
        case MarkerShape.Circle:
        default: return "circle";
    }
}

function applyMarkerGeometry(
    sel: D3Sel<SVGElement>,
    points: ReadonlyArray<ParetoPoint>,
    state: AxisState,
    settings: Settings
): void {
    const size = settings.paretoLine.markerSize;
    const color = settings.paretoLine.markerColor;
    const shape = settings.paretoLine.markerShape;

    sel.each(function (this: SVGElement, d: ParetoPoint) {
        const cx = (state.x(d.category) || 0) + state.x.bandwidth() / 2;
        const cy = state.yRight(d.cumulativePercent);
        const el = d3Selection.select(this);
        switch (shape) {
            case MarkerShape.Circle:
                el.attr("cx", cx).attr("cy", cy).attr("r", size / 2);
                break;
            case MarkerShape.Square:
            case MarkerShape.Diamond:
                el.attr("x", cx - size / 2)
                    .attr("y", cy - size / 2)
                    .attr("width", size)
                    .attr("height", size);
                if (shape === MarkerShape.Diamond) {
                    el.attr("transform", `rotate(45 ${cx} ${cy})`);
                } else {
                    el.attr("transform", null);
                }
                break;
            default:
        }
        // Pointers + color shared between shapes.
        if (this.tagName === "circle") {
            // already cx/cy/r — no transform needed
        }
        void points;
    })
        .attr("fill", color)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1);
}

/* ============================================================
   INTERNAL — path construction
   ============================================================ */

function linePoints(points: ReadonlyArray<ParetoPoint>, state: AxisState): Array<[number, number]> {
    const out: Array<[number, number]> = new Array(points.length);
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const cx = (state.x(p.category) || 0) + state.x.bandwidth() / 2;
        const cy = state.yRight(p.cumulativePercent);
        out[i] = [cx, cy];
    }
    return out;
}

function buildPath(pts: Array<[number, number]>, type: LineType): string {
    switch (type) {
        case LineType.Straight:
            return straightPath(pts);
        case LineType.Smooth:
            return catmullRomPath(pts, 0.5);
        case LineType.Bezier:
            return catmullRomPath(pts, 0.8);
        default:
            return straightPath(pts);
    }
}
