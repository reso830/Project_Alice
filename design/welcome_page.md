# Welcome Experience — Design Specification
**Project Alice** · May 2026

---

# 1. Overview

The Welcome Experience serves as the public-facing landing page of Project Alice.

Its goals are to:

- Establish the visual identity of the product
- Introduce the application's purpose quickly
- Provide immediate access to authentication flows
- Showcase realistic previews of the platform
- Present the product as clean, practical, and thoughtfully designed

The experience should feel:

- Modern but grounded
- Product-focused rather than marketing-heavy
- Minimal but not empty
- Technical without being intimidating
- Calm and productivity-oriented

This is not meant to look like a generic startup SaaS homepage.

---

# 2. Core Design Direction

Project Alice follows a restrained visual language built around:

- Warm off-white backgrounds
- Dark navy structural elements
- Indigo interactive accents
- Monospace support typography
- Subtle depth and shadows
- Realistic product previews

The welcome page should visually connect with the Tracker, Profile, Calendar, and Modal systems already defined in the existing design specs.

The hero visuals should feel like believable screenshots of the actual application rather than fabricated dashboard mockups.

---

# 3. Layout Structure

## Desktop Layout

The default layout uses a diagonal split between:

- A left-side content column
- A right-side hero visualization slab

```text
┌────────────────────────────────┬─────────────────────┐
│                                │                     │
│  Brand                         │                     │
│  Headline                      │     Hero Visual     │
│  Supporting Copy               │     Slideshow       │
│  CTA Buttons                   │                     │
│  Footer Meta                   │                     │
│                                │                     │
└────────────────────────────────┴─────────────────────┘
```

## Left Content Column

Purpose:

- Branding
- Product messaging
- Primary actions

### Specs

| Property | Value |
|---|---|
| Width | ~55% |
| Padding | `6vw` |
| Alignment | Vertically centered |
| Background | `var(--bg)` |
| Z-index | Above hero slab |

## Right Hero Slab

Purpose:

- Product visualization
- Motion and visual depth
- UI previews

### Specs

| Property | Value |
|---|---|
| Width | ~62% |
| Background | `var(--navy)` |
| Position | Anchored right |
| Overflow | Hidden |
| Clip Path | Diagonal polygon |

### Desktop Clip Path

```css
clip-path: polygon(22% 0, 100% 0, 100% 100%, 6% 100%);
```

The diagonal should feel architectural and subtle rather than aggressive.

---

# 4. Responsive Behaviour

## Tablet (`760px–1100px`)

Adjustments:

- Hero slab narrows slightly
- Typography scales down modestly
- Padding tightens
- CTA row remains horizontal

## Mobile (`<760px`)

The layout becomes vertically stacked.

```text
[ Hero ribbon ]
[ Brand ]
[ Headline ]
[ Supporting Copy ]
[ CTA stack ]
[ Footer meta ]
```

## Mobile Hero Ribbon

The hero section becomes a decorative ribbon at the top.

### Specs

```css
height: 260px;
clip-path: polygon(0 0, 100% 0, 100% 80%, 0 100%);
```

The hero preview should remain partially visible behind the crop.

## Narrow Mobile (`<420px`)

Adjustments:

- CTA buttons stack vertically
- Buttons become full width
- Footer metadata wraps

---

# 5. Typography

## Font System

| Usage | Font |
|---|---|
| Headlines / UI | Sora |
| Data / Technical Elements | DM Mono |

## Headline

```text
Your job search,
organized.
```

### Desktop

| Property | Value |
|---|---|
| Font | Sora |
| Weight | 700 |
| Size | 54px |
| Line Height | 1.05 |
| Tracking | -1.6px |
| Color | `var(--t1)` |

### Mobile

| Property | Value |
|---|---|
| Size | 38px |
| Tracking | -1px |

The line break is intentional and should remain fixed.

## Supporting Copy

### Specs

