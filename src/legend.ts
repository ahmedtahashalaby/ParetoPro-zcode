/**
 * Pareto Pro Enterprise — Legend
 * ------------------------------
 * Renders the ABC-class legend (A/B/C color swatches + labels) and the
 * Pareto line swatch. Uses HTML/CSS (the .ppe-legend-layer in
 * style/visual.less) so the legend lays out responsively via flex — no
 * SVG positioning math needed.
 *
 * @module    legend
 * @version   1.0.0
 */

import { ABCClass, Settings } from "./interfaces";
import { ABCSummary } from "./interfaces";
import { ThemePalette } from "./theme";
import { classnames } from "./utils";

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Render (or hide) the legend bar inside the layout's legend slot.
 *
 * @param legendLayer The HTML element pre-reserved as the legend container.
 * @param summary     ABC summary from the ViewModel — drives swatch labels.
 * @param settings    Resolved settings.
 * @param palette     Active theme palette.
 */
export function drawLegend(
    legendLayer: HTMLElement,
    summary: ABCSummary,
    settings: Settings,
    palette: ThemePalette
): void {
    if (!settings.legend.show) {
        hideLegend(legendLayer);
        return;
    }

    // Move the layer into the right position class (top/bottom/left/right).
    legendLayer.classList.remove(...["ppe-legend-layer"]);
    legendLayer.classList.add("ppe-legend-layer");
    legendLayer.style.display = "flex";

    legendLayer.innerHTML = "";

    const list = createLegendList();
    legendLayer.appendChild(list);

    // ABC swatches.
    for (const cls of [ABCClass.A, ABCClass.B, ABCClass.C]) {
        const summaryCls = summary.classes.find(s => s.className === cls);
        const color = settings.abcAnalysis.enabled
            ? (cls === ABCClass.A
                ? settings.abcAnalysis.colorA
                : cls === ABCClass.B
                    ? settings.abcAnalysis.colorB
                    : settings.abcAnalysis.colorC)
            : palette.abcColors[cls];
        const label = `${cls} (${fmtCount(summaryCls ? summaryCls.count : 0)})`;
        list.appendChild(swatchItem(color, label));
    }

    // Pareto line swatch.
    if (settings.paretoLine.show) {
        list.appendChild(swatchLine(settings.paretoLine.color, "Pareto Line"));
    }

    // Target line swatch.
    if (settings.targetLine.show) {
        list.appendChild(swatchLine(settings.targetLine.color, settings.targetLine.label || `${settings.targetLine.value}% Target`));
    }

    // Reference line entries.
    if (settings.referenceLines.show) {
        for (const rl of settings.referenceLines.lines) {
            list.appendChild(swatchLine(rl.color, rl.label || `${rl.value}% Reference`));
        }
    }
}

/** Tear down the legend entirely. */
export function hideLegend(legendLayer: HTMLElement): void {
    legendLayer.style.display = "none";
    legendLayer.innerHTML = "";
}

/* ============================================================
   INTERNAL — DOM builders (small, intentional HTML usage)
   ============================================================ */

function createLegendList(): HTMLDivElement {
    const list = document.createElement("div");
    list.className = classnames({ "ppe-legend-list": true });
    list.style.display = "flex";
    list.style.flexWrap = "wrap";
    list.style.gap = "12px";
    list.style.alignItems = "center";
    list.style.justifyContent = "center";
    list.style.width = "100%";
    return list;
}

function swatchItem(color: string, label: string): HTMLSpanElement {
    const item = document.createElement("span");
    item.className = "ppe-legend-item";

    const swatch = document.createElement("span");
    swatch.className = "ppe-legend-swatch";
    swatch.style.backgroundColor = color;

    const text = document.createElement("span");
    text.className = "ppe-legend-text";
    text.textContent = label;

    item.appendChild(swatch);
    item.appendChild(text);
    return item;
}

function swatchLine(color: string, label: string): HTMLSpanElement {
    const item = document.createElement("span");
    item.className = "ppe-legend-item";

    // Line "swatch" — short horizontal color bar.
    const line = document.createElement("span");
    line.className = "ppe-legend-swatch";
    line.style.height = "3px";
    line.style.width = "16px";
    line.style.borderRadius = "2px";
    line.style.backgroundColor = color;

    const text = document.createElement("span");
    text.className = "ppe-legend-text";
    text.textContent = label;

    item.appendChild(line);
    item.appendChild(text);
    return item;
}

function fmtCount(n: number): string {
    if (!Number.isFinite(n)) return "0";
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return String(n);
}
