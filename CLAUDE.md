# BIQ Design System — Claude Code Rules

This file is the authoritative reference for implementing UI from the BIQ Figma specs
(`BIgLY3nKIyaoGr985kWIal`, Section 1, node `6:86`).
Follow these rules for every Figma-driven UI change. See also [AGENTS.md](AGENTS.md) for
workflow rules that also apply.

---

## Project Stack

- **Frontend:** Static HTML + CSS + Vanilla JS
  - Layout/pages: `webapp/index.html`
  - Global styles + generic primitives: `webapp/css/style.css`
  - BIQ design-system tokens + components: `webapp/css/biq-design-system.css`
  - Component behaviour: `webapp/js/biq-design-system.js`
  - Design-system showcase: `webapp/design-system.html`
- **Backend:** Flask (`server.py`)
- IMPORTANT: Do NOT add Tailwind, React, or any CSS framework. Use vanilla CSS custom properties.

---

## 1. Color Tokens

All tokens live in `webapp/css/biq-design-system.css` under `:root`. Token names use the
`--biq-*` namespace. **Never hardcode hex values in component CSS.**

### Blues (primary brand palette)

| Token | Value | Usage |
|---|---|---|
| `--biq-blue-navy-100` | `#1d3049` | Primary dark navy — primary fill buttons, headings |
| `--biq-blue-navy-70` | `#1d3049b2` | 70 % navy — pressed/active state overlay |
| `--biq-blue-navy-40` | `#1d304966` | 40 % navy |
| `--biq-blue-navy-30` | `#1d30494d` | 30 % navy — hover overlay on dark surfaces |
| `--biq-blue-navy-10` | `#1d30491a` | 10 % navy — subtle tint backgrounds |
| `--biq-blue-100` | `#143055` | Secondary navy — sidebar bg, deep surfaces |
| `--biq-blue-20` | `#14305533` | 20 % secondary navy |
| `--biq-blue-10` | `#1430551a` | 10 % secondary navy |
| `--biq-blue-05` | `#1430550d` | 5 % secondary navy — ghost hover |
| `--biq-blue-mid` | `#7EAAD6` | Mid blue — accent, links, icons on dark bg |
| `--biq-blue-grey-dark` | `#35465B` | Dark blue-grey — sidebar icons, secondary text |
| `--biq-blue-grey` | `#818E9C` | Blue-grey — placeholder text, muted labels |
| `--biq-blue-grey-light` | `#A3B1BF` | Light blue-grey — disabled text, borders |
| `--biq-blue-wash` | `#E5EBF1` | Very light blue — table alternating rows, backgrounds |

### Greys (neutral palette)

| Token | Value | Usage |
|---|---|---|
| `--biq-grey-1` | `#FBFBFB` | Near-white — page background |
| `--biq-grey-2` | `#F2F2F2` | Light grey — card/panel background |
| `--biq-grey-3` | `#DADADA` | Dividers, borders, rule lines |
| `--biq-grey-5` | `#9C9C9C` | Secondary/helper text |
| `--biq-grey-6` | `#8A8A8A` | Muted labels |
| `--biq-grey-9` | `#1D1D1D` | Near-black — primary body text |

### Surfaces & Overlays

| Token | Value | Usage |
|---|---|---|
| `--biq-white` | `#FFFFFF` | Pure white |
| `--biq-surface-01` | `#ffffff` | Default card/modal surface |
| `--biq-surface-05` | `#ffffff0d` | 5 % white glass/overlay on dark |
| `--biq-overlay-20` | `#00000033` | 20 % black scrim — modals, drag handles |
| `--biq-overlay-05` | `#0000000d` | 5 % black — subtle dividers on light bg |

### Semantic / Status

| Token | Value | Usage |
|---|---|---|
| `--biq-green` | `#8AC27C` | Success, approved, positive state |
| `--biq-red-light` | `#FF8686` | Error, warning, destructive |

---

## 2. Typography

**Font family:** Inter (weights 400 / 500 / 600 / 700 already loaded in the project).
All Figma text styles use `lineHeight: 100%` and `letterSpacing: 0`.

| Token | Size | Weight | CSS shorthand |
|---|---|---|---|
| `--biq-type-heading-24` | 24px | 500 | `500 24px/1 'Inter', sans-serif` |
| `--biq-type-heading-20` | 20px | 500 | `500 20px/1 'Inter', sans-serif` |
| `--biq-type-heading-16` | 16px | 500 | `500 16px/1 'Inter', sans-serif` |
| `--biq-type-heading-12` | 12px | 500 | `500 12px/1 'Inter', sans-serif` |
| `--biq-type-body-14` | 14px | 500 | `500 14px/1 'Inter', sans-serif` |

