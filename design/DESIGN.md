---
name: StockSense Executive Inventory
colors:
  surface: '#f6faff'
  surface-dim: '#d2dbe4'
  surface-bright: '#f6faff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#ecf5fe'
  surface-container: '#e6eff8'
  surface-container-high: '#e0e9f2'
  surface-container-highest: '#dbe4ed'
  on-surface: '#141d23'
  on-surface-variant: '#4d444a'
  inverse-surface: '#293138'
  inverse-on-surface: '#e9f2fb'
  outline: '#7f747a'
  outline-variant: '#d0c3c9'
  surface-tint: '#74556b'
  primary: '#3c2236'
  on-primary: '#ffffff'
  primary-container: '#54384d'
  on-primary-container: '#c7a2bb'
  inverse-primary: '#e2bbd5'
  secondary: '#79526f'
  on-secondary: '#ffffff'
  secondary-container: '#fac9ea'
  on-secondary-container: '#78516d'
  tertiary: '#003038'
  on-tertiary: '#ffffff'
  tertiary-container: '#004853'
  on-tertiary-container: '#43bcd2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd7f2'
  primary-fixed-dim: '#e2bbd5'
  on-primary-fixed: '#2b1326'
  on-primary-fixed-variant: '#5a3e53'
  secondary-fixed: '#ffd7f1'
  secondary-fixed-dim: '#e9b8d9'
  on-secondary-fixed: '#2f1029'
  on-secondary-fixed-variant: '#5f3b56'
  tertiary-fixed: '#a4eeff'
  tertiary-fixed-dim: '#62d6ed'
  on-tertiary-fixed: '#001f25'
  on-tertiary-fixed-variant: '#004e5a'
  background: '#f6faff'
  on-background: '#141d23'
  surface-variant: '#dbe4ed'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Manrope
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  code-md:
    fontFamily: monospace
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system pairs the operational discipline of enterprise ERP systems with executive-grade polish. Drawing direct inspiration from modern Odoo enterprise architecture, it establishes an environment of unyielding visual order, tactile clarity, and high-density productivity.

### Identity Principles
- **Executive Restraint:** The visual surface is primarily crisp white (`#FFFFFF`) framed by neutral borders (`#DEDEDE`) and soft operational grays (`#F8F9FA`). Deep signature plum tones are deployed strictly to demarcate active workflow states, navigation anchor points, and definitive commitments.
- **Architectural Utility:** Every layout structure favors direct visual accessibility over decorative ambiguity. No glassmorphic blur filters, ambient glow shadows, or non-functional gradients exist in the interface.
- **Data Poise:** The intersection of geometric Manrope headings, neutral Inter transactional text, and fixed-width tabular metrics equips inventory managers, logistics dispatchers, and CFOs with instant situational awareness across warehouse operations.

## Colors

The system relies on a calibrated enterprise palette engineered for sustained daily interaction in warehouse control rooms and procurement offices.

### Palette Roles
- **Primary Anchor (`#54384D`):** The foundational plum shade. Reserved for the terminal end of structural header bars, deep elevation elements, and high-priority visual commitments.
- **Interactive Plum (`#714B67`):** Primary buttons, active sidebar selections, focus state outlines, and primary transaction figures.
- **Header Gradient:** `linear-gradient(to right, #714B67, #54384D)` applied exclusively to top structural section cards and table header action bars.
- **Workflow Pipeline Plum (`#702963`):** Pipeline nodes, connector tracks, and transition arrows in the workflow stepper.
- **Navigation Plum (`#65435C`):** Subdued plum calibrated for interactive breadcrumbs, secondary tabs, and linked entity codes.
- **Teal Accent (`#17A2B8`):** Informational callouts, secondary positive interactions, and receipt confirmations.
- **Mint Accent (`#00CEB3`):** Precision annotation marks and high-visibility status indicators.
- **System Feedback:** 
  - Warning/Pending: `#DD8F3B`
  - Success/Fulfilled: `#28A745`
  - Danger/Discarded: `#DC3545`
  - External Link/Integration: `#257CFD`
- **Surfaces & Borders:** 
  - Primary Canvas: `#FFFFFF`
  - Secondary Table & Filter Deck: `#F8F9FA`
  - Table Row Hover: `#F6F4F5`
  - Structural Divider: `#DEDEDE`
  - Text Primary: `#212529`
  - Text Secondary/Muted: `#6C757D`

## Typography

The typographic hierarchy combines the modern geometric authority of Manrope with the dense readability of Inter.

### Application Rules
- **Titles & Module Banners:** Headings are rendered in Manrope with optical kerning set to clean negative values (`-0.01em` to `-0.02em`) to guarantee tight structural cohesion.
- **Body & Data Grid:** All general workflow UI, table text, metadata, form labels, and instructions are rendered in Inter. Table cells default to `14px` (`body-sm`) with a dense `20px` line height. Form labels utilize `13px` (`label-md`) with medium weight for clear visual distinction from standard text.
- **Technical Tabular Data:** Product SKUs, batch tracking IDs, barcode sequences, and inventory counts must be rendered with monospaced tabular numerals (`code-md`) to ensure vertical column alignment across complex operational tables.

## Layout & Spacing

Layouts follow a fluid, responsive 12-column grid system tuned for enterprise ERP workflows.

