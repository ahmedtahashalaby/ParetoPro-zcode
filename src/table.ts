/**
 * Pareto Pro Enterprise — Summary Table
 * -------------------------------------
 * Renders the summary table as pure HTML (leveraging the .ppe-table
 * styles in visual.less). Columns shown follow the user's toggles in
 * the Format pane table card:
 *
 *   Rank, Category, Value, %, Running Total, ABC, Variance
 *
 * The table is capped by {@link TableSettings.maxRows}; rows beyond the
 * cap are skipped (the KPI cards already reflect the full dataset).
 *
 * @module    table
 * @version   1.0.0
 */

import { ViewModel, TableSettings, ParetoPoint, ABCClass } from "./interfaces";
import { FormatOptions, format, formatPercent, formatRank } from "./formatter";

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Render the summary table into the supplied layer element. Honors all
 * per-column toggles from the {@link TableSettings}.
 */
export function drawTable(
    tableLayer: HTMLElement,
    vm: ViewModel
): void {
    const settings: TableSettings = vm.settings.table;
    if (!settings.show) {
        tableLayer.style.display = "none";
        tableLayer.innerHTML = "";
        return;
    }
    tableLayer.style.display = "block";
    tableLayer.innerHTML = "";

    const table = document.createElement("table");
    table.className = "ppe-table";
    table.style.fontSize = `${settings.fontSize}px`;

    const allPoints = vm.points;
    const max = Math.max(1, Math.min(settings.maxRows, allPoints.length || 1));
    const points = allPoints.slice(0, max);

    buildHeader(table, settings);
    buildBody(table, points, settings, vm);

    tableLayer.appendChild(table);
}

/** Hide the table when the user toggles it off. */
export function hideTable(tableLayer: HTMLElement): void {
    tableLayer.style.display = "none";
    tableLayer.innerHTML = "";
}

/* ============================================================
   INTERNAL — header & body builders
   ============================================================ */

function buildHeader(table: HTMLTableElement, settings: TableSettings): void {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");

    if (settings.showRank) appendTh(tr, "Rank");
    appendTh(tr, "Category");
    if (settings.showValue) appendTh(tr, "Value");
    if (settings.showPercent) appendTh(tr, "%");
    if (settings.showRunningTotal) appendTh(tr, "Running Total");
    if (settings.showABC) appendTh(tr, "ABC");
    if (settings.showVariance) appendTh(tr, "Variance");

    thead.appendChild(tr);
    table.appendChild(thead);
}

function buildBody(
    table: HTMLTableElement,
    points: ParetoPoint[],
    settings: TableSettings,
    vm: ViewModel
): void {
    const tbody = document.createElement("tbody");
    const fmtOpts: FormatOptions = {
        displayUnits: vm.settings.axes.displayUnits,
        thousandsSeparator: vm.settings.axes.thousandsSeparator,
        decimalPlaces: vm.settings.axes.decimalPlaces
    };
    const abcColors: Record<ABCClass, string> = {
        [ABCClass.A]: vm.settings.abcAnalysis.colorA,
        [ABCClass.B]: vm.settings.abcAnalysis.colorB,
        [ABCClass.C]: vm.settings.abcAnalysis.colorC
    };

    for (const p of points) {
        const tr = document.createElement("tr");
        if (p.isHighlight && !p.isSelected) {
            tr.style.opacity = "0.45";
        }

        if (settings.showRank) appendTd(tr, formatRank(p.rank));
        appendTd(tr, p.category);
        if (settings.showValue) appendTd(tr, format(p.value, fmtOpts));
        if (settings.showPercent) appendTd(tr, formatPercent(p.percent, fmtOpts));
        if (settings.showRunningTotal) appendTd(tr, format(p.runningTotal, fmtOpts));
        if (settings.showABC) appendTdABC(tr, p.abcClass, abcColors);
        if (settings.showVariance) appendTd(tr, format(p.variance, fmtOpts));

        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
}

function appendTh(tr: HTMLTableRowElement, label: string): void {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    tr.appendChild(th);
}

function appendTd(tr: HTMLTableRowElement, text: string): void {
    const td = document.createElement("td");
    td.textContent = text;
    tr.appendChild(td);
}

function appendTdABC(tr: HTMLTableRowElement, cls: ABCClass, colors: Record<ABCClass, string>): void {
    const td = document.createElement("td");
    const span = document.createElement("span");
    span.className = `ppe-table__abc ppe-table__abc--${cls}`;
    span.textContent = cls;
    span.title = `${cls} class`;
    span.style.backgroundColor = colors[cls];
    td.appendChild(span);
    tr.appendChild(td);
}
