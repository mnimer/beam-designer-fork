---
name: "Dataflow Pipeline Designer"
description: "Unified UI/UX design system and token specification for the visual Apache Beam and Google Cloud Dataflow pipeline builder VS Code extension."
version: "alpha"
colors:
  canvas-bg: "#0d1117"
  workbench-bg: "#161b22"
  card-bg: "#161b22"
  subcard-bg: "#0d1117"
  input-bg: "#0d1117"
  border: "#30363d"
  border-light: "#21262d"
  text-primary: "#f0f6fc"
  text-secondary: "#c9d1d9"
  text-muted: "#8b949e"
  highlight: "#58a6ff"
  accent: "#238636"
  button-secondary: "#21262d"
  hover: "#21262d"
  source-primary: "#10b981"
  source-accent: "rgba(16, 185, 129, 0.1)"
  source-border: "rgba(16, 185, 129, 0.3)"
  step-primary: "#3b82f6"
  step-accent: "rgba(59, 130, 246, 0.1)"
  step-border: "rgba(59, 130, 246, 0.3)"
  sink-primary: "#ef4444"
  sink-accent: "rgba(239, 68, 68, 0.1)"
  sink-border: "rgba(239, 68, 68, 0.3)"
  sample-primary: "#a855f7"
  sample-accent: "rgba(168, 85, 247, 0.1)"
  sample-border: "rgba(168, 85, 247, 0.3)"
typography:
  display-lg:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.125rem"
    fontWeight: "700"
    lineHeight: "1.5"
  body-md:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: "400"
    lineHeight: "1.25rem"
  label-xs:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.75rem"
    fontWeight: "700"
    lineHeight: "1rem"
    letterSpacing: "0.05em"
  badge-micro:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.625rem"
    fontWeight: "700"
    lineHeight: "0.875rem"
    letterSpacing: "0.05em"
  code-sm:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: "0.75rem"
    fontWeight: "400"
    lineHeight: "1.25rem"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
  drawer: "320px"
components:
  node-card:
    backgroundColor: "{colors.card-bg}"
    borderColor: "{colors.border}"
    borderRadius: "{rounded.md}"
    padding: "{spacing.md}"
    minWidth: "180px"
  palette-drawer:
    width: "{spacing.drawer}"
    backgroundColor: "{colors.workbench-bg}"
    borderColor: "{colors.border}"
  property-inspector:
    width: "{spacing.drawer}"
    backgroundColor: "{colors.workbench-bg}"
    borderColor: "{colors.border}"
  bottom-panel:
    backgroundColor: "{colors.workbench-bg}"
    borderColor: "{colors.border}"
    headerHeight: "{spacing.2xl}"
---

## Overview

Architectural clarity meets developer precision. The Dataflow Pipeline Designer provides an intuitive, high-contrast visual IDE for authoring, configuring, and inspecting Apache Beam directed acyclic graphs (DAGs).

### Design Principles
1. **8pt Grid Discipline**: All paddings, margins, component heights, and gaps follow multiples of `8px` (with `4px` half-steps reserved for compact badges, inputs, and borders).
2. **Semantic VS Code Theming**: Rather than hardcoding fixed colors, all UI surfaces, borders, and typography derive from CSS custom properties (`--vscode-*`), supporting **Dark+**, **Light+**, **High Contrast Dark (WCAG AAA)**, and **High Contrast Light (WCAG AAA)**.
3. **Tri-Color DAG Taxonomy**: Pipeline stages are visually instantly identifiable via strict category coding:
   - **Sources**: Emerald Green (`#10b981`)
   - **Transforms / Steps**: Azure Blue (`#3b82f6`)
   - **Sinks**: Rose Red (`#ef4444`)
   - **Samples**: Purple / Violet (`#a855f7`)
4. **Data Density with Breathing Room**: Information is densely structured using compact labels and monospace values, while maintaining clean 16px section padding and clear hierarchy.

---

## Colors

The color palette leverages deep neutral slate surfaces with category-specific vibrant accents for pipeline data flow representation.

### Surfaces & Neutrals
- **Canvas Background (`{colors.canvas-bg}` / `--vscode-canvas-bg`):** Deep charcoal/slate foundation (`#0d1117`) for the infinite React Flow canvas.
- **Workbench & Sidebars (`{colors.workbench-bg}` / `--vscode-workbench-bg`):** `#161b22` providing contrast against the canvas.
- **Card Surfaces (`{colors.card-bg}` / `--vscode-card-bg`):** `#161b22` for floating node cards, draggable palette items, and controls.
- **Subcards & Code Containers (`{colors.subcard-bg}` / `--vscode-subcard-bg`):** `#0d1117` recessed surfaces for inputs and syntax previews.
- **Borders (`{colors.border}` / `--vscode-border`):** Subtle dividers (`#30363d`) and hairline borders (`#21262d`).

