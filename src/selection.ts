/**
 * Pareto Pro Enterprise — Selection Manager Wrapper
 * ------------------------------------------------
 * Bridges the renderer's bar/marker pointer events to Power BI's
 * {@link ISelectionManager}, providing single + multi-select semantics
 * and re-stamping `isSelected` on the ViewModel after each action so
 * the next render reads the updated state.
 *
 * This module also implements the {@link SelectionWiring} interface
 * exported by renderer.ts — visual.ts instantiates a {@link SelectionController}
 * once on init and hands it to the renderer via setWiring().
 *
 * Responsibilities:
 *   - Single-click → select a single bar (replaces prior selection).
 *   - Ctrl/Cmd-click → multi-select (toggles a bar into the selection set).
 *   - Click on empty chart area → clear the selection.
 *   - SelectionManager interactions are bookmark-safe out of the box.
 *
 * @module    selection
 * @version   1.0.0
 */

import powerbiVisualsApi from "powerbi-visuals-api";
import ISelectionId = powerbiVisualsApi.visuals.ISelectionId;
import ISelectionManager = powerbiVisualsApi.extensibility.ISelectionManager;
import ITooltipService = powerbiVisualsApi.extensibility.ITooltipService;

import { ParetoPoint, Totals, Settings } from "./interfaces";
import { SelectionWiring } from "./renderer";
import { showTooltip, hideTooltip } from "./tooltip";

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Owns the cross-filter + tooltip interactions for one visual instance.
 * Constructed once in visual.ts and passed to the Renderer via setWiring().
 */
export class SelectionController implements SelectionWiring {
    private readonly selectionManager: ISelectionManager;
    private readonly tooltipService: ITooltipService;
    /** Cached for the tooltip show path — refreshed every render cycle. */
    private totals: Totals | null = null;
    private settings: Settings | null = null;

    constructor(
        selectionManager: ISelectionManager,
        tooltipService: ITooltipService
    ) {
        this.selectionManager = selectionManager;
        this.tooltipService = tooltipService;
    }

    /** Refresh the cached totals + settings used by tooltip rows. */
    public bind(totals: Totals, settings: Settings): void {
        this.totals = totals;
        this.settings = settings;
    }

    /** Single or multi bar click → select / toggle through the SelectionManager. */
    public onBarClick(point: ParetoPoint, multi: boolean): void {
        const id = point.identity;
        if (!id) return;
        try {
            if (multi) {
                if (this.isAlreadySelected(id)) {
                    this.selectionManager.remove(id);
                } else {
                    this.selectionManager.select(id, true);
                }
            } else {
                this.selectionManager.select(id, false);
            }
        } catch {
            // Selection errors degrade to no-op; the visual stays interactive.
        }
    }

    /** Bar hover → show the tooltip. */
    public onBarHover(
        point: ParetoPoint,
        coords: { x: number; y: number },
        identity: ISelectionId
    ): void {
        if (!this.totals || !this.settings) return;
        try {
            showTooltip(
                this.tooltipService,
                point,
                this.totals,
                this.settings,
                coords,
                identity
            );
        } catch {
            // Tooltip failures never block the visual.
        }
    }

    /** Bar pointer-out → hide the tooltip. */
    public onBarLeave(): void {
        try {
            hideTooltip(this.tooltipService);
        } catch {
            // No-op.
        }
    }

    /**
     * Target line click — currently surfaces the user's target value to a
     * callback the visual can wire (e.g. emit through telemetry). Power BI
     * cross-filter on a percentage threshold is implemented by selecting the
     * set of categories whose cumulative% <= target; selection.ts exposes a
     * helper for this so visual.ts can opt-in.
     */
    public onTargetClick(value: number): void {
        void value;
        // No default action — visual.ts may register an enhanced behavior.
    }

    /** Programmatically select all points whose cumulative% is <= target. */
    public selectPointsUpTo(targetPercent: number, points: ReadonlyArray<ParetoPoint>): void {
        const ids: ISelectionId[] = [];
        for (const p of points) {
            if (p.cumulativePercent <= targetPercent && p.identity) {
                ids.push(p.identity);
            }
        }
        if (ids.length === 0) {
            this.clearSelection();
            return;
        }
        try {
            this.selectionManager.select(ids, false);
        } catch {
            // No-op; selection must not throw.
        }
    }

    /** Clear all current selections (called on background click). */
    public clearSelection(): void {
        try {
            this.selectionManager.clear();
        } catch {
            // No-op.
        }
    }

    /** True when the supplied identity is already in the active selection set. */
    public isAlreadySelected(id: ISelectionId): boolean {
        try {
            const current = this.selectionManager.getSelectionIds() as ISelectionId[];
            for (const c of current) {
                if (c && c.equals(id)) {
                    return true;
                }
            }
        } catch {
            return false;
        }
        return false;
    }

    /**
     * Re-stamp `isSelected` onto points based on the active selection set.
     * Used by the visual root after every update() so the renderer can dim
     * unselected bars during cross-filtering.
     */
    public applySelectionFlags(points: ParetoPoint[]): ParetoPoint[] {
        let activeIds: ISelectionId[];
        try {
            activeIds = this.selectionManager.getSelectionIds() as ISelectionId[];
        } catch {
            return points;
        }
        if (!activeIds || activeIds.length === 0) {
            // No selection — every point revert to !isSelected.
            if (points.some(p => p.isSelected)) {
                return points.map(p => ({ ...p, isSelected: false }));
            }
            return points;
        }
        return points.map(p => ({
            ...p,
            isSelected: !!p.identity && activeIds.some(a => a && a.equals(p.identity))
        }));
    }
}

/** Convenience factory used by visual.ts. */
export function createSelectionController(
    selectionManager: ISelectionManager,
    tooltipService: ITooltipService
): SelectionController {
    return new SelectionController(selectionManager, tooltipService);
}
