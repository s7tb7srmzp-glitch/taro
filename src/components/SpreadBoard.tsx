import type { SpreadTemplate } from "../data/spreads";
import { CARDS_BY_ID } from "../data/cards";
import { CardFace } from "./CardFace";

interface SpreadBoardProps {
  spread: SpreadTemplate;
  placements: Record<string, string>;
  onSlotClick: (positionId: string) => void;
}

/** Denser spreads use smaller cards so positions don't overlap. */
function cardSizeFor(positionCount: number): "sm" | "md" | "lg" {
  if (positionCount <= 3) return "lg";
  if (positionCount <= 4) return "md";
  return "sm";
}

export function SpreadBoard({ spread, placements, onSlotClick }: SpreadBoardProps) {
  const size = cardSizeFor(spread.positions.length);

  return (
    <div className="spread-board" style={{ aspectRatio: spread.boardAspect }}>
      <div className="spread-board__cloth" />
      {spread.positions.map((pos) => {
        const cardId = placements[pos.id];
        const card = cardId ? CARDS_BY_ID[cardId] : undefined;
        return (
          <button
            key={pos.id}
            type="button"
            className="spread-slot"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: `translate(-50%, -50%) rotate(${pos.rotation ?? 0}deg)`,
            }}
            onClick={() => onSlotClick(pos.id)}
          >
            {card ? (
              <CardFace card={card} size={size} />
            ) : (
              <div className={`spread-slot__empty spread-slot__empty--${size}`}>
                <span>+</span>
              </div>
            )}
            <span className="spread-slot__label" style={{ transform: `rotate(${-(pos.rotation ?? 0)}deg)` }}>
              {pos.label}
              {pos.optional ? " (선택)" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