### Pipeline Category Accents
- **Sources (`#10b981`):** Represents data ingestion (Pub/Sub, Kafka, BigQuery Read, TextIO, FileIO, Spanner, JDBC).
  - Background: `bg-emerald-500/10`
  - Border: `border-emerald-500/30`
  - Text/Badge: `text-emerald-400`
- **Transforms & Steps (`#3b82f6`):** Represents data manipulation (ParDo, Map, FlatMap, Windowing, Aggregations, Filter, ParseMessage).
  - Background: `bg-blue-500/10`
  - Border: `border-blue-500/30`
  - Text/Badge: `text-blue-400`
- **Sinks (`#ef4444`):** Represents terminal output destinations (BigQuery Write, Pub/Sub Publish, Kafka Write, LogMessage, TextIO Sink).
  - Background: `bg-rose-500/10`
  - Border: `border-rose-500/30`
  - Text/Badge: `text-rose-400`
- **Samples (`#a855f7`):** Represents pre-built starter templates.
  - Background: `bg-purple-500/10`
  - Border: `border-purple-500/30`
  - Text/Badge: `text-purple-400`

### Interactive & Action Accents
- **Highlight / Selection (`#58a6ff`):** Focus outlines, tab active indicators, and active connector edge highlights.
- **Primary CTA (`#238636` / `#2563eb`):** High-confidence actions such as `GENERATE CODE` and `RUN NOW`.

---

## Typography

The typography system pairs **Inter** for clean UI chrome and high-legibility forms with **JetBrains Mono** for code previews, runtime variables, and technical identifiers.

### Hierarchy & Scale

| Style Level | Font Family | Size | Weight | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`display-lg`** | Inter | `1.125rem` (`18px`) | Bold (`700`) | `1.5` | Top-level drawer headers and modal titles |
| **`body-md`** | Inter | `0.875rem` (`14px`) | Regular (`400`) | `1.25rem` | Form inputs, dropdown values, card descriptions |
| **`label-xs`** | Inter | `0.75rem` (`12px`) | Bold (`700`) | `1rem` | Uppercase field labels and section dividers |
| **`badge-micro`** | Inter | `0.625rem` (`10px`) | Bold (`700`) | `0.875rem` | Category pill badges, node IDs, item count badges |
| **`code-sm`** | JetBrains Mono | `0.75rem` (`12px`) | Regular (`400`) | `1.25rem` | Generated source code preview, `$VARIABLE` chips |

---

## Layout

### 8pt Spacing Scale

| Token | Dimension | Tailwind Class | Application |
| :--- | :--- | :--- | :--- |
| `xs` | `4px` | `p-1`, `gap-1` | Micro-spacing, handle border thickness, badge padding |
| `sm` | `8px` | `p-2`, `gap-2` | Input padding, icon container padding, card inner gaps |
| `md` | `12px` | `p-3`, `gap-3` | Node internal padding, property group spacing, canvas grid gap |
| `lg` | `16px` | `p-4`, `gap-4` | Sidebar drawer padding, panel header padding, form vertical gaps |
| `xl` | `24px` | `p-6`, `gap-6` | Major column gutters (Deployment tab 2-column layout) |
| `2xl` | `32px` | `h-8`, `p-8` | Action button heights, tab bar headers |
| `drawer` | `320px` | `w-80` | Left node palette drawer and right property inspector width |

### Canvas & Panel Layout Blueprint
- **Center Canvas**: Infinite viewport containing React Flow `<Background gap={12} size={1} />`.
- **Left Slide-out Palette (`w-80`)**: Fixed-width drawer with vertical rotated tab buttons on the far left.
- **Right Property Inspector (`w-80`)**: Fixed-width slide-out drawer pinned to the right edge with `z-20`.
- **Bottom Drawer**: Resizable container with draggable handle divider (`h-1 hover:bg-[var(--vscode-highlight)] cursor-row-resize`), defaulting to `320px` height with a full-screen toggle (`Maximize2` / `Minimize2`).

---

## Elevation & Depth

Surfaces use a combination of layered background shades and subtle drop shadows rather than heavy skeuomorphic effects.

- **Canvas Level (Elevation 0)**: Flat background with subtle grid dots (`--vscode-grid-dots`).
- **DAG Nodes & Floating Drawers (Elevation 1)**: `shadow-xl` (`box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5)`), with `border border-[var(--vscode-border)]`.
- **Hover & Selection Rings (Elevation 2)**:
  - Selected Source: `border-emerald-400 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/10`
  - Selected Step: `border-blue-400 ring-2 ring-blue-500/50 shadow-lg shadow-blue-500/10`
  - Selected Sink: `border-red-400 ring-2 ring-red-500/50 shadow-lg shadow-red-500/10`
