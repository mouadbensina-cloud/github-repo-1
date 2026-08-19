# Travel website

Next.js 15 (App Router) + React 19 + Tailwind v4 + TypeScript.

```bash
npm run dev
```

## Hero section

Built from Figma [White Label B2C → Hero Section](https://www.figma.com/design/7Ccy7f4Uslfd5EKNAKj3sI/White-Label-B2C?node-id=33117-27356).

| File | Role |
| --- | --- |
| [HeroSection.tsx](components/hero/HeroSection.tsx) | Panel, logo, auth actions, owns the spotlight |
| [SearchPanel.tsx](components/hero/SearchPanel.tsx) | Mode tabs, query field, AI suggestions |
| [WorldBackdrop.tsx](components/hero/WorldBackdrop.tsx) | Rotating dot-map layer |
| [useSpotlight.ts](components/hero/useSpotlight.ts) | Pointer → CSS custom properties |
| [globals.css](app/globals.css) | Tokens + the backdrop/mask/animation CSS |

### The rotating world

The Figma `Union` layer is a 1894.43 × 304 strip: **one 643.3169px-wide dot tile
repeated three times**. Rather than ship the strip, one tile was extracted
(7,665 dots, r = 0.68) into [world-dots-tile.svg](public/patterns/world-dots-tile.svg)
and is repeated on the x-axis in CSS. Translating the track by exactly one tile
width loops forever with no visible seam, instead of a strip that runs out.

That extraction also took the asset from **4.7 MB → 247 KB** (43 KB gzipped).

The tile is applied as a `mask-image` over a solid colour, not as a picture, so
the dots can be recoloured freely.

### The cursor spotlight

The map is hidden by default and revealed only under the pointer:

- `useSpotlight` writes `--spot-x` / `--spot-y` on the hero, coalesced into one
  `requestAnimationFrame` per frame — no React re-render while the mouse moves.
- CSS turns those into a `radial-gradient` mask on `.world-viewport`.
- `--spot-size` is registered with `@property`, so the radius eases 0 → 220px on
  enter and back on leave. The position is deliberately not transitioned, so it
  tracks the cursor 1:1.
- `@media (hover: none)` holds a static reveal, and `prefers-reduced-motion`
  stops the rotation.

### Tuning

```tsx
<WorldBackdrop durationSeconds={90} opacity={0.34} ink="#000100" />
```

Reveal radius is `--spot-radius` on the hero panel in
[HeroSection.tsx](components/hero/HeroSection.tsx) (currently `220px`).

## Fonts

The design uses **Circular Std**, which is licensed and not bundled. Inter is
loaded as the stand-in. When you have the licence, drop the webfont in and add it
to the front of `--font-display` in [globals.css](app/globals.css) — every
`font-display` class picks it up with no other change.
