/**
 * Pareto Pro Enterprise — KPI Cards
 * ---------------------------------
 * Renders the six top-of-visual KPI cards as a horizontal HTML strip
 * (see .ppe-cards-layer in style/visual.less). The cards reveal:
 *
 *   1. Total Defects        (headline total of all values)
 *   2. Total Categories    (count of distinct categories)
 *   3. Top 80%             (number of categories that drive 80% of value)
 *   4. Current %           (the share achieved by the selected subset, when
 *                            a cross-filter is active; otherwise "100%")
 *   5. Average             (per-category average value)
 *   6. Maximum             (the largest single-category value)
 *
 * The cards live in HTML rather than SVG so they benefit from the
 * responsive flex layout in LESS; this keeps text always crisp at any
 * zoom level.
 *
 * @module    cards
 * @version   1.0.0
 */

import { ViewModel, Totals, ParetoPoint } from "./interfaces";
import { Settings } from "./interfaces";
import { KPI_CARDS, KpiCardId } from "./constants";
import { countTop80 } from "./paretoEngine";
import { FormatOptions, format, formatPercent } from "./formatter";

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Render (or hide) the cards strip into the supplied container.
 * The container already lays out cards via .ppe-cards-layer CSS.
 */
export function drawCards(
    cardsLayer: HTMLElement,
    vm: ViewModel
): void {
    const settings = vm.settings;
    if (!settings.cards.show) {
        cardsLayer.style.display = "none";
        cardsLayer.innerHTML = "";
        return;
    }
    cardsLayer.style.display = "flex";
    cardsLayer.innerHTML = "";

    const values = computeCardValues(vm);
    const fmtOpts: FormatOptions = {
        displayUnits: settings.axes.displayUnits,
        thousandsSeparator: settings.axes.thousandsSeparator,
        decimalPlaces: settings.axes.decimalPlaces
    };

    for (const def of KPI_CARDS) {
        const card = document.createElement("div");
        card.className = "ppe-card";
        card.style.backgroundColor = settings.cards.backgroundColor;
        card.style.color = settings.cards.fontColor;

        const accent = document.createElement("div");
        accent.className = "ppe-card__accent";
        accent.style.backgroundColor = accentColorForCard(def.id, settings, values);

        const value = document.createElement("div");
        value.className = "ppe-card__value";
        value.style.fontSize = `${settings.cards.fontSize}px`;
        value.textContent = def.isPercent
            ? formatPercent(values[def.id], fmtOpts)
            : format(values[def.id], fmtOpts);

        const label = document.createElement("div");
        label.className = "ppe-card__label";
        label.textContent = def.label;

        const srOnly = document.createElement("span");
        srOnly.className = "ppe-sr-only";
        srOnly.textContent = `${def.label}: ${value.textContent}`;

        card.appendChild(accent);
        card.appendChild(value);
        card.appendChild(label);
        card.appendChild(srOnly);
        cardsLayer.appendChild(card);
    }
}

/** Hide all cards. Convenience for edge-case rendering. */
export function hideCards(cardsLayer: HTMLElement): void {
    cardsLayer.style.display = "none";
    cardsLayer.innerHTML = "";
}

/* ============================================================
   INTERNAL — values per card
   ============================================================ */

interface CardValueMap {
    readonly [id: string]: number;
}

function computeCardValues(vm: ViewModel): CardValueMap {
    const totals: Totals = vm.totals;
    const points: ParetoPoint[] = vm.points;
    const top80 = countTop80(points);
    const currentPercent = vm.hasHighlights
        ? computeCurrentPercent(points)
        : 100;

    return {
        [KpiCardId.TotalDefects]: totals.total,
        [KpiCardId.TotalCategories]: totals.count,
        [KpiCardId.Top80]: top80,
        [KpiCardId.CurrentPercent]: currentPercent,
        [KpiCardId.Average]: totals.average,
        [KpiCardId.Maximum]: totals.maximum
    };
}

/** When cross-highlight is active, compute the share of value the highlighted subset covers. */
function computeCurrentPercent(points: ParetoPoint[]): number {
    let total = 0;
    let highlighted = 0;
    for (const p of points) {
        total += p.value;
        if (p.isHighlight) {
            highlighted += p.value;
        }
    }
    if (total <= 0) return 0;
    return (highlighted / total) * 100;
}

function accentColorForCard(id: KpiCardId, settings: Settings, _values: CardValueMap): string {
    void _values;
    if (!settings.abcAnalysis.enabled) {
        return settings.columns.fillColor;
    }
    switch (id) {
        case KpiCardId.TotalDefects:
        case KpiCardId.Top80:
            return settings.abcAnalysis.colorA;
        case KpiCardId.Average:
        case KpiCardId.CurrentPercent:
            return settings.abcAnalysis.colorB;
        case KpiCardId.TotalCategories:
        case KpiCardId.Maximum:
            return settings.abcAnalysis.colorC;
        default:
            return settings.columns.fillColor;
    }
}