- **Floating Overlays & Portals (Elevation 3)**: Tooltips rendered via React Portals directly into `document.body` with `z-50 shadow-2xl backdrop-blur-sm`.

---

## Shapes

- **Base Radius (`rounded-md`, 6px)**: Standard for DAG node cards, search input fields, and property form inputs.
- **Small Radius (`rounded-sm`, 4px)**: Pill badges, micro badges, and connection handle socket containers.
- **Large Radius (`rounded-lg`, 8px)**: Floating controls toolbar, minimap window, and sidebar draggable item cards.
- **Pill / Circular (`rounded-full`, 9999px)**: React Flow connection handles (`10px x 10px` circular circles).

---

## Components

### 1. DAG Node (`PipelineNode`)
- **Container**: `bg-[var(--vscode-node-bg)] border rounded-md shadow-xl p-3 flex items-center gap-3 min-w-[180px]`.
- **Category Icon Box**: Left container with category background (`bg-*/10`), border (`border-*/30`), and 20px Lucide icon.
- **Editable Title**: Inline double-clickable `<input className="nodrag bg-[var(--vscode-input-bg)] border border-[var(--vscode-highlight)] rounded px-1.5 py-0.5 text-sm font-bold text-[var(--vscode-text-primary)]" />` with `Enter` (commit) and `Escape` (cancel).
- **Connection Handles**:
  - `Source`: 1 right output handle (`bg-emerald-500`).
  - `Step`: 1 left target handle (`bg-blue-500`), 2 right source handles (`valid` in green, `error`/DLQ in red).
  - `Sink`: 1 left target handle (`bg-rose-500`).

### 2. Left Node Palette (`NodesCard` & `SidebarItem`)
- **Vertical Tab Strip**: Vertical rotated text labels (`writing-mode: vertical-rl; transform: rotate(180deg)`), category icon, and item count badge.
- **Search Header**: Sticky top search bar with auto-filtering.
- **Exclusive Accordions**: Expanding an accordion category automatically collapses siblings to avoid vertical scrolling overflow.
- **Draggable Cards**: Grip handle icon, category badge, description, and direct `+` add button on hover.

### 3. Right Property Inspector (`PropertyPane` & `PropertyForm`)
- **Header**: Category tag, editable node label, and monospace Node ID.
- **Field Layout**:
  - Stack: `flex flex-col gap-1`.
  - Label: `text-xs font-bold uppercase text-[var(--vscode-text-muted)] flex items-center gap-1.5`.
  - Input/Select: `bg-[var(--vscode-input-bg)] text-[var(--vscode-text-primary)] p-2 rounded border border-[var(--vscode-border)] text-sm`.
- **InfoTooltips**: Portal-rendered hoverable info popups with viewport clamping.
- **Code Generation Instructions**: Bottom textarea for Gemini prompt customization.
- **Runtime Variables**: Expandable drawer with clipboard copy buttons.

### 4. Bottom Panel (`BottomPanel`)
- **Header Bar**: Horizontal tabs (`SOURCE CODE` with file count badge, `DEPLOYMENT`), plus `Maximize2` / `Minimize2` toggle button on the far right.
- **Source Code Tab**: Split layout with target language picker (Python/Java), output folder browse button, `GENERATE CODE` CTA, and horizontal multi-file tabs with syntax-highlighted editor view.
- **Deployment Tab**: 2-column runner configuration (DirectRunner, Dataflow, Serverless Spark), instance sliders, subnetwork selector, `RUN NOW` CTA, and runtime variables table.

---

## Do's and Don'ts

### Do's
- **DO** use the 8pt grid scale (`p-2`, `p-4`, `p-6`, `gap-2`, `gap-4`) for all spacing.
- **DO** use semantic CSS variables (`var(--vscode-*)`) so all components automatically switch between Dark, Light, and High Contrast themes.
- **DO** map node categories strictly: Emerald for Sources, Blue for Steps, Rose/Red for Sinks.
- **DO** render floating dropdowns and tooltips via React Portals into `document.body` to prevent clipping by scrollable containers.
- **DO** include `<InfoTooltip text="..." />` for every transform property field.

### Don'ts
- **DON'T** use inline styles (`style={{ ... }}`) except for dynamic coordinates during drag-resize operations.
- **DON'T** hardcode static hex colors (`#ffffff`, `#000000`) for surfaces, borders, or text.
- **DON'T** use inline event handlers; use named or memoized event callbacks.
- **DON'T** introduce arbitrary non-8pt padding values (e.g., avoid `p-[7px]`, `m-[13px]`).
- **DON'T** use two-way data binding; emit changes up via `onChange` and pass state down.
