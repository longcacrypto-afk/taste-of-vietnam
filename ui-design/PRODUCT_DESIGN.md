# Product UI: first P2 slice

This is a repeat-use app, not a landing page. Preserve the existing Taste of Vietnam identity, not the college's institutional brand. Existing anchors: `app_shell.html` live panels (charcoal #18181B hero, amber #FBBF24 actions, pale #F4F6F9 canvas) and `ui_kit.js` food cards (22px radius, 20px padding, human Vietnamese copy). Existing bundled food/mascot assets are illustrative demo images, not newly sourced photos.

Alternatives considered: retain the phone mockup on all widths; clean up desktop live panels in place; dedicated shared product shell. Chosen: shared shell, because both device sizes need real API state and no Studio furniture. No new framework or build migration. Signature: charcoal food introduction with amber action. Product views use system font fallback from the existing Be Vietnam Pro stack, without adding a remote font dependency.

Content order: today suggestions → dish/recipe → nearby places → external order hand-off → meal confirmation. Secondary paths: catalogue search; Măm query; saved dishes; taste/privacy settings. Administration is a distinct, permission-checked path. Each API view starts loading, then content/empty/error with a safe retry. Failed writes retry only on a deliberate click; no automatic write replay. Product navigation exposes only M1–M5 and M9. Studio and frozen module source remain unchanged.

Scale: 12/14/18/24/32/40px; 4px spacing base; 20/24/32px layout gaps; primary ink on amber (not white on yellow). At 360px one-column cards, at 768px two columns, at 1440px three. Native links, labels, buttons, visible keyboard focus and route titles are mandatory.
