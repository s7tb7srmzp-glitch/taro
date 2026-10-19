import type { SpreadTemplate } from "../data/spreads";
import { INTENDED_OVERLAPS, LABEL_ABOVE, shortLabel } from "../data/spreadLabels";

/** width / height of every card image (the real card art is ~1115 x 1920). */
export const CARD_RATIO = 0.58;

/**
 * All sizes below are in "board units": the board is 100 units wide, so they map straight onto
 * CSS `cqw` and the layout scales with the board without any pixel math in the browser.
 */
const LABEL_FONT = 3.4;
const LABEL_LINE = 1.25;
const GAP = 1.2;
const MARGIN = 2;
const CLEARANCE = 0.8;
const MAX_STRETCH = 3.6;

export interface SlotLayout {
  id: string;
  label: string;
  /** Card center, in board units. */
  cx: number;
  cy: number;
  rotation: number;
  /** Label box, in board units. */
  labelX: number;
  labelY: number;
  labelW: number;
  labelH: number;
  /** For labels above their card: distance from the card box bottom to the label bottom edge. */
  labelBottom: number | null;
}

export interface SpreadLayout {
  cardW: number;
  cardH: number;
  boardH: number;
  labelFont: number;
  slots: SlotLayout[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  slot: string;
  kind: "card" | "label";
}

/** Rough text width in em: Hangul and capitals are wide, digits/spaces/punctuation narrower. */
function textWidthEm(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (/[가-힣]/.test(ch)) w += 1;
    else if (/[A-Z]/.test(ch)) w += 0.7;
    else if (/[0-9a-z]/.test(ch)) w += 0.55;
    else if (ch === " ") w += 0.3;
    else w += 0.4;
  }
  return w;
}

function targetCardWidth(count: number): number {
  if (count <= 1) return 22;
  if (count <= 3) return 20;
  if (count <= 5) return 17;
  if (count <= 7) return 15;
  if (count <= 10) return 14;
  return 13;
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w + CLEARANCE &&
    b.x < a.x + a.w + CLEARANCE &&
    a.y < b.y + b.h + CLEARANCE &&
    b.y < a.y + a.h + CLEARANCE
  );
}

function build(spread: SpreadTemplate, cardW: number, stretch: number): { layout: SpreadLayout; rects: Rect[] } {
  const cardH = cardW / CARD_RATIO;
  const above = new Set(LABEL_ABOVE[spread.id] ?? []);

  const items = spread.positions.map((p) => {
    const rotated = Math.abs((p.rotation ?? 0) % 180) === 90;
    const visW = rotated ? cardH : cardW;
    const visH = rotated ? cardW : cardH;
    const label = `${shortLabel(spread.id, p.id, p.label)}${p.optional ? " (선택)" : ""}`;
    const naturalW = textWidthEm(label) * LABEL_FONT;
    const maxW = Math.max(cardW * 1.5, 14);
    const labelW = Math.min(naturalW + 1, maxW);
    const lines = Math.min(3, Math.max(1, Math.ceil((naturalW + 1) / maxW)));
    const labelH = lines * LABEL_FONT * LABEL_LINE;
    return { p, rotated, visW, visH, label, labelW, labelH, isAbove: above.has(p.id) };
  });

  const halfW = Math.max(...items.map((i) => Math.max(i.visW, i.labelW) / 2));
  const topExt = Math.max(...items.map((i) => i.visH / 2 + (i.isAbove ? GAP + i.labelH : 0)));
  const bottomExt = Math.max(...items.map((i) => i.visH / 2 + (i.isAbove ? 0 : GAP + i.labelH)));

  const lo = MARGIN + halfW;
  const innerW = 100 - 2 * MARGIN - 2 * halfW;
  const innerH = (innerW / spread.boardAspect) * stretch;
  const boardH = MARGIN * 2 + topExt + innerH + bottomExt;

  const rects: Rect[] = [];
  const slots: SlotLayout[] = items.map((i) => {
    const cx = lo + (i.p.x / 100) * innerW;
    const cy = MARGIN + topExt + (i.p.y / 100) * innerH;
    const labelY = i.isAbove ? cy - i.visH / 2 - GAP - i.labelH : cy + i.visH / 2 + GAP;
    const labelX = cx - i.labelW / 2;
    rects.push({ x: cx - i.visW / 2, y: cy - i.visH / 2, w: i.visW, h: i.visH, slot: i.p.id, kind: "card" });
    rects.push({ x: labelX, y: labelY, w: i.labelW, h: i.labelH, slot: i.p.id, kind: "label" });
    return {
      id: i.p.id,
      label: i.label,
      cx,
      cy,
      rotation: i.p.rotation ?? 0,
      labelX,
      labelY,
      labelW: i.labelW,
      labelH: i.labelH,
      labelBottom: i.isAbove ? cardH / 2 + i.visH / 2 + GAP : null,
    };
  });

  return { layout: { cardW, cardH, boardH, labelFont: LABEL_FONT, slots }, rects };
}

function isValid(spread: SpreadTemplate, rects: Rect[]): boolean {
  const allowed = INTENDED_OVERLAPS[spread.id] ?? [];
  const isAllowed = (a: Rect, b: Rect) =>
    a.kind === "card" &&
    b.kind === "card" &&
    allowed.some(([p, q]) => (a.slot === p && b.slot === q) || (a.slot === q && b.slot === p));

  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (a.slot === b.slot) continue;
      if (intersects(a, b) && !isAllowed(a, b)) return false;
    }
  }
  return true;
}

const cache = new Map<string, SpreadLayout>();

/**
 * Picks the largest card size (up to a per-spread target) for which no card or label collides,
 * stretching the board vertically when a dense spread needs more room.
 */
export function getSpreadLayout(spread: SpreadTemplate): SpreadLayout {
  const cached = cache.get(spread.id);
  if (cached) return cached;

  let fallback: SpreadLayout | null = null;
  for (let cardW = targetCardWidth(spread.positions.length); cardW >= 7; cardW -= 0.5) {
    for (let stretch = 1; stretch <= MAX_STRETCH + 1e-9; stretch += 0.05) {
      const { layout, rects } = build(spread, cardW, stretch);
      fallback = layout;
      if (isValid(spread, rects)) {
        cache.set(spread.id, layout);
        return layout;
      }
    }
  }
  cache.set(spread.id, fallback!);
  return fallback!;
}