| Property | Value |
|---|---|
| Font | Sora |
| Size | 14px |
| Weight | 400 |
| Color | `var(--t2)` |
| Max Width | `420px` |
| Line Height | 1.7 |

Tone should remain concise and product-focused.

---

# 6. Brand Block

## Structure

```text
[Alice Icon] Project Alice
```

## Icon

| Property | Value |
|---|---|
| Asset | `Alice_White.png` |
| Size | `44×44px` |
| Object Fit | contain |

## Wordmark

| Property | Value |
|---|---|
| Font | Sora |
| Size | 16px |
| Weight | 600 |
| Tracking | -0.3px |

### Layout

```css
gap: 10px;
align-items: center;
```

---

# 7. CTA Group

## Actions

| Action | Type |
|---|---|
| Sign In | Primary |
| Create Account | Secondary |
| Try Demo | Ghost |

The CTA row should feel compact and utility-oriented.

Avoid oversized marketing buttons.

## Primary Button

```css
background: var(--indigo);
color: #ffffff;
border-radius: 8px;
padding: 12px 18px;
```

### Hover

```css
background: var(--indigo-hover);
transform: translateY(-1px);
```

## Secondary Button

```css
background: transparent;
border: 1.5px solid var(--border);
```

### Hover

```css
border-color: var(--indigo);
background: var(--indigo-soft);
```

## Ghost Button

Text-only appearance.

Hover should increase opacity only.

---

# 8. Hero Visual System

## Purpose

The hero visual should represent:

- The actual application
- Realistic UI density
- Multiple areas of the product
- The warm/minimal visual identity

It should NOT:

- Look like a fake analytics dashboard
- Use excessive graphs
- Feel futuristic
- Overuse gradients
- Use heavy glassmorphism

---

# 9. Hero Slideshow

## Slide Rotation

The slideshow rotates through:

1. Tracker View
2. Application Modal
3. Profile View
4. Filters & Sorting
5. Calendar View

Transitions should feel calm and understated.

## Animation

Preferred transition:

```css
transition:
  opacity 500ms ease,
  transform 500ms ease;
```

Avoid dramatic movement.

Motion should feel productivity-focused.

---

# 10. Screenshot Treatment

Hero screenshots should appear as believable captures of the actual application.

## Screenshot Card Style

```css
background: #ffffff;
border: 1px solid rgba(255,255,255,.08);
border-radius: 16px;
box-shadow:
  0 20px 60px rgba(0,0,0,.28),
  0 4px 18px rgba(0,0,0,.18);
overflow: hidden;
```

## Rotation

Primary card:

```css
transform: rotate(-2deg);
```

Secondary cards:

```css
transform: rotate(1.5deg);
```

Avoid exaggerated perspective transforms.

---

# 11. Decorative Elements

## Background Noise

Optional subtle texture:

```css
opacity: .035;
mix-blend-mode: soft-light;
```

## Floating Metadata Pills

Optional examples:

```text
24 Active
+12 This Month
78% Match
```

### Style

```css
background: rgba(255,255,255,.08);
backdrop-filter: blur(8px);
border: 1px solid rgba(255,255,255,.12);
```

These should remain sparse and understated.

### Illustrative Disclaimer

The pills display fixed sample values and do not reflect any real user data.
Render a small disclaimer anchored to the bottom-right of the hero slab so
visitors do not mistake the numbers for live metrics.

```text
Sample data — illustrative only
```

### Disclaimer Specs

| Property | Value |
|---|---|
| Font | DM Mono |
| Size | 10px |
| Color | `rgba(255,255,255,.45)` |
| Position | absolute, bottom-right of hero slab, 16px from each edge |
| Letter spacing | 0.04em |

The disclaimer should remain quiet — present enough to disambiguate, never
prominent enough to compete with the hero visual.

---

# 11b. Auth Overlay (Login & Signup)

## Form Factor

