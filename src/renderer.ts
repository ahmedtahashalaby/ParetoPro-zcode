/**
 * Pareto Pro Enterprise — Render Orchestrator (Tier 4 root)
 * ---------------------------------------------------------
 * The single entry point the visual lifecycle uses to paint a fully-resolved
 * {@link ViewModel}. Orchestrates the per-element sub-renderers in z-index-
 * correct order and wires tooltip + selection event handlers.
 *
 * Ownership rules:
 *   - This module is *the only* place that interprets the Layout's panel
 *     positions. Sub-renderers receive a precomputed offset + (when needed)
 *     the SVG chart root.
 *   - Selection handlers are attached here (delegated to selection.ts) so
 *     the renderer is the one place that owns the per-bar pointer surface.
 *
 * @module    renderer
 * @version   1.0.0
 */

import * as d3Selection from "d3-selection";

import powerbiVisualsApi from "powerbi-visuals-api";
import ISelectionId = powerbiVisualsApi.visuals.ISelectionId;

import {
    VisualContext,
    VisualStateKind,
    ViewModel,
    ParetoPoint
} from "./interfaces";
import { ThemePalette, themeModeClass } from "./theme";
import { LAYER_IDS } from "./constants";
import { buildAxisState, drawAxes, AxisState } from "./axis";
import { drawBars } from "./bars";
import { drawLine } from "./line";
import { drawLabels } from "./labels";
import { drawTargetLine } from "./targetLine";
import { drawReferenceLines } from "./referenceLines";
import { drawLegend, hideLegend } from "./legend";
import { drawCards, hideCards } from "./cards";
import { drawTable, hideTable } from "./table";
import { config as animConfig, AnimationConfig } from "./animations";
import { FrameBudget } from "./performance";

type D3Sel<G extends d3Selection.BaseType>
    = d3Selection.Selection<G, unknown, d3Selection.BaseType, unknown>;

/* ============================================================
   SELECTION WIRING — injected by visual.ts to keep Tier 4 free
   of Tier 3 imports. The bars selection is handed back via callbacks.
   ============================================================ */

export interface SelectionWiring {
    /** Called for each bar with its point + multi-select flag. */
    onBarClick(point: ParetoPoint, multi: boolean): void;
    /** Triggered on pointer-over to show the tooltip. */
    onBarHover(point: ParetoPoint, coords: { x: number; y: number }, identity: ISelectionId): void;
    /** Triggered on pointer-out to hide the tooltip. */
    onBarLeave(): void;
    /** Called when the target line is clicked (toggle cross-filter to that %). */
    onTargetClick(value: number): void;
}

/* ============================================================
   PUBLIC API
   ============================================================

   The renderer is a class so its state (axis geometry, signature,
   frame budget tracker, palette reference, and selection wiring)
   persists across update() calls without leaking module-level state.

 * ------------------------------------------------------------
 */

export class Renderer {
    private readonly container: HTMLElement;
    private readonly cardsLayer: HTMLElement;
    private readonly chartLayer: HTMLElement;
    private readonly legendLayer: HTMLElement;
    private readonly tableLayer: HTMLElement;
    private readonly svg: D3Sel<SVGSVGElement>;
    private readonly chartRoot: D3Sel<SVGGElement>;
    private readonly budget: FrameBudget;
    private axisState: AxisState | null = null;
    private signature: string | null = null;
    /** Theme palette resolved by visual.ts and injected each render cycle. */
    private paletteRef: ThemePalette;
    /** Interaction wiring injected by visual.ts (selection + tooltip). */
    private wiring: SelectionWiring | null = null;

