import { SPREADS_BY_ID } from "../data/spreads";
import type { ExtraCardFlow, ExtraFlowStatus } from "./types";

/** Cards still needed before the flow can be read (required positions for a new spread). */
export function flowMissingSlots(flow: ExtraCardFlow): number {
  if (flow.kind === "spread") {
    const spread = flow.spreadId ? SPREADS_BY_ID[flow.spreadId] : undefined;
    if (!spread) return 1;
    const placements = flow.placements ?? {};
    return spread.positions.filter((p) => !p.optional && !placements[p.id]).length;
  }
  return Math.max(0, flow.count - flow.cardIds.length);
}

export function flowHasCards(flow: ExtraCardFlow): boolean {
  return flow.kind === "spread" ? Object.keys(flow.placements ?? {}).length > 0 : flow.cardIds.length > 0;
}

/** The resting status after an edit: an untouched proposal stays proposed, otherwise selected once complete. */
export function settledStatus(flow: ExtraCardFlow): ExtraFlowStatus {
  if (flow.status === "proposed" && !flowHasCards(flow)) return "proposed";
  if (!flow.kind) return flow.status === "proposed" ? "proposed" : "accepted";
  return flowMissingSlots(flow) === 0 ? "selected" : "accepted";
}
