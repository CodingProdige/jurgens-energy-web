# Brand

Use this palette for Piessang product surfaces. Stay on brand unless a specific accessibility or product reason requires a controlled deviation.

## Palette

| Name | Hex | RGB | Use |
| --- | --- | --- | --- |
| Light Gold | `#FBE694` | `251, 230, 148` | highlights, soft accents, glow |
| Charcoal | `#525253` | `82, 82, 83` | text, dark neutrals |
| Golden Bronze | `#CCA137` | `204, 161, 55` | primary brand action/accent |
| Golden Bronze 2 | `#C4982D` | `196, 152, 45` | hover/active accent |
| Porcelain | `#FCFCF8` | `252, 252, 248` | light backgrounds |

## CSS Tokens

The palette is available in `app/globals.css` as:

```css
--brand-light-gold: #fbe694;
--brand-charcoal: #525253;
--brand-golden-bronze: #cca137;
--brand-golden-bronze-2: #c4982d;
--brand-porcelain: #fcfcf8;
```

Use semantic tokens such as `--brand`, `--brand-strong`, `--background`, and shadcn tokens like `--primary` first. Reach for raw palette tokens only when a semantic token does not express the intent.

## Dashboard Direction

Admin and seller dashboards should keep the shared modern, minimal, technical feel:

- dark mode by default when the user's system prefers dark
- porcelain and charcoal base surfaces
- golden bronze brand actions and highlights
- subtle light-gold glow or emphasis
- compact information density
- clear left navigation
- shadcn primitives first

Avoid drifting into blue/purple as the primary brand identity. Blue can still be used sparingly for charts or neutral system states, but brand emphasis should come from the gold/bronze palette.

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
