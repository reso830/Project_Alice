# Interface & Utility Contracts: Welcome Page & Brand Refresh

This document defines the interface and utility contracts introduced or modified in Feature 042.

---

## 1. Backend REST API Contract
- **New Endpoints**: None. This feature introduces no new API endpoints on the Express server or database routes.
- **Payload Changes**: None. Existing API contracts for application and profile updates remain unchanged.

---

## 2. Utility Registry Contract (`src/utils/icons.js`)

The line-icon utility registry defines programmatic exports consumed by UI cards, modals, toolbars, and forms.

### Export Schema

```javascript
/**
 * Multi-path aware SVG element factory.
 * @param {string|string[]} paths - SVG path data string or array of path data strings.
 * @returns {SVGElement} - Constructed SVG DOM node with system-wide classes and stroke attributes.
 */
export function createSvgIcon(paths);

/**
 * Convenience builder to retrieve standard icons by semantic name.
 * @param {string} name - Semantic name from ICON_PATHS keys.
 * @returns {SVGElement} - SVG DOM node.
 */
export function icon(name);

/**
 * Backwards compatibility shim for archive icon.
 * @returns {SVGElement} - Standard archive SVG node.
 */
export function createArchiveIcon();

/**
 * Backwards compatibility shim for URL clipboard icon (now links glyph).
 * @returns {SVGElement} - Standard link SVG node.
 */
export function createClipboardIcon();

/**
 * Registry of canonical path data strings.
 * @type {Object.<string, string[]>}
 */
export const ICON_PATHS = {
  edit:         ['...'],
  changeStatus: ['...'],
  copyUrl:      ['...'],
  star:         ['...'],
  archive:      ['...'],
  unarchive:    ['...'],
  close:        ['...'],
  status:       ['...'],
  salary:       ['...'],
  compatibility:['...'],
  company:      ['...'],
  shift:        ['...'],
  workSetup:    ['...'],
  location:     ['...'],
  sort:         ['...'],
};
```

---

## 3. UI Loader Render & Accessibility Contract

The in-app processing overlays (`ResumeImport.js` and `JobPostingImport.js`) must strictly conform to the following DOM and ARIA structure:

### Component DOM Structure
```html
<div class="processing-overlay" role="status" aria-live="polite" aria-busy="true">
  <!-- Edge Glow Overlay (Desktop only, ≥900px) -->
  <div class="edge-glow"></div>

  <!-- Center spinner group -->
  <div class="spinner-wrap">
    <!-- Center Sigil Image -->
    <img src="/src/assets/logo/alice-sigil-full.svg" class="spinner-logo" alt="" aria-hidden="true" />
    
    <!-- Rotating Gold Ring -->
    <svg class="spinner-ring" viewBox="0 0 76 76" aria-hidden="true">
      <circle class="ring-glow" cx="38" cy="38" r="33" stroke="#F4A71F" stroke-width="6" fill="none" stroke-dasharray="52 155" />
      <circle class="ring-core" cx="38" cy="38" r="33" stroke="#F4A71F" stroke-width="2" fill="none" stroke-dasharray="52 155" />
    </svg>
  </div>

  <!-- Status reporting copy -->
  <div class="processing-text">
    <h3 class="processing-title">Getting to know your background</h3>
    <p class="processing-subtitle">Alice is reading through your experience</p>
  </div>
</div>
```

### CSS Variables Custom Theme Tokens
CSS properties declared on `:root` to support layout alignment:

```css
:root {
  --navy: #1A1A2E;
  --navy-deep: #0E0E20;
  --indigo: #4F46E5;
  --indigo-hover: #4338CA;
  --gold: #F2B544;
  --warm: #F4F1ED;
  --surface: #FFFFFF;
}
```
