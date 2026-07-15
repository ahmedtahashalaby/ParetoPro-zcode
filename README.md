# Pareto Pro Enterprise

> Production-grade Microsoft Power BI Custom Visual — Pareto Chart + ABC Analysis + Interactive Dashboard.

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Power BI](https://img.shields.io/badge/Power%20BI-Custom%20Visual-yellow) ![D3](https://img.shields.io/badge/D3.js-v7-orange)

Pareto Pro Enterprise is a superior Pareto chart visual combining Pareto analysis, ABC classification, dynamic 80/20 analysis, KPI cards, a summary table, drill-down, cross-filtering, a theme engine, and data export — rendered with crisp SVG powered by D3.js v7 and styled with Microsoft Fluent design.

---

## ✨ Features

| Area | Capabilities |
| --- | --- |
| **Chart** | Clustered bar chart, smooth Pareto line, dual axis, interactive target line, animated markers, dynamic labels, ABC colors |
| **ABC Analysis** | Automatic A/B/C classification on cumulative %, configurable thresholds (default 80 / 95 / 100), per-class colors |
| **KPI Cards** | Total, Categories, Top 80%, Current %, Average, Maximum |
| **Summary Table** | Rank · Category · Value · % · Running Total · ABC · Variance |
| **Format Pane** | General, Columns, Pareto Line, Target Line, Reference Lines, Cards, Table, Legend, Tooltip, Animation, Axes, Grid, Theme, Statistics, ABC Analysis |
| **Interactions** | Selection Manager, cross-highlight, cross-filter, bookmarks, drill-down, multi-select (Ctrl-click) |
| **Themes** | Light, Dark, Corporate, Auto (from report) — Microsoft Fluent UI design language |
| **Responsive** | Adaptive layouts for desktop, tablet, phone |
| **Accessibility** | Keyboard navigation, ARIA labels, screen-reader support, high-contrast mode |
| **Export** | CSV data, SVG, PNG, copy image |
| **Performance** | Virtual rendering, memoization, lazy rendering, supports up to 1,000,000 rows |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v16+ and npm
- [Power BI Visual SDK CLI](https://learn.microsoft.com/power-bi/developer/visuals/create-new-visual) (`pbiviz`)

```bash
# Install the Power BI visuals CLI globally (one-time)
npm install -g powerbi-visuals-tools
```

### Install dependencies

```bash
npm install
```

### Develop in Power BI

```bash
pbiviz start
```

This starts a local dev server. In Power BI Desktop or service, add a "Power BI Visual" (the `<…>` developer visual icon) and bind it to your data.

### Package for distribution

```bash
pbiviz package
```

The compiled `.pbiviz` file is written to the `dist/` folder and can be imported into any report via ** visuals → "Get more visuals" → "Import a visual from a file"**.

---

## 📊 Data Roles

| Role | Kind | Purpose |
| --- | --- | --- |
| **Category** | Grouping | The category to analyze (defect type, product, region…) |
| **Measure** | Measure | The numeric value to aggregate and rank |
| **Tooltips** | Measure | Extra measures shown in the tooltip |

---

## 🏗 Architecture

The visual follows a layered MVC-style architecture:

```
Power BI Host → visual.ts (lifecycle) → Domain Core (pure) → Rendering (D3/SVG)
```

- **Tier 2 (Domain Core)** is pure TypeScript: same input → same output, memoizable, unit-testable.
- **Tier 4 (Rendering)** never mutates model state; it reads an immutable `ViewModel` and writes only to SVG.
- One-way data flow: `DataView → ViewModel → Render Commands → SVG`.

See `CHANGELOG.md` for release notes and the inline code documentation for implementation details.

---

## 🧰 Tech Stack

- **TypeScript** (strict mode)
- **D3.js v7**
- **SVG** (no Canvas)
- **Power BI Visual SDK** (latest)
- **Formatting Model API**
- Selection Manager, Tooltip Service, Localization API

No React. No Angular. No Canvas.

---

## 📁 Project Structure

```
ParetoPro/
├── capabilities.json     # data roles, mappings, format objects
├── pbiviz.json           # visual manifest
├── package.json
├── tsconfig.json
├── assets/
│   └── icon.png          # visual icon
├── style/
│   └── visual.less       # Fluent styling
└── src/
    ├── visual.ts         # lifecycle root (IVisual)
    ├── interfaces.ts     # all type contracts
    ├── constants.ts      # defaults & enums
    ├── settings.ts       # Formatting Model API descriptors
    ├── theme.ts          # Fluent palettes (light/dark/corporate)
    ├── model.ts          # ViewModel builder
    ├── dataProcessor.ts  # DataView → domain rows
    ├── paretoEngine.ts   # cumulative % + ranking
    ├── abcAnalysis.ts    # A/B/C classification
    ├── statistics.ts     # mean/median/std/gini
    ├── formatter.ts      # K/M/B + locale formatting
    ├── utils.ts          # color, dom, geometry helpers
    ├── renderer.ts       # render orchestrator
    ├── bars.ts           # bar geometry + gradients
    ├── line.ts           # pareto line + bezier
    ├── axis.ts           # dual-axis scales
    ├── cards.ts          # KPI cards
    ├── table.ts          # summary table
    ├── tooltip.ts        # tooltip service integration
    ├── legend.ts         # ABC legend
    ├── labels.ts         # data labels
    ├── targetLine.ts     # interactive target line
    ├── referenceLines.ts # unlimited reference lines
    ├── animations.ts     # d3 transitions
    ├── selection.ts      # selection manager wrapper
    ├── responsive.ts     # breakpoint layout
    ├── accessibility.ts  # ARIA + keyboard
    ├── export.ts         # CSV / SVG / PNG / clipboard
    ├── performance.ts    # memoization + virtualization
    └── errorHandler.ts   # edge-case rendering
```

---

## 📝 License

MIT — see [LICENSE](./LICENSE).
