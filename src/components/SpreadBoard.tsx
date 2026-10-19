import type { CSSProperties } from "react";
import type { SpreadTemplate } from "../data/spreads";
import { CARDS_BY_ID } from "../data/cards";
import { getSpreadLayout } from "../lib/spreadLayout";
import { CardFace } from "./CardFace";

interface SpreadBoardProps {
  spread: SpreadTemplate;
  placements: Record<string, string>;
  onSlotClick: (positionId: string) => void;
}

const cq = (n: number) => `${n.toFixed(3)}cqw`;

export function SpreadBoard({ spread, placements, onSlotClick }: SpreadBoardProps) {
  const layout = getSpreadLayout(spread);

  return (
    <div className="spread-board">
      <div
        className="spread-board__stage"
        style={{ aspectRatio: `100 / ${layout.boardH.toFixed(3)}`, "--label-font": layout.labelFont } as CSSProperties}
      >
        <div className="spread-board__cloth" />
        {layout.slots.map((slot) => {
          const cardId = placements[slot.id];
          const card = cardId ? CARDS_BY_ID[cardId] : undefined;
          const boxLeft = slot.cx - layout.cardW / 2;
          const boxTop = slot.cy - layout.cardH / 2;
          return (
            <button
              key={slot.id}
              type="button"
              className="spread-slot"
              aria-label={`${slot.label}${card ? `: ${card.nameKo}` : " (비어 있음)"}`}
              style={{
                left: `${((slot.cx / 100) * 100).toFixed(3)}%`,
                top: `${((slot.cy / layout.boardH) * 100).toFixed(3)}%`,
                width: cq(layout.cardW),
                height: cq(layout.cardH),
              }}
              onClick={() => onSlotClick(slot.id)}
            >
              <span className="spread-slot__card" style={{ transform: `rotate(${slot.rotation}deg)` }}>
                {card ? (
                  <CardFace card={card} size="lg" />
                ) : (
                  <span className="spread-slot__empty">
                    <span>+</span>
                  </span>
                )}
              </span>
              <span
                className="spread-slot__label"
                style={{
                  left: cq(slot.labelX - boxLeft),
                  ...(slot.labelBottom === null
                    ? { top: cq(slot.labelY - boxTop) }
                    : { bottom: cq(slot.labelBottom) }),
                  width: cq(slot.labelW),
                }}
              >
                {slot.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