### Grid & Density
- **Desktop (1200px+):** 12-column fluid grid, `margin-lg` (32px), `gutter-lg` (24px). Sidebar navigation docks at a fixed 240px width or 64px compact icon state.
- **Tablet (768px - 1199px):** 12-column grid, `margin-md` (24px), `gutter` (16px). Data tables permit horizontal scrolling with pinned key identification columns.
- **Mobile (< 768px):** Single-column stack, `margin` (16px), `gutter` (16px). Dual-action toolbars compress to stacked button rows.

### Spacing Rhythm
- Compact UI components (table rows, button groups, filter dropdown chips) use dense step increments (`space-xs` = 4px, `space-sm` = 8px).
- Major container padding, panel separations, and form groups adhere strictly to `space-md` (16px) and `space-lg` (24px).

## Elevation & Depth

Visual hierarchy is communicated via clean structural boundaries and deliberate flat stacking rather than simulated real-world depth.

### Boundary Principles
- **No Drop Shadows:** Default cards, toolbars, and operational tables do not use blur shadows. Structural depth is established exclusively using 1px borders in `#DEDEDE` set against `#FFFFFF` or `#F8F9FA` surfaces.
- **Floating Overlays:** Contextual dropdown menus, autocompleting comboboxes, and modal confirmation dialogs are the only components permitted elevation: `0 4px 12px rgba(33, 37, 41, 0.08)`.
- **Active Focus:** Interactive form inputs and actionable row selections display an exterior 3px focus ring tinted with plum: `rgba(113, 75, 103, 0.25)`.

## Shapes

The design system maintains strict geometry with standard `0.25rem` (4px) micro radii and `0.5rem` (8px) component boundaries.

### Geometry Hierarchy
- **Panels, Cards, and Inputs:** Uniform `8px` corner radius. When a section header uses the plum gradient, its top-left and top-right radii match the `8px` boundary, while the bottom edges remain square (`0px`) against the container body.
- **Form Controls & Buttons:** Standard height interactive elements (44px regular, 34px compact) enforce `8px` corner rounding.
- **Status Pills:** Exceptions to the corner rule; inventory workflow pills (`Draft`, `Waiting`, `Ready`, `Done`, `Canceled`) use fully rounded pill geometry (`9999px`) to immediately signal categorical, non-input metadata.
- **User Avatars:** Rounded-square geometry (`8px` radius on a 36px x 36px bounding box).

## Components

### Buttons
- **Primary:** Solid `#714B67` background, `#FFFFFF` text. Height is 44px (default) or 34px (compact data-table actions). Padding is 16px horizontal. Radius is 8px. Hover state deepens to `#54384D`.
- **Secondary (Teal):** Solid `#17A2B8` background, `#FFFFFF` text. Used for immediate secondary actions (e.g., "Print Labels", "Check Availability").
- **Outline Warning:** Transparent background, 1px solid `#DD8F3B`, text `#DD8F3B`. Hover state applies `rgba(221, 143, 59, 0.08)` background.
- **Outline Neutral:** 1px solid `#DEDEDE`, text `#212529`, background `#FFFFFF`. Hover state switches surface to `#F8F9FA`.
- **Destructive Action:** 34px compact square button with transparent background, borderless, displaying `#DC3545` icon. Hover initiates `rgba(220, 53, 69, 0.08)` surface fill.

### Cards & Structural Containers
- Standard panels feature an uninterrupted `#FFFFFF` surface, 1px solid `#DEDEDE` perimeter, 8px radius, and 24px inner padding.
- **Section Header Card:** Houses the signature horizontal gradient bar `linear-gradient(to right, #714B67, #54384D)` across the top with 8px upper radius, containing 18px semibold white typography and contextual sub-actions.

### Input Fields
- Inputs feature 42px height, 12px horizontal padding, 1px solid `#DEDEDE` border, and 8px radius. Text rendered in `#212529` (`14px`). Placeholder in `#6C757D`.
- Focus state switches border color to `#714B67` and engages a 3px outer ring in `rgba(113, 75, 103, 0.25)`.

### Status Pills
- Compact badges (24px height, 10px horizontal padding) with bold `12px` uppercase white text and a `9999px` circular radius.
  - **Draft:** `#6C757D`
  - **Waiting:** `#DD8F3B`
  - **Ready:** `#17A2B8`
  - **Done:** `#28A745`
  - **Canceled:** `#DC3545`

### Workflow Pipeline Stepper
- Odoo-style horizontal pipeline situated at the top right of transaction records.
- Nodes are linked via 2px solid connector lines. Completed stages display solid `#702963` fill with white check icons. The active stage is an outlined `#702963` node with bold plum text. Pending stages display `#DEDEDE` outlines with muted `#6C757D` text.

### Data Tables
- Container framed with 1px solid `#DEDEDE` and an 8px outer radius.
- Table header row uses `#F8F9FA` background, 38px height, `13px` uppercase semi-bold text in `#6C757D`, and 1px border-bottom.
- Body rows measure 48px height, 16px cell padding, separated by 1px `#DEDEDE` horizontal rules. Hover state shifts row canvas to `#F6F4F5`.

### Alert Callouts
- **Info Alert:** Solid background in `#D1ECF1`, text `#09414A`, 1px solid `rgba(9, 65, 74, 0.15)`, and 8px radius with 16px internal padding.