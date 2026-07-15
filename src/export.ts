/**
 * Pareto Pro Enterprise — Export Toolkit
 * --------------------------------------
 * In-visual export capabilities for CSV (data + table), SVG (vector
 * markup), PNG (raster via SVG serialization), and clipboard-copy of
 * the chart as a PNG image.
 *
 * @module    export
 * @version   1.0.0
 */

import { ViewModel, ParetoPoint } from "./interfaces";
import {
    formatCSVString,
    formatPlainNumber,
    formatRank
} from "./formatter";

/* ============================================================
   CSV
   ============================================================ */

/**
 * Build a CSV string of the full Pareto point table.
 * Columns: Rank, Category, Value, Percent, RunningTotal, Variance, ABC, CumulativePct.
 */
export function toCSV(vm: ViewModel): string {
    const headerCells = [
        "Rank",
        "Category",
        "Value",
        "Percent",
        "RunningTotal",
        "Variance",
        "ABC",
        "CumulativePercent"
    ];
    const header = headerCells.map(formatCSVString).join(",");
    const lines: string[] = [header];
    for (const p of vm.points) {
        lines.push([
            formatRank(p.rank),
            p.category,
            formatPlainNumber(p.value),
            formatPlainNumber(p.percent, 4),
            formatPlainNumber(p.runningTotal),
            formatPlainNumber(p.variance),
            p.abcClass,
            formatPlainNumber(p.cumulativePercent, 4)
        ].map(formatCSVString).join(","));
    }
    return lines.join("\n");
}

/** Trigger a CSV download in the browser. */
export function downloadCSV(vm: ViewModel, filename: string = "pareto-export.csv"): void {
    const csv = toCSV(vm);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, filename);
}

/* ============================================================
   SVG
   ============================================================ */

/** Serialize the chart <svg> as a standalone .svg document. */
export function toSVG(svg: SVGSVGElement): string {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    clone.setAttribute("viewBox", `0 0 ${w} ${h}`);

    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = "Pareto Pro Enterprise export";
    clone.prepend(title);

    return new XMLSerializer().serializeToString(clone);
}

/** Trigger a SVG (vector) download. */
export function downloadSVG(svg: SVGSVGElement, filename: string = "pareto-chart.svg"): void {
    const xml = toSVG(svg);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    triggerDownload(blob, filename);
}

/* ============================================================
   PNG — SVG -> canvas raster
   ============================================================ */

/** Rasterize an SVGSVGElement to a PNG Blob asynchronously. */
export function toPNG(svg: SVGSVGElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const dim = svg.getBoundingClientRect();
        const width = Math.max(64, Math.round(dim.width));
        const height = Math.max(64, Math.round(dim.height));
        const xml = toSVG(svg);

        const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Canvas 2D context unavailable in this host."));
                return;
            }
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(b => {
                if (b) {
                    resolve(b);
                } else {
                    reject(new Error("Canvas toBlob produced no output."));
                }
            }, "image/png");
        };
        img.onerror = () => reject(new Error("Failed to load SVG for rasterization."));
        img.src = url;
    });
}

/** Trigger a PNG download rasterized from the chart <svg>. */
export async function downloadPNG(svg: SVGSVGElement, filename: string = "pareto-chart.png"): Promise<void> {
    const blob = await toPNG(svg);
    triggerDownload(blob, filename);
}

/* ============================================================
   Clipboard
   ============================================================ */

/** Write the chart image (or CSV fallback) to the clipboard. */
export async function copyImageToClipboard(svg: SVGSVGElement, vm: ViewModel): Promise<void> {
    const blob = await toPNG(svg);
    const ClipboardItemCtor: typeof ClipboardItem | undefined =
        (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    if (!ClipboardItemCtor || !navigator.clipboard || !navigator.clipboard.write) {
        // Fallback: write the CSV when image copy is unavailable.
        await navigator.clipboard.writeText(toCSV(vm));
        return;
    }
    const item = new ClipboardItemCtor({ "image/png": blob });
    await navigator.clipboard.write([item]);
}

/* ============================================================
   INTERNAL
   ============================================================ */

function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Feature detection: true when image copy is supported. */
export function canCopyImage(): boolean {
    const w = window as unknown as { ClipboardItem?: unknown };
    return !!(w.ClipboardItem && navigator.clipboard && typeof navigator.clipboard.write === "function");
}

// ParetoPoint referenced to keep the type import honest even when tree-shaken.
export type { ParetoPoint };