Usage rules:
- IMPORTANT: Never declare a raw `font-size` in px in component CSS. Reference the token via
  a CSS variable or utility class.
- Section headings → `--biq-type-heading-20` or `--biq-type-heading-24`
- Panel/card headings → `--biq-type-heading-16`
- Labels, nav items, body text → `--biq-type-body-14`
- Small metadata / timestamps / helper text → `--biq-type-heading-12`

---

## 3. Spacing & Sizing

Base unit is **4 px**. All padding, gap, and margin values must be multiples of 4.

| Token | px | Usage |
|---|---|---|
| `--biq-space-1` | 4px | Tight internal padding |
| `--biq-space-2` | 8px | Icon padding inside CTA |
| `--biq-space-3` | 12px | Card internal padding (small) |
| `--biq-space-4` | 16px | Standard inner padding |
| `--biq-space-5` | 20px | Section padding |
| `--biq-space-6` | 24px | Large section gap |

### Fixed dimensions (do not deviate)

| Purpose | Value |
|---|---|
| Sidebar width | 222px |
| Nav/CTA item height | 42px |
| Large button height | 48px |
| Medium button height | 33px |
| Small button height | 27px |
| Large message/input height | 56px |
| Medium message/input height | 40px |
| Small message/input height | 36px |
| Chat row height | 88px |
| Chat history item height | 66px |
| Table row height | 44–50px |
| Icon size (default) | 20–24px |
| Icon size (small) | 16px |
| Minimum touch target | 42px |

---

## 4. Component Catalog

### 4.1 Button (`CTA`)

Class prefix: `.biq-btn`

**Props / variant axes:**

| Axis | Values |
|---|---|
| `kind` | `fill` (primary) · `outlined` (secondary) · `fill-2` (tertiary/ghost) |
| `size` | `lg` · `md` · `sm` |
| `type` | `text` · `text-icon` · `icon` |
| `state` | `default` · `hover` · `active` · `focus-visible` · `disabled` |

**Sizes:**

```
lg:  height 48px — icon buttons 48×48 px, text buttons 100px+ wide
md:  height 33px — icon buttons 32×32 px
sm:  height 27px — icon buttons ~23×23 px
```

**CSS class convention:**

```html
<!-- Primary filled, large, text+icon -->
<button class="biq-btn biq-btn--fill biq-btn--lg biq-btn--text-icon">
  <span class="biq-btn__icon">…</span>
  <span class="biq-btn__label">Send</span>
</button>

<!-- Secondary outlined, medium, text only -->
<button class="biq-btn biq-btn--outlined biq-btn--md">Label</button>

<!-- Tertiary ghost, small, icon only -->
<button class="biq-btn biq-btn--fill-2 biq-btn--sm biq-btn--icon" aria-label="…">…</button>
```

State rules:
- `disabled` → set `disabled` attribute + `.is-disabled`; use `--biq-blue-grey-light` text,
  `cursor: not-allowed`
- `hover` → lighten background by applying `--biq-blue-navy-30` overlay or `opacity: 0.85`
- `focus-visible` → 2px outline using `--biq-blue-mid` with 2px offset

---

### 4.2 Message Input (`Message`)

Class prefix: `.biq-message`

Sizes: `lg` (56px), `md` (40px), `sm` (36px).
States: `default`, `hover`, `disabled`.

```html
<div class="biq-message biq-message--lg">
  <input type="text" placeholder="Ask BIQ…" />
</div>
```

- Contains optional leading icon and trailing send/action button.
- Background: `--biq-surface-01`; border: 1px solid `--biq-grey-3`.
- Focus: border-color → `--biq-blue-mid`.

---

### 4.3 Chat Input Row (`chat`)

Class prefix: `.biq-chat`

Fixed: 809px wide, 88px tall (full-width in main content area).
States: `default`, `hover`, `disabled`.

Anatomy:
- Left: mic icon CTA (48×48)
- Center: `<textarea>` or large message input (expands between icons)
- Right: submit CTA button (text+icon, large fill)

```html
<div class="biq-chat">
  <button class="biq-btn biq-btn--icon biq-btn--fill biq-btn--lg" aria-label="Voice input">
    <!-- mic icon -->
  </button>
  <div class="biq-message biq-message--lg biq-chat__input">…</div>
  <button class="biq-btn biq-btn--text-icon biq-btn--fill biq-btn--lg biq-chat__submit">
    <span class="biq-btn__label">Send</span>
    <!-- side nav icons -->
  </button>
</div>
```

