# Changelog

All notable changes to **Pareto Pro Enterprise** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-07-14

### Added

- **Initial production release** of Pareto Pro Enterprise.
- **Pareto chart** with clustered bars, smooth Pareto line (straight / smooth / bezier), and animated markers (circle / diamond / square).
- **Dual axis** with primary (values) and secondary (cumulative percentage) scales.
- **ABC Analysis** engine with automatic A/B/C classification on cumulative percentage, configurable thresholds (default 80 / 95 / 100), and per-class color theming.
- **Dynamic 80/20 analysis** with interactive target line and unlimited user-defined reference lines.
- **KPI cards** (six): Total Defects, Total Categories, Top 80%, Current %, Average, Maximum.
- **Summary table**: Rank · Category · Value · % · Running Total · ABC · Variance.
- **Formatting Model API** format pane with 15 cards: General, Columns, Pareto Line, Target Line, Reference Lines, Cards, Table, Legend, Tooltip, Animation, Axes, Grid, Theme, Statistics, ABC Analysis.
- **Column features**: rounded radius, gradient, border, shadow, hover animation, selection highlight, opacity, width, gap, conditional formatting.
- **Theme engine**: Auto / Light / Dark / Corporate Fluent palettes.
- **Interactions**: Selection Manager, cross-highlight, cross-filter, bookmarks, drill-down, drill-through, multi-select (Ctrl-click).
- **Tooltips**: professional HTML tooltip with Category, Value, %, Running Total, ABC, Rank, Difference, Previous, Average.
- **Labels**: Category, Value, Percentage, Running Total, with position, rotation, font, color.
- **Responsive layouts** for desktop, tablet, and phone with adaptive panel sizing.
- **Accessibility**: keyboard navigation, ARIA labels, screen-reader support, high-contrast mode.
- **Export**: CSV data, SVG, PNG, copy image.
- **Performance**: memoization, virtual rendering, lazy rendering, enter/update/exit pattern, supports up to 1,000,000 rows.
- **Error handling**: graceful rendering for No Data, Single Category, Null Values, Negative Values, Large Dataset, and Missing Fields.
- **Statistics**: median, standard deviation, Gini coefficient.

### Technical

- Layered MVC-style architecture (Tier 0–4) with strict separation of pure domain logic from rendering.
- Strict TypeScript (strictNullChecks, strictFunctionTypes, noImplicitAny, etc.).
- D3.js v7 with keyed enter/update/exit joins.
- Zero memory leaks — full disposal registry in `performance.ts`.
- Idempotent render pipeline (safe for bookmarks).

---

## Versioning policy

- `MAJOR` — breaking data-role or settings changes.
- `MINOR` — new features, backward compatible.
- `PATCH` — bug fixes and performance improvements.
