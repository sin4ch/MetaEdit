/**
 * OA design system canonical springs.
 * Seven named springs cover the entire product.
 */

export const PANEL = { type: "spring", stiffness: 550, damping: 38 } as const;
export const LAYOUT = { type: "spring", stiffness: 550, damping: 40 } as const;
export const POP = { type: "spring", stiffness: 400, damping: 26 } as const;
export const POP_EXIT = { type: "spring", stiffness: 380, damping: 28 } as const;
export const BANNER = { type: "spring", stiffness: 400, damping: 30 } as const;
export const FLICK = { type: "spring", stiffness: 900, damping: 50 } as const;
export const CHART = { type: "spring", stiffness: 300, damping: 28 } as const;