---

### 4.4 Sidebar (`side bar`)

Class prefix: `.biq-sidebar`

Fixed width: 222px. Full-height panel on the left edge of the app shell.

Internal anatomy (top → bottom):

1. **Header** (48px) — logo wordmark (`Component 2` instance, 80×16) + dock-to-right icon CTA
2. **Action bar** (88px) — two PROMPTS items: New Chat (edit_square icon) + Search (search icon)
3. **Divider** — `--biq-grey-3` 1px horizontal rule
4. **Projects section** — collapsible accordion
   - Section label "Projects" in `--biq-type-heading-12`, `--biq-grey-6`
   - Items: folder icon + project name, `--biq-type-body-14`
5. **Divider**
6. **Chat History** — collapsible list
   - Section label "Chat History"
   - Items: 66px tall, title (`--biq-type-body-14`) + date + time (`--biq-type-heading-12`)
7. **Divider**
8. **User profile footer** (50px) — circular avatar (initials) + full name

```html
<aside class="biq-sidebar">
  <div class="biq-sidebar__header">…</div>
  <nav class="biq-sidebar__actions">…</nav>
  <hr class="biq-divider" />
  <section class="biq-sidebar__projects">…</section>
  <hr class="biq-divider" />
  <section class="biq-sidebar__history">…</section>
  <hr class="biq-divider" />
  <div class="biq-sidebar__user">…</div>
</aside>
```

---

### 4.5 Navigation Item (`PROMPTS`)

Class prefix: `.biq-nav-item`

Height: 42px. Icon (20px) + label text (`--biq-type-body-14`).

States: `default`, `hover` (background `--biq-blue-05`), `selected` (background `--biq-blue-10`,
text `--biq-blue-navy-100`).

```html
<button class="biq-nav-item [is-selected]" role="menuitem">
  <span class="biq-nav-item__icon"><!-- svg icon --></span>
  <span class="biq-nav-item__label">New Chat</span>
</button>
```

---

### 4.6 Chat History Item

Class prefix: `.biq-history-item`

Height: 66px, padding 12px. Contains:
- Title row: `--biq-type-body-14`, `--biq-grey-9`, truncated to 1 line
- Metadata row: date text (left) + time text (right), `--biq-type-heading-12`, `--biq-grey-5`

```html
<div class="biq-history-item">
  <p class="biq-history-item__title">Finalized Bill 0070016386</p>
  <div class="biq-history-item__meta">
    <span>7th Mar</span>
    <span>9:45AM</span>
  </div>
</div>
```

---

### 4.7 Table Row

Class prefix: `.biq-table-row`

Row height: 44–50px. Columns (left → right):
1. Checkbox (40px col) — `check_box` / `check_box_outline_blank` icons
2. Row index (51px col) — `--biq-type-heading-12`
3. Matter name (~116px col) — primary label `--biq-type-body-14` + sub-label `--biq-type-heading-12`
4. Client (~116px col) — same two-line structure
5. Billing partner (~116px col)
6. Amount (~114px col) — right-aligned
7. Status (~116px col) — status badge + value
8. Time (90px col) — time + date, stacked

Dividers between columns use `--biq-grey-3` vertical rules (1px).

```html
<div class="biq-table-row" role="row">
  <div class="biq-table-row__check">…</div>
  <div class="biq-table-row__index">1</div>
  <div class="biq-table-row__matter">
    <span class="biq-table-row__label">0070016401</span>
    <span class="biq-table-row__sublabel">Jessica L.</span>
  </div>
  <!-- … remaining columns … -->
</div>
```

---

### 4.8 Status Badge / Chip

Class prefix: `.biq-badge`

Height: 22px, horizontal padding 10px, border-radius 4px.

Variants:

| Class modifier | Background | Text |
|---|---|---|
| `.biq-badge--neutral` | `--biq-blue-wash` | `--biq-blue-grey-dark` |
| `.biq-badge--success` | `--biq-green` at 20% | `--biq-green` |
| `.biq-badge--error` | `--biq-red-light` at 20% | `--biq-red-light` |

```html
<span class="biq-badge biq-badge--neutral">Pending Review</span>
<span class="biq-badge biq-badge--success">Approved</span>
```

---

### 4.9 Billing / Matter Item

Class prefix: `.biq-matter-item`

Height: 50px. Two columns:
- Left (139px): matter number (`--biq-type-body-14`) + assignee name (`--biq-type-heading-12`, `--biq-grey-5`)
- Right (33px): hamburger icon (three-dot / kebab menu trigger)

