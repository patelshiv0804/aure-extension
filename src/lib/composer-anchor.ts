// ──────────────────────────────────────────────────────────────
// composer-anchor — Single source of truth for the floating capsules
//
// Both the EnhancedBadge (left: version / Re-enhance / dismiss) and the
// FloatingEnhanceButton (right: sliders / history / Enhance·Done) float
// just above the composer. If each computes its own container rect they
// drift apart — different element, different top, asymmetric insets.
//
// Everything anchors to the ONE rect returned here, using the SAME shared
// constants, so the two capsules stay aligned with each other AND sit
// symmetrically inside the composer's (text-area's) left/right borders.
// ──────────────────────────────────────────────────────────────

import type { SiteAdapter } from '@/types/adapter';

/** Capsule height (px). Both capsules share this so their tops/centers match. */
export const ANCHOR_HEIGHT = 36;
/** Vertical gap between a capsule's bottom and the composer's top border (px). */
export const ANCHOR_GAP = 6;
/** Symmetric horizontal inset from the composer's left/right border (px). */
export const ANCHOR_INSET = 8;
/** Keep capsules at least this far from the viewport edge so they never clip. */
const VIEWPORT_MARGIN = 8;

/** Elements that count as the composer / text-area surface, most-specific first. */
const COMPOSER_SELECTOR =
  'form, [data-composer-surface="true"], fieldset, div[class*="composer"]';

/**
 * Resolve the composer (text-area) bounding rect that the capsules anchor to.
 * BOTH floating components must call this — identical rect in, aligned
 * capsules out. Resolution order:
 *   1. The semantic composer wrapper via `.closest()`.
 *   2. Otherwise the first ancestor clearly wider than the input but not the
 *      whole viewport (single consistent threshold).
 *   3. Otherwise the input's own rect.
 */
export function getComposerRect(adapter: SiteAdapter): DOMRect | null {
  const input: HTMLElement | null =
    (adapter as any).currentInput ?? (adapter as any).detectInput?.() ?? null;

  // No input yet — fall back to whatever rect the adapter can provide.
  if (!input) {
    return adapter.getInputRect();
  }

  const inputRect = input.getBoundingClientRect();

  // 1. Preferred: the semantic composer wrapper (form / fieldset / composer div).
  const composer = input.closest(COMPOSER_SELECTOR) as HTMLElement | null;
  if (composer) {
    const rect = composer.getBoundingClientRect();
    if (rect.width > 0 && rect.width < window.innerWidth * 0.98) {
      return rect;
    }
  }

  // 2. Fallback: walk up to the first ancestor clearly wider than the input.
  let el: HTMLElement | null = input;
  for (let i = 0; i < 6 && el; i++) {
    const parent: HTMLElement | null = el.parentElement;
    if (parent) {
      const pRect = parent.getBoundingClientRect();
      if (
        pRect.width >= inputRect.width * 1.05 &&
        pRect.width < window.innerWidth * 0.95
      ) {
        return pRect;
      }
    }
    el = parent;
  }

  // 3. Last resort: the input itself.
  return inputRect;
}

/** Shared top coordinate — sits ANCHOR_GAP above the composer's top border. */
export function getAnchorTop(rect: DOMRect): number {
  return Math.max(VIEWPORT_MARGIN, rect.top - ANCHOR_GAP - ANCHOR_HEIGHT);
}

/**
 * Left-anchored capsule (EnhancedBadge): inset from the composer's LEFT border.
 */
export function getLeftAnchor(rect: DOMRect): { top: number; left: number } {
  return {
    top: getAnchorTop(rect),
    left: Math.max(VIEWPORT_MARGIN, rect.left + ANCHOR_INSET),
  };
}

/**
 * Right-anchored capsule (FloatingEnhanceButton): inset from the composer's
 * RIGHT border. `width` is the capsule's current width, so the right edge stays
 * pinned to `rect.right - ANCHOR_INSET` even as the capsule grows/shrinks.
 */
export function getRightAnchor(
  rect: DOMRect,
  width: number,
): { top: number; left: number } {
  const left = rect.right - ANCHOR_INSET - width;
  return {
    top: getAnchorTop(rect),
    left: Math.min(
      window.innerWidth - width - VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, left),
    ),
  };
}
