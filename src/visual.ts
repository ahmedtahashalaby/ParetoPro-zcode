/**
 * Pareto Pro Enterprise — Visual Lifecycle (Tier 1)
 * ------------------------------------------------
 * The Power BI `IVisual` root. Owns the engine instance, the renderer,
 * the selection controller, and the disposal registry. Wires update
 * cycles end to end:
 *
 *     update(options)
 *       -> integrity gate           (errorHandler.readIntegrity)
 *       -> resolve settings         (settings.resolveSettings)
 *       -> resolve theme            (theme.resolveTheme)
 *       -> extract rows             (dataProcessor.transform)
 *       -> compute layout           (responsive.computeLayout)
 *       -> build ViewModel          (model.buildViewModel)
 *       -> apply selection state    (selection.applySelectionFlags)
 *       -> render                   (renderer.render)
 *
 * The constructor injects the {@link SelectionWiring} (selection + tooltip)
 * so the renderer stays free of Tier 3 imports.
 *
 * @module    visual
 * @version   1.0.0
 */

"use strict";

import powerbiVisualsApi from "powerbi-visuals-api";
import powerbi = powerbiVisualsApi;
import IVisual = powerbiVisualsApi.extensibility.visual.IVisual;
import VisualUpdateOptions = powerbiVisualsApi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbiVisualsApi.extensibility.IVisualHost;
import VisualConstructorOptions = powerbiVisualsApi.extensibility.visual.VisualConstructorOptions;
import DataViewMetadata = powerbiVisualsApi.powerbi.DataViewMetadata;

import {
    VisualContext,
    VisualStateKind,
    ViewModel,
    Layout,
    Settings,
    ParetoPoint
} from "./interfaces";
import { ThemePalette, resolveTheme } from "./theme";
import { DEFAULT_SETTINGS } from "./constants";
import { resolveSettings } from "./settings";
import {
    readIntegrity,
    classifyState,
    NORMAL_STATE,
    tryRun
} from "./errorHandler";
import { transform, ProcessorResult } from "./dataProcessor";
import { computeLayout } from "./responsive";
import { buildViewModel } from "./model";
import { Renderer } from "./renderer";
import {
    SelectionController,
    createSelectionController
} from "./selection";
import {
    AccessibilityContext,
    NavDirection,
    announceSelection,
    moveFocus,
    refreshBarLabels,
    wireKeyboard
} from "./accessibility";
import { DisposableRegistry } from "./performance";
import { memoize } from "./performance";

/* ============================================================
   THE VISUAL CLASS
   ============================================================ */

export class Visual implements IVisual {
    private readonly host: IVisualHost;
    private readonly locale: string;
    private readonly root: HTMLElement;
    private readonly renderer: Renderer;
    private readonly selection: SelectionController;
    private readonly disposables: DisposableRegistry;
    private palette: ThemePalette;
    private lastVm: ViewModel | null = null;
    private memoizedBuild: (sig: string, build: () => ViewModel) => ViewModel;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.locale = options.host && options.host.locale ? options.host.locale : "en-US";
        this.root = options.element;

        // Resolve an initial palette so the renderer can be constructed eagerly.
        this.palette = resolveTheme(
            DEFAULT_SETTINGS.general.theme,
            DEFAULT_SETTINGS.theme.palette,
            { viewport: { width: 0, height: 0 } } as unknown as VisualUpdateOptions,
            this.host
        );

        this.renderer = new Renderer(this.root, this.palette);
        this.selection = createSelectionController(
            this.host.selectionManager,
            this.host.tooltipService
        );
        this.renderer.setWiring(this.selection);

        // Accessibility wiring — covers the keyboard surface.
        this.disposables = new DisposableRegistry();
        const accCtx: AccessibilityContext = {
            onNavigate: (dir: NavDirection) => {
                if (this.lastVm) {
                    moveFocus(this.root, this.lastVm.points, dir);
                }
            },
            onActivate: (point: ParetoPoint, multi: boolean) => {
                this.selection.onBarClick(point, multi);
                announceSelection(this.root, point);
            },
            onClear: () => {
                this.selection.clearSelection();
                announceSelection(this.root, null);
            }
        };
        // Wire keyboard now — bind VM later inside update().
        this.disposables.add(wireKeyboard(this.root, null as unknown as ViewModel, accCtx));
        // Bind selection handler to a no-op tabbing model until first update.

