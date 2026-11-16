# UI styling rule (AnamayOS)

Read docs/STYLE_GUIDE.md before touching any UI.
- All styling from theme tokens in src/app/globals.css (no hex, no hard-coded sizes or fonts).
- Dropdowns, menus, tooltips, popovers, date pickers and modals: only the shared components listed in the style guide. Never raw <select>, title tooltips, alert/confirm, or native date inputs.
- If a needed shared control doesn't exist, build it from tokens first and add it to the style guide.
- Check every dropdown/menu OPEN in the browser, light and dark, at phone width, before saying it's done.