    constructor(container: HTMLElement, palette: ThemePalette) {
        this.container = container;
        this.paletteRef = palette;
        // Build the panel skeleton exactly once.
        const root = document.createElement("div");
        root.className = "ppe-root";
        root.setAttribute("id", LAYER_IDS.ROOT);
        root.setAttribute("role", "region");
        root.setAttribute("aria-label", "Pareto Pro Enterprise visual");
        container.appendChild(root);

        const titleLayer = document.createElement("div");
        titleLayer.id = "ppe-title-layer";

        this.cardsLayer = document.createElement("div");
        this.cardsLayer.id = LAYER_IDS.CARDS_LAYER;
        this.cardsLayer.className = "ppe-cards-layer";

        this.chartLayer = document.createElement("div");
        this.chartLayer.id = LAYER_IDS.CHART_LAYER;
        this.chartLayer.className = "ppe-chart-layer";

        this.legendLayer = document.createElement("div");
        this.legendLayer.id = LAYER_IDS.LEGEND;
        this.legendLayer.className = "ppe-legend-layer";

        this.tableLayer = document.createElement("div");
        this.tableLayer.id = LAYER_IDS.TABLE_LAYER;
        this.tableLayer.className = "ppe-table-layer";

        root.appendChild(titleLayer);
        root.appendChild(this.cardsLayer);
        root.appendChild(this.chartLayer);
        root.appendChild(this.legendLayer);
        root.appendChild(this.tableLayer);

        // Build the chart SVG once.
        this.svg = d3Selection.select(this.chartLayer)
            .append<SVGSVGElement>("svg")
            .attr("id", LAYER_IDS.SVG)
            .attr("class", "ppe-chart")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("preserveAspectRatio", "xMidYMid meet")
            .attr("role", "img")
            .attr("aria-hidden", "false") as unknown as D3Sel<SVGSVGElement>;

        this.chartRoot = this.svg.append<SVGGElement>("g")
            .attr("id", "ppe-chart-root") as unknown as D3Sel<SVGGElement>;

        this.budget = new FrameBudget();
    }

    /**
     * Paint the supplied ViewModel. The renderer skips work when the new
     * signature equals the previous one (e.g. on a repeat update from a
     * bookmark round-trip).
     */
    public render(vm: ViewModel, ctx: VisualContext): void {
        // Edge cases — render a status message and stop.
        if (vm.state.kind !== VisualStateKind.Normal && !vm.state.recoverable) {
            this.renderEdgeCase(vm);
            this.signature = null;
            return;
        }

        const t0 = typeof performance !== "undefined" ? performance.now() : 0;

        this.applyTheme(vm);
        this.ensureDefs();
        this.databindTitle(vm);

        // 1. Recompute axis geometry.
        this.axisState = buildAxisState(vm.points, vm.layout, vm.settings);

        const animation: AnimationConfig = animConfig(
            vm.settings.animation.type,
            vm.settings.animation.duration,
            vm.settings.animation.delay,
            vm.settings.animation.enabled,
            this.budget
        );

        const offset = { x: vm.layout.marginLeft, y: vm.layout.marginTop };

        // 2. Draw everything in z-order (back to front).
        drawAxes(this.chartRoot, this.axisState, vm.settings, this.palette(vm), offset);

        drawReferenceLines(this.chartRoot, this.axisState, vm.settings, offset);

        drawTargetLine(
            this.chartRoot,
            this.axisState,
            vm.settings,
            offset,
            () => this.wiring?.onTargetClick(vm.settings.targetLine.value)
        );

        const bars = drawBars(
            this.chartRoot,
            vm.points,
            this.axisState,
            vm.settings,
            this.palette(vm),
            offset,
            animation
        );

        drawLine(this.chartRoot, vm.points, this.axisState, vm.settings, offset, animation);

        drawLabels(
            this.chartRoot,
            vm.points,
            this.axisState,
            vm.settings,
            { category: false, value: true, percent: false, runningTotal: false },
            offset,
            animation
        );

        drawCards(this.cardsLayer, vm);

        if (vm.settings.legend.show && vm.layout.legendEnabled) {
            drawLegend(this.legendLayer, vm.abcSummary, vm.settings, this.palette(vm));
        } else {
            hideLegend(this.legendLayer);
        }

        if (vm.settings.table.show && vm.layout.tableEnabled) {
            drawTable(this.tableLayer, vm);
        } else {
            hideTable(this.tableLayer);
        }

        // 3. Wire interaction — selection + tooltip via the injected wiring.
        //    The visual root (constructor injects `wiring`) implements these
        //    callbacks to keep selection/tooltip concerns out of Tier 4.
        const wiring = this.wiring;
        if (wiring) {
            bars
                .on("click", function (this: SVGRectElement, event: MouseEvent, d: ParetoPoint) {
                    const multi = event.ctrlKey || event.metaKey;
                    wiring.onBarClick(d, multi);
                })
                .on("pointerover", function (this: SVGRectElement, event: PointerEvent, d: ParetoPoint) {
                    wiring.onBarHover(d, { x: event.clientX, y: event.clientY }, d.identity);
                })
                .on("pointerout", function () {
                    wiring.onBarLeave();
                });
        }

        // 4. Record frame budget & signature.
        const tEnd = typeof performance !== "undefined" ? performance.now() : t0;
        this.budget.record(tEnd - t0);
        this.signature = vm.signature;
        void ctx;
    }

