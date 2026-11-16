# AnamayOS style guide

Short on purpose. Read before any UI work.

## One theme, no hard-coded styling
- Every colour, radius and font comes from the tokens in `src/app/globals.css`.
  Brand layer: `--brand-*` (terra cotta button `#A35B4E`, green highlight
  `#A0BF52`, turquoise divider `#9CB5B1`, off-white subtle `#F5F7ED`,
  `--radius: 5px`). Everything else (`--primary`, `--border`, `--popover`...)
  derives from those, with a dark-mode set.
- Use the Tailwind utilities those tokens generate (`bg-brand-btn`,
  `text-primary`, `border-border`, `bg-popover`, `text-muted-foreground`).
  Never a hex value, pixel colour or font name in a component.
- Text through i18n (`src/i18n/en.ts` + `es.ts`), never inline English.

## Shared controls (never the browser's grey ones)
No raw `<select>`, `title=` tooltip, `alert`, `confirm` or native date picker.

| Need | Use |
|---|---|
| Menu or single choice from a list | `DropdownMenu` + `DropdownMenuRadioGroup` (`src/components/ui/dropdown-menu.tsx`) |
| Small floating panel (steppers, filters) | `Popover` (`src/components/ui/popover.tsx`) |
| Date | `DatePicker` (`src/components/shared/date-picker.tsx`), month names from Intl |
| Tooltip | `Tooltip` (`src/components/ui/tooltip.tsx`) |
| Modal | `Dialog` (`src/components/ui/dialog.tsx`) |
| Button | `Button` (`src/components/ui/button.tsx`) or `bg-brand-btn` for the main action |

Before calling UI done, look at it in a browser with every dropdown, menu and
picker OPEN, in light and dark mode, and at phone width.

## Layout
- Phone first, full width, no sideways scrolling. Grids collapse to one column.
- Links to other websites open in a new tab (`target="_blank" rel="noopener"`).
- No helper or explainer text lines in the UI unless asked; use a tooltip.

## Examples
- Public guest page: `/greenair` (`src/modules/greenair/components/`).
