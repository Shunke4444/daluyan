# Daluyan Console — Design System

Design contract for the operator console frontend. Every token, component, and
motion decision traces back here before code.

## 0. Research Log

- **Source extraction**: All tokens derived from `index.css` (lines 1-313) and
  `MessagesPage.tsx` (lines 1-296). No external design tooling or Figma file.
- **Visual identity**: Light split-pane command center. Soft panels on #fafafa
  background, white cards with subtle box-shadows, indigo accent (#3e48ff).
- **Typography**: Montserrat (headings/nav) + Inter (body) stack. Both
  system-safe; no external font imports beyond the existing Google Fonts link.
- **Icon set**: lucide-react (installed, no emoji icons).
- **Spacing grid**: 4px base. Component padding uses 8/10/12/13/14/16/17/18/20/24/28px.
  Border radii: 7-20px range (pills at 18-999px).

---

## 1. Color Palette

### Surface

| Token | Value | Usage |
|---|---|---|
| `--background` | `0 0% 100%` (#fff) | Page background |
| `--card` | `0 0% 100%` (#fff) | Card/panel surfaces |
| `--muted` | `240 4.8% 95.9%` (#f4f4f4) | Secondary surfaces, tab track, search bar |
| `--muted-foreground` | `240 3.8% 46.1%` (#818181) | Subdued text, labels, timestamps |
| `--foreground` | `240 10% 3.9%` (#111) | Primary text |
| `--border` | `240 5.9% 90%` (#e2e8f0) | Default borders, dividers |
| `--input` | `240 5.9% 90%` (#e2e8f0) | Input field borders |

### Accent

| Token | Value | Hex | Usage |
|---|---|---|---|
| `--primary` | `240 5.9% 10%` | `#292929` | Filter active bg, headings |
| `--primary-foreground` | `0 0% 98%` | `#fff` | Text on primary bg |
| Indigo accent | (hardcoded) | `#3e48ff` | Active nav, send button, links, active tabs, info-button active |

### Semantic

| Token | Value | Hex | Usage |
|---|---|---|---|
| `--destructive` | `0 72% 45%` | `#ff3030` | Emergency/needs-help badge, profile avatar ring |
| `--destructive-foreground` | `0 0% 98%` | `#fff` | Text on destructive bg |
| `--success` | `142 70% 30%` | `#22c55e` | Safe status |
| `--success-foreground` | `0 0% 98%` | `#fff` | Text on success bg |
| `--warning` | `38 92% 40%` | `#f59e0b` | Stuck/preparing status |
| `--warning-foreground` | `0 0% 98%` | `#fff` | Text on warning bg |

### Status Colors (flood_status)

| Status | Color | Hex | Strip | Group |
|---|---|---|---|---|
| `monitoring` | Gray | `#6b7280` | `bg-gray-400` | Before flood |
| `preparing` | Yellow | `#eab308` | `bg-yellow-400` | Before flood |
| `sheltering` | Purple | `#a855f7` | `bg-purple-400` | Before flood |
| `evacuating` | Blue | `#3b82f6` | `bg-blue-400` | During flood |
| `safe` | Green | `#22c55e` | `bg-green-500` | During flood |
| `needs_help` | Red | `#ef4444` | `bg-red-500` | During flood |
| `recovery` | Teal | `#14b8a6` | `bg-teal-400` | After flood |
| `unreachable` | Dark gray | `#374151` | `bg-gray-700` | During flood |
| `relocated` | Light blue | `#06b6d4` | `bg-cyan-500` | During flood |
| `medical` | Rose | `#e11d48` | `bg-rose-600` | During flood |
| `stranded` | Amber | `#d97706` | `bg-amber-500` | During flood |

---

## 2. Typography Scale

| Level | Font | Size | Weight | Letter-spacing | Usage |
|---|---|---|---|---|---|
| h1 (panel) | Montserrat | 28px | 800 | -0.04em | "Messages" heading |
| h2 (modal) | system | 22px | 800 | — | Modal titles |
| h2 (profile) | system | 18px | 500 | — | Contact name |
| h3 (section) | system | 13-14px | 600-700 | — | Detail section headings |
| strong (nav) | Montserrat | 13px | 600 | — | Nav link labels |
| body | Inter | 11-13px | 400 | — | Message text, descriptions |
| caption | Inter | 9-10px | 400-700 | — | Timestamps, meta, small labels |
| badge | Inter | 9px | 700 | — | Nav badge, unread dot |

---

## 3. Spacing & Layout

### Grid

- Workspace: CSS Grid, `minmax(340px, 34%) minmax(460px, 1fr)` (2 columns)
- Details open: 3 columns — `minmax(320px, 30%) minmax(410px, 1fr) minmax(310px, 30%)`
- Mobile (<1100px): Details panel overlays as absolute-positioned right sheet
- Mobile (<760px): List panel shrinks to 250px
- Mobile (<640px): Forms go single-column

### Component Spacing

| Element | Padding/margin |
|---|---|
| List panel | 24px top, 20px sides |
| Thread panel | 28px message area, 18px sides |
| Thread header | 18px horizontal |
| Contact card | 9px 8px |
| Filter row | 12px 0 vertical, 7px gap |
| Status menu | 7px padding, 3px gap |
| Composer | 12px 16px horizontal |

### Border Radius

| Element | Radius |
|---|---|
| Nav link | 15px |
| Panel cards, modals | 20px |
| Filter chips | 18px (pill) |
| Input fields | 9-13px |
| Avatar | 50% (999px) |
| Message bubbles | 16px 16px 16px 4px (in), 16px 16px 4px 16px (out) |
| Tabs track | 13px |
| Tab items | 10px |

---

## 4. Motion Tokens

All animations use GPU-composited properties only: `transform`, `opacity`, `filter`.
No layout property animation (no `width`, `height`, `margin`, `padding`).

### Easing Curves

| Name | Value | Usage |
|---|---|---|
| ease-out-soft | `cubic-bezier(.2,.8,.2,1)` | Entrance animations, page enter |
| ease-spring | `cubic-bezier(.2,1.3,.3,1)` | Badge pop-in |
| ease-out-smooth | `cubic-bezier(.2,.9,.2,1)` | Modal card, nav indicator |
| ease-in-out | `ease` | Hover transitions, backdrop |

### Durations

| Duration | Usage |
|---|---|
| 150ms | Hover state changes (color, transform) |
| 160-180ms | Button feedback, link hover, focus rings |
| 220-240ms | Panel slides, detail panel entrance |
| 260ms | Nav indicator scale |
| 360ms | Page entrance, badge pop |

### Keyframes

| Name | From | To |
|---|---|---|
| `messages-enter` | opacity:0, translateY(8px) | opacity:1, translateY(0) |
| `bubble-enter` | opacity:0, translateY(6px) scale(.98) | opacity:1, translateY(0) scale(1) |
| `modal-backdrop-in` | opacity:0 | opacity:1 |
| `modal-card-in` | opacity:0, translateY(10px) scale(.98) | opacity:1, translateY(0) scale(1) |
| `details-slide-in` | opacity:0, translateX(24px) | opacity:1, translateX(0) |
| `nav-indicator-in` | opacity:0, scaleY(.25) | opacity:1, scaleY(1) |
| `nav-badge-in` | opacity:0, scale(.4) | opacity:1, scale(1) |
| `chip-enter` | opacity:0, scale(.85) | opacity:1, scale(1) |
| `card-highlight` | opacity:0, translateX(-4px) | opacity:1, translateX(0) |
| `panel-slide-up` | opacity:0, translateY(12px) | opacity:1, translateY(0) |
| `status-indicator-in` | opacity:0, scaleX(0) | opacity:1, scaleX(1) |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

This applies globally. All motion must degrade gracefully.

---

## 5. Component Primitives

### Navigation

- Fixed left rail, 76px wide (64px mobile)
- Backdrop-filter blur(14px) for frosted glass
- Active link: indigo accent, left indicator bar (3px), box-shadow
- Hover: translateY(-2px) scale(1.03), white bg, 8px shadow

### Mode Tabs

- 3-column grid: Active / Archive / Mass-Send
- Track: `#f4f4f4`, items: transparent, active: white + 3px shadow
- Transition: background 160ms, transform on hover

### Search Bar

- 46px height, `#f4f4f4` background, 13px radius
- lucide Search icon + input, no visible border

### Filter Chips

- 31px height, `#f4f4f4` background, 18px pill radius
- Active: `#292929` bg, white text
- Custom chips: include X remove button (8px circle, subtle)
- Enter key on filter builder saves filter

### Contact Card

- Grid: 46px avatar | copy (name + preview) | meta (time + unread dot)
- Hover: white bg, translateX(2px)
- Selected: white bg, 4px shadow
- Unread dot: 8px, `#3e48ff`, absolutely positioned

### Status Menu

- Dropdown below status button, 7px padding, sections separated by border-top
- Each item has a 3px left color strip matching status color
- Active item: `#f0f1ff` bg, indigo text
- Phases grouped: Before / During / After flood

### Status Button

- 42px height, full width, border + chevron
- Left color strip: 3px, matches current status color
- Current status displayed with capitalize

### Thread Panel

- Gradient background: `linear-gradient(rgba(244,244,244,.86), rgba(240,241,244,.94))`
- Message bubbles: white with 4px radius corner, soft shadow
- Outgoing: `#e0ddff` background, mirrored radius

### Composer

- 76px height, white background
- Plus button (attachment), text input, indigo Send button
- Send: rotate(-8deg) scale(1.06) on hover, disabled at 0.38 opacity

### Details Panel

- Right-side overlay on mobile (absolute, z-index: 20, blur shadow)
- Profile section: 88px avatar ring (red), centered info
- Actions grid: 3-column, 58px height buttons
- Template list: max 2 shown, expandable

### Modals

- Backdrop: `rgba(20,22,32,.38)` + blur(5px)
- Card: max 760px, 20px radius, 24px padding, 70px shadow
- Form grid: 2-column, fields with 9px radius, focus ring (indigo, 3px)

### Mass-Send Panel

- Preview-first design: compose message, select zones, see recipient count
- Template selector with severity levels
- Source/center/route fields
- Disabled/guarded Send Wave button (explicitly not firing /api/send)
- Per-language preview tabs (Filipino, Cebuano, English)

---

## 6. Accessibility

- All interactive elements have visible focus rings (3px solid, indigo tint)
- `aria-label` on icon-only buttons
- `role="presentation"` on modal backdrops
- Keyboard: Enter saves filter, Escape closes modals (via backdrop click)
- Color contrast: all text meets WCAG AA on white/gray backgrounds
- Status colors carry text labels, never rely on color alone
- `prefers-reduced-motion` disables all animations globally

---

## 7. Accepted Debt

- `api.ts` has `any` types (pre-existing; not modified in this scope)
- Status values are string literals, not a union type (backend-driven)
- No `DESIGN.md` existed before this file — this is the bootstrap
