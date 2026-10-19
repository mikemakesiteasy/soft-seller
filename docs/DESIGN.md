# Visual spec: matching the prototype

Read this alongside README.md. If this file and the prototype disagree, the prototype wins.

## 1. Stylesheets (use these exact files)
- `design/modernist-base.css`: base tokens and components (`.btn`, `.tag`, `.field`, `.input`, `.card`, `.table`, `.dialog`, focus ring, disabled state).
- `design/sws-theme.css`: SWS overrides (blue/navy palette, bg, divider). Load it **after** the base.
- In React Native, copy the `:root` variables into a theme object with the same names (`colorAccent700`, etc.).

## 2. Font
- **Archivo** (Google Fonts), weights 400 / 600 / 700 / 800.
- Headings: 800, letter-spacing -0.01 to -0.02em, line-height ~1.05.
- Body: 400/600, 14–16px, line-height 1.45.
- Kicker labels: 11px, uppercase, letter-spacing .12em, weight 600, accent-700.
- Inputs: 16px minimum so iOS doesn't zoom.

## 3. Shape and lines
- **Corner radius is 0 everywhere.** The only exceptions are avatar/status dots (circles) and notification badges.
- Major section breaks: 2px solid `--color-divider` (navy at 40%). Rows inside a list: 1px.
- Shadows: only `--shadow-sm/md/lg` from the base sheet.

## 4. Sizes
- Hit targets ≥ 44px. Primary buttons 48–56px tall. Bottom tab bar 58px plus the safe area.
- Screen side padding: 20px. Card/tile padding: 14px. Grid gaps: 8–12px.
- Phone design width: 390px. On tablet and desktop the app sits in a centered column (max ~560px for forms, two panes for admin lists); it never stretches edge to edge.

## 5. Buttons and states
- Button labels are **flush left**, never centered, including full-width buttons. A trailing icon sits at the right.
- Primary: solid `--color-accent`. Hover → accent-600; pressed → accent-700.
- Secondary: navy outline. Ghost: text only.
- Focus: 2px accent outline with 2px offset (from the base sheet). Disabled: 45% opacity.
- Toggles: square 48×28 track, square knob, accent when on.

## 6. Color use
- Mostly navy ink on a near-white ground. Blue is for primary actions, active tabs, kicker labels and small emphasis.
- Navy fields (`--color-accent-900`) are used for: the login hero, the job header, the Buddy header and the status bar on dark screens.
- Errors: #b42318 on #fde8e8. Warnings/offline: #7a5a00 on #fff4d6.
- Paragraph text in blue must use accent-700 or darker (contrast).

## 7. Icons
- **Lucide** (lucide.dev), 2px stroke, 18–22px in UI, `currentColor`.

## 8. Images
- **Logos:** the prototype loads them from the SWS website:
  - Color: https://www.softwaterspecialistsllc.com/wp-content/uploads/2022/09/soft-water-specialist-logo.png
  - White (on navy): https://www.softwaterspecialistsllc.com/wp-content/uploads/2022/09/soft-water-specialist-logo-white.png

  Download both into the app; don't hot-link. Ask Matt for vector (SVG/AI) originals.
- **App icons:** `assets/icons/` (favicon, apple-touch, 192/512, maskable, manifest).
- **PDM logo:** `assets/pdm-logo.png` ("Powered by pdmrocks.com" footer).
- **Product photos:** uploaded by the admin. Show them on white, `object-fit: contain`.

## 9. Motion
Keep motion minimal: 150–200ms ease-out on screen changes and toggles, nothing bouncy. The live status changes in the message log (Queued → Sent → Delivered) animate only the tag color.

## 10. How to check your work
Open `prototype.html` next to your build at 390px, 768px and 1280px wide, and compare against `screenshots/`. Check spacing, rules, label alignment and type weights screen by screen.