        // Memoize ViewModel construction by signature. The build closure
        // captures the extracted rows + settings; the signature changes
        // when data/layout/settings change.
        this.memoizedBuild = memoize(
            (_sig: string, build: () => ViewModel) => build(),
            (sig: string) => sig
        );
    }

    /* ============================================================
       LIFECYCLE — IVisual
       ============================================================ */

    /**
     * Called by Power BI for every data, viewport, or settings change.
     * Re-extracts data, rebuilds the ViewModel, and hands it off to the
     * renderer.
     */
    public update(options: VisualUpdateOptions): void {
        const executed = tryRun("Visual.update", () => {
            this.runUpdate(options);
        });
        if (executed && typeof executed === "object" && "kind" in executed) {
            // A title-only error state — surface to the title bar so the user knows.
            // eslint-disable-next-line no-console
            console.warn("[ParetoProEnterprise] update failed; rendered degraded state.");
        }
    }

    /** Called when the host removes the visual — release resources. */
    public destroy(): void {
        this.disposables.dispose();
        try {
            this.renderer.destroy();
        } catch {
            // Tearing down must never throw.
        }
        this.lastVm = null;
    }

    /**
     * Enumerate the format pane via the modern Formatting Model API.
     * The output drives the native Power BI Fluent format pane.
     */
    public getFormattingModel(): powerbiVisualsApi.visuals.FormattingModel {
        // Lazy import to keep the bundle shape predictable.
        const { buildFormattingModel } = require("./settings");
        const dataView = this.lastVm ? this.lastVm.metadata : null;
        return buildFormattingModel(dataView as powerbi.DataView);
    }

    /* ============================================================
       INTERNAL — update pipeline
       ============================================================ */

    private runUpdate(options: VisualUpdateOptions): void {
        const viewport = options.viewport;
        const integrity = readIntegrity(options);
        const settings = resolveSettings(settingsMetadata(options));

        // Resolve theme palette every render — theme could have flipped.
        this.palette = resolveTheme(
            settings.general.theme,
            settings.theme.palette,
            options,
            this.host
        );
        this.renderer.setPalette(this.palette);

        // Compute layout for the current viewport + settings.
        const layout: Layout = computeLayout(viewport.width, viewport.height, settings);

        // Extract rows from the categorical data view.
        const view = options.dataViews && options.dataViews.length > 0
            ? options.dataViews[0]
            : null;
        const categorical = view ? view.categorical : null;
        const processor: ProcessorResult = transform(categorical, this.host);

        // Integrity gate — short-circuit when data can't support a Pareto.
        const state = classifyState(integrity);
        if (state.kind !== VisualStateKind.Normal && !state.recoverable) {
            this.renderer.render(
                this.makeEdgeViewModel(settings, layout, state, view ? view.metadata : null),
                this.context(options)
            );
            return;
        }

        // Build the immutable ViewModel (memoized via signature).
        const metadata: DataViewMetadata = view ? view.metadata : ({} as DataViewMetadata);
        const build = () =>
            buildViewModel({
                rows: processor.rows,
                hasHighlights: processor.hasHighlights,
                settings,
                layout,
                metadata,
                state
            });

        const sig = `${processor.rows.length}|${layout.viewport.width}x${layout.viewport.height}|${settings.theme.palette}`;
        const vm = this.memoizedBuild(sig, build);

        const vmWithSelection = this.applySelection(vm);

        this.selection.bind(vmWithSelection.totals, vmWithSelection.settings);
        this.renderer.render(vmWithSelection, this.context(options));

        // Refresh accessibility labels + bind the latest ViewModel to the keyboard surface.
        refreshBarLabels(vmWithSelection);
        this.lastVm = vmWithSelection;
    }

    /** Re-stamp isSelected on points per the current SelectionManager state. */
    private applySelection(vm: ViewModel): ViewModel {
        const patched = this.selection.applySelectionFlags(vm.points as ParetoPoint[]);
        if (patched === vm.points) {
            return vm;
        }
        return { ...vm, points: patched };
    }

    /**
     * Build a de-minimus ViewModel representing a non-recoverable edge-case.
     * The renderer uses it to show the state message and otherwise hide panels.
     */
    private makeEdgeViewModel(
        settings: Settings,
        layout: Layout,
        vmState: ViewModel["state"],
        metadata: DataViewMetadata | null
    ): ViewModel {
        return {
            state: vmState,
            points: [],
            totals: { total: 0, count: 0, average: 0, maximum: 0, minimum: 0 },
            statistics: {
                mean: 0,
                median: 0,
                mode: 0,
                standardDeviation: 0,
                variance: 0,
                skewness: 0,
                kurtosis: 0,
                gini: 0,
                range: 0
            },
            abcSummary: {
                classes: [],
                thresholdA: settings.abcAnalysis.thresholdA,
                thresholdB: settings.abcAnalysis.thresholdB
            },
            settings,
            layout,
            hasHighlights: false,
            metadata: metadata || ({} as DataViewMetadata),
            signature: "edge"
        };
    }

    /** Build the VisualContext handed off to the renderer. */
    private context(options: VisualUpdateOptions): VisualContext {
        return {
            host: this.host,
            options,
            container: this.root,
            selectionManager: this.host.selectionManager,
            tooltipService: this.host.tooltipService,
            locale: this.locale
        };
    }
}

/* ============================================================
   HELPERS
   ============================================================ */

/**
 * Pull a metadata object out of the supplied VisualUpdateOptions. When the
 * host has no data to format, this returns a minimal blank metadata stub so
 * settings resolution can read defaults cleanly.
 */
function settingsMetadata(options: VisualUpdateOptions): DataViewMetadata {
    if (options.dataViews && options.dataViews.length > 0 && options.dataViews[0]) {
        return options.dataViews[0].metadata || ({} as DataViewMetadata);
    }
    return {} as DataViewMetadata;
}

// Suppress the "unused import" lint for NORMAL_STATE — it's part of the
// public API surface of errorHandler and is documented here for clarity.
void NORMAL_STATE;