    /** Visual root injects interaction wiring once on init. */
    public setWiring(wiring: SelectionWiring): void {
        this.wiring = wiring;
    }

    /** Visual root injects the resolved theme palette each render cycle. */
    public setPalette(palette: ThemePalette): void {
        this.paletteRef = palette;
    }

    /** Tear down any DOM the renderer created. */
    public destroy(): void {
        try {
            this.svg.remove();
        } catch {
            // noop — already detached during unregister
        }
        while (this.container.firstChild) {
            this.container.removeChild(this.container.firstChild);
        }
        this.axisState = null;
        this.signature = null;
    }

    /* ============================================================
       INTERNAL
       ============================================================ */

    private applyTheme(vm: ViewModel): void {
        const rootEl = this.container.querySelector(`#${LAYER_IDS.ROOT}`) as HTMLElement | null;
        if (rootEl) {
            const cls = themeModeClass(vm.settings.general.theme);
            rootEl.classList.remove("ppe-theme--light", "ppe-theme--dark", "ppe-theme--corporate", "ppe-theme--hc");
            rootEl.classList.add(cls);
            // BREAKPOINT sizing class
            rootEl.classList.remove("ppe-size--phone", "ppe-size--tablet", "ppe-size--desktop");
            rootEl.classList.add(`ppe-size--${vm.layout.breakpoint}`);
        }
    }

    private palette(_vm: ViewModel): ThemePalette {
        void _vm;
        return this.paletteRef;
    }

    private databindTitle(vm: ViewModel): void {
        const titleLayer = this.container.querySelector("#ppe-title-layer") as HTMLElement | null;
        if (!titleLayer) return;
        if (!vm.settings.general.showTitle) {
            titleLayer.style.display = "none";
            titleLayer.innerHTML = "";
            return;
        }
        titleLayer.style.display = "block";
        const text = vm.settings.general.titleText || "Pareto Analysis";
        titleLayer.innerHTML = `<div class="ppe-title">${escapeHtml(text)}</div>`;
    }

    private renderEdgeCase(vm: ViewModel): void {
        // Hide all panels but the root container; show a friendly state card.
        const rootEl = this.container.querySelector(`#${LAYER_IDS.ROOT}`) as HTMLElement | null;
        if (!rootEl) return;
        rootEl.innerHTML = "";
        const state = document.createElement("div");
        state.className = "ppe-state";
        state.setAttribute("role", "status");
        state.innerHTML = `
            <div class="ppe-state__icon">${edgeIcon(vm.state.kind)}</div>
            <div class="ppe-state__title">${escapeHtml(vm.state.title)}</div>
            <div class="ppe-state__message">${escapeHtml(vm.state.message)}</div>
        `;
        rootEl.appendChild(state);
    }

    /** Lazily create the chart <defs> (gradient + drop shadow) once. */
    private ensureDefs(): void {
        const existing = this.chartRoot.select("defs");
        if (!existing.empty()) return;
        const defs = this.chartRoot.append("defs");

        // Gradient (start/end color are re-styled by bars.ts on each render).
        const grad = defs.append("linearGradient")
            .attr("id", "ppe-bar-gradient")
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "0%").attr("y2", "100%");
        grad.append("stop").attr("offset", "0%");
        grad.append("stop").attr("offset", "100%");

        // Soft drop shadow.
        const shadow = defs.append("filter")
            .attr("id", "ppe-bar-shadow")
            .attr("x", "-20%").attr("y", "-20%")
            .attr("width", "140%").attr("height", "140%");
        shadow.append("feDropShadow")
            .attr("dx", "0").attr("dy", "2")
            .attr("stdDeviation", "2")
            .attr("flood-color", "rgba(0,0,0,0.18)");
    }
}

/* ============================================================
   SMALL HELPERS — kept in this file so the import surface stays clean
   ============================================================ */

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, """)
        .replace(/'/g, "&#039;");
}

function edgeIcon(kind: VisualStateKind): string {
    switch (kind) {
        case VisualStateKind.NoData:
        case VisualStateKind.MissingField:
        case VisualStateKind.NullValues:
            return "○";
        case VisualStateKind.Error:
            return "⚠";
        case VisualStateKind.NegativeValues:
            return "−";
        case VisualStateKind.LargeDataset:
            return "⊪";
        default:
            return "•";
    }
}

// Re-export for callers that just want the entry point.
export function createRenderer(container: HTMLElement, palette: ThemePalette): Renderer {
    return new Renderer(container, palette);
}
