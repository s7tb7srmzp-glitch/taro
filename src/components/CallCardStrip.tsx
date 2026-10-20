import { useState } from "react";
import type { SpreadTemplate } from "../data/spreads";
import { CARDS_BY_ID } from "../data/cards";
import { shortLabel } from "../data/spreadLabels";
import type { CallExtraCard } from "../lib/types";
import { CardFace } from "./CardFace";
import { SpreadBoard } from "./SpreadBoard";

interface CallCardStripProps {
  spread: SpreadTemplate;
  placements: Record<string, string>;
  extraCards: CallExtraCard[];
  /** Omit for a read-only strip (e.g. a past follow-up reading). */
  onSlotClick?: (positionId: string) => void;
  title?: string;
}

export function CallCardStrip({ spread, placements, extraCards, onSlotClick, title = "카드 배열" }: CallCardStripProps) {
  const [expanded, setExpanded] = useState(false);
  const placed = spread.positions.filter((p) => placements[p.id]);

  const extraItems = extraCards.map((x) => {
    const card = CARDS_BY_ID[x.cardId];
    return (
      <li key={x.id} className="call-card-strip__item call-card-strip__item--extra">
        {card && <CardFace card={card} size="sm" />}
        <span className="call-card-strip__pos">추가 · {x.label}</span>
        <span className="call-card-strip__name">{card?.nameKo}</span>
      </li>
    );
  });

  return (
    <div className="call-card-strip">
      <div className="call-card-strip__header">
        <span className="call-card-strip__title">
          {title} · {spread.name}
        </span>
        <button type="button" className="btn btn--ghost call-card-strip__toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "접기" : "크게 보기"}
        </button>
      </div>

      {expanded ? (
        <>
          <SpreadBoard spread={spread} placements={placements} onSlotClick={onSlotClick ?? (() => {})} />
          {onSlotClick && <p className="call-card-strip__note">카드를 바꾸면 대본을 다시 생성해주세요.</p>}
          {extraItems.length > 0 && <ul className="call-card-strip__list">{extraItems}</ul>}
        </>
      ) : (
        <ul className="call-card-strip__list">
          {placed.map((p) => {
            const card = CARDS_BY_ID[placements[p.id]];
            return (
              <li key={p.id} className="call-card-strip__item">
                {card && <CardFace card={card} size="sm" />}
                <span className="call-card-strip__pos">
                  {p.weight === 3 ? "★ " : ""}
                  {shortLabel(spread.id, p.id, p.label)}
                </span>
                <span className="call-card-strip__name">{card?.nameKo}</span>
              </li>
            );
          })}
          {extraItems}
        </ul>
      )}
    </div>
  );
}