Divider between rows: `--biq-grey-3` 1px horizontal line.

---

### 4.10 User Avatar (initials)

Class prefix: `.biq-avatar`

Circular element, 42×42px. Background: `--biq-blue-navy-100`. Text: initials, `--biq-white`,
`--biq-type-heading-16`.

```html
<div class="biq-avatar" aria-label="Sam Walter">SW</div>
```

---

### 4.11 Notification Badge

Class prefix: `.biq-notif-btn`

48×48px icon button (notifications_unread icon). Positioned top-right of the main content area.
Use `.biq-btn--icon.biq-btn--fill` as base, extend for the unread dot overlay.

---

### 4.12 Dropdown / Accordion Toggle

Use `keyboard_arrow_down` icon (24×24) adjacent to section label.
On expand, rotate icon 180°: `transform: rotate(180deg)`.
Toggle class `.is-expanded` on the section container.

---

## 5. Icon System

Icons are Material Symbols / custom SVGs embedded inline. **Do not install icon font libraries.**

| Icon name | Used in |
|---|---|
| `mic` | Chat input — voice input CTA |
| `edit_square` | Sidebar — New Chat action |
| `search` | Sidebar — Search action |
| `folder` | Sidebar — project nav items |
| `keyboard_arrow_down` | Accordion toggles, dropdowns |
| `notifications_unread` | Top-right notification button |
| `dock_to_right` | Sidebar header — collapse button |
| `progress_activity` | Chat — in-progress/loading spinner |
| `hamburger` / `more_vert` | Matter item — context menu trigger |
| `check_box` | Table — checked row |
| `check_box_outline_blank` | Table — unchecked row |

Rules:
- IMPORTANT: Use the SVG inline or via `<use>` from the existing sprite; never use icon fonts.
- IMPORTANT: If Figma MCP provides a localhost asset URL for an SVG, use it directly.
- Icon-only buttons must have `aria-label`.
- Default icon size: 20–24px. Small/table icons: 16px.

---

## 6. Layout

### App Shell

```
┌──────────────────────────────────────────────────────────────┐
│  .biq-sidebar (222px fixed)  │  .biq-main (flex-grow)        │
│                              │  ┌─────────────────────────── │
│  header                      │  │ .biq-toolbar (top bar)     │
│  actions                     │  ├─────────────────────────── │
│  projects                    │  │ .biq-content (scrollable)  │
│  history                     │  ├─────────────────────────── │
│  user                        │  │ .biq-chat (88px fixed bot) │
│                              │  └─────────────────────────── │
└──────────────────────────────────────────────────────────────┘
```

- Sidebar: `position: fixed` or `flex-shrink: 0`, background `--biq-blue-100`
- Main: `display: flex; flex-direction: column; flex: 1`
- Content area: `overflow-y: auto; padding: var(--biq-space-5)`
- Chat row: `flex-shrink: 0; height: 88px`

### Notification panel / floating card

Floating panels (e.g. `.biq-panel`) use:
- Background: `--biq-surface-01`
- Border: 1px solid `--biq-grey-3`
- Border-radius: 8px
- Shadow: `0 4px 16px var(--biq-overlay-20)`

---

## 7. Figma MCP Workflow (Required)

1. Call `get_design_context` on the target node ID + file key `BIgLY3nKIyaoGr985kWIal`.
2. If the section node returns sparse XML metadata, call `get_design_context` on individual
   child node IDs listed in the metadata.
3. Call `get_screenshot` for visual parity reference.
4. Translate the React/Tailwind reference output into this project's HTML/CSS/vanilla JS stack.
5. Map all colour references to `--biq-*` tokens. Map Tailwind font/spacing classes to BIQ tokens.
6. Reuse existing `.biq-*` classes before creating new ones.
7. Validate the rendered UI against the screenshot before marking complete.

---

## 8. Do-Not Rules

- IMPORTANT: Never hardcode hex values — always use `--biq-*` CSS custom properties.
- IMPORTANT: Never install Tailwind, React, Vue, or any JS/CSS framework.
- IMPORTANT: Never use icon font packages — use inline SVG only.
- IMPORTANT: Never use placeholder images or colours when Figma provides real assets/tokens.
- Do not break existing Font Analyzer tab IDs and script bindings in `webapp/index.html`.
- Do not create new CSS files — extend `biq-design-system.css` or `style.css`.
- Do not deviate from the fixed dimensional values listed in Section 3.