A centered modal at every breakpoint — desktop, tablet, and mobile alike.
A separate bottom-sheet variant was considered for mobile but rejected for
implementation complexity; a well-sized centered modal handles the two-field
login and signup forms comfortably on small screens.

## Sizing

| Breakpoint | Width | Vertical anchor |
|---|---|---|
| Desktop (`≥1100px`) | `440px` | Centered |
| Tablet (`760–1100px`) | `420px` | Centered |
| Mobile (`<760px`) | `min(92vw, 380px)` | Vertically centered with `16px` floor from viewport edges |

## Shell

```css
background: var(--surface);
border-radius: var(--r-lg);
box-shadow: var(--shadow-lg);
padding: 28px;
```

## Backdrop

```css
background: rgba(26, 26, 46, 0.36);
backdrop-filter: blur(2px);
```

## Behavior

- Focus is trapped inside the overlay while open.
- ESC, backdrop click, and the close button each dismiss the overlay.
- Switching between Login and Signup tabs preserves the entered email value.
- Submit button is disabled while the request is in flight.
- A single inline error region announces failures via `aria-live="polite"`.

## Motion

A subtle fade + 6px translate-up entrance, 200ms ease.
Disabled when `prefers-reduced-motion: reduce` is active.

## Tabs

A two-state tab strip at the top of the overlay switches between Login and
Signup. The active tab uses `var(--indigo)` underline; inactive tabs are
muted `var(--t2)`.

## Verification-Sent State

After a successful signup, the form is replaced inside the same overlay by
a verification-sent confirmation: a short message inviting the user to check
their email, plus a "Done" button that closes the overlay. The overlay does
not unmount during this transition.

---

# 12. Color Usage

## Primary Palette

| Token | Value |
|---|---|
| `--navy` | `#1A1A2E` |
| `--indigo` | `#4F46E5` |
| `--bg` | `#F4F1ED` |
| `--surface` | `#FFFFFF` |
| `--border` | `#E8E3DA` |

## Hero Background Structure

```css
background:
  radial-gradient(circle at top right, rgba(79,70,229,.18), transparent 40%),
  radial-gradient(circle at bottom left, rgba(255,255,255,.04), transparent 30%),
  #1A1A2E;
```

The slab should feel dimensional without becoming colorful.

---

# 13. Footer Metadata

Small metadata row below the CTA group.

Example:

```text
Built with Vite · Supabase · Vercel
```

### Specs

| Property | Value |
|---|---|
| Font | DM Mono |
| Size | 11px |
| Color | `var(--t3)` |
| Margin Top | `28px` |

Should feel quiet and secondary.

---

# 14. Motion Philosophy

Motion should feel:

- Calm
- Intentional
- Utility-first
- Slightly premium
- Non-playful

Avoid:

- Bouncy animations
- Elastic movement
- Excessive parallax
- Flashy transitions
- Over-animated dashboards

---

# 15. Accessibility

## Contrast

All text should maintain WCAG AA contrast.

Especially:

- Navy surfaces
- Indigo buttons
- Floating metadata pills

## Reduced Motion

Animations should respect:

```css
@media (prefers-reduced-motion: reduce)
```

Reduced motion mode should:

- Disable slideshow movement
- Disable transform animations
- Keep transitions minimal

---

# 16. Implementation Notes

## Suggested Structure

```text
welcome/
 ├── WelcomePage
 ├── HeroSlideshow
 ├── HeroCard
 ├── CTAGroup
 ├── BrandBlock
 └── FloatingMeta
```

## Asset Strategy

Hero visuals should use:

- Real screenshots from the application
- Cropped UI sections
- Consistent warm background tones

Avoid placeholder SaaS mockups.

---

# 17. Overall Intent

The Welcome Experience should communicate:

> “This is a focused, thoughtfully-designed tool built by someone who actually understands how job tracking and delivery systems work.”

The page should feel:

- Believable
- Practical
- Organized
- Clean
- Intentionally designed