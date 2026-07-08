# Brand

Use this palette for Jurgens Energy product surfaces. Stay on brand unless a specific accessibility or product reason requires a controlled deviation.

## Palette

| Name | Hex | RGB | Use |
| --- | --- | --- | --- |
| Ink | `#080808` | `8, 8, 8` | dark backgrounds, strong text |
| Carbon | `#1A1A1A` | `26, 26, 26` | panels, dark neutrals |
| Porcelain | `#F7F7F2` | `247, 247, 242` | light backgrounds |
| Flame | `#FF5A1F` | `255, 90, 31` | primary brand action/accent |
| Amber | `#FFB000` | `255, 176, 0` | highlights, secondary accents, emphasis |

## CSS Tokens

The palette is available in `app/globals.css` as:

```css
--brand-ink: #080808;
--brand-carbon: #1a1a1a;
--brand-porcelain: #f7f7f2;
--brand-flame: #ff5a1f;
--brand-amber: #ffb000;
```

Use semantic tokens such as `--brand`, `--brand-strong`, `--background`, and shadcn tokens like `--primary` first. Reach for raw palette tokens only when a semantic token does not express the intent.

## Dashboard Direction

Admin and seller dashboards should keep the shared modern, minimal, technical feel:

- dark mode by default when the user's system prefers dark
- porcelain, ink, and carbon base surfaces
- flame brand actions and primary highlights
- amber secondary highlights or emphasis
- compact information density
- clear left navigation
- shadcn primitives first

Avoid drifting into blue/purple as the primary brand identity. Blue can still be used sparingly for charts or neutral system states, but brand emphasis should come from the flame/amber palette.

## Brand Assets

Store source-controlled brand assets in:

```text
public/brand/
```

Examples:

```text
public/brand/logo.svg
public/brand/logo-mark.svg
public/brand/logo-light.svg
public/brand/logo-dark.svg
public/brand/favicon.svg
public/brand/og-image.png
```

These are app assets and can be referenced from the browser as:

```text
/brand/logo.svg
```

Do not store user-uploaded marketplace media here. Uploaded media belongs in local storage under `storage/media` and is served by Caddy from `/media/*`.
