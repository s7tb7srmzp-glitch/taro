import { useState } from "react";
import type { Arcana } from "../data/cards";
import { ALL_CARDS } from "../data/cards";
import { CardFace } from "./CardFace";

const TABS: { key: Arcana; label: string }[] = [
  { key: "major", label: "메이저" },
  { key: "court", label: "코트 카드" },
  { key: "pip", label: "핍 카드" },
];

interface CardPickerPanelProps {
  slotLabel: string;
  slotHint?: string;
  usedCardIds: Set<string>;
  currentCardId?: string;
  onPick: (cardId: string) => void;
  onClear: () => void;
  onClose: () => void;
}

export function CardPickerPanel({
  slotLabel,
  slotHint,
  usedCardIds,
  currentCardId,
  onPick,
  onClear,
  onClose,
}: CardPickerPanelProps) {
  const [tab, setTab] = useState<Arcana>("major");
  const cards = ALL_CARDS.filter((c) => c.arcana === tab);

  return (
    <div className="card-picker-overlay" onClick={onClose}>
      <div className="card-picker" onClick={(e) => e.stopPropagation()}>
        <div className="card-picker__header">
          <div>
            <div className="card-picker__slot">{slotLabel}</div>
            {slotHint && <div className="card-picker__hint">{slotHint}</div>}
          </div>
          <div className="card-picker__header-actions">
            {currentCardId && (
              <button type="button" className="btn btn--ghost" onClick={onClear}>
                비우기
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>

        <div className="card-picker__tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`card-picker__tab${tab === t.key ? " card-picker__tab--active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="card-picker__grid">
          {cards.map((card) => {
            const isUsedElsewhere = usedCardIds.has(card.id) && card.id !== currentCardId;
            const isCurrent = card.id === currentCardId;
            return (
              <button
                key={card.id}
                type="button"
                disabled={isUsedElsewhere}
                className={`card-picker__cell${isCurrent ? " card-picker__cell--current" : ""}${
                  isUsedElsewhere ? " card-picker__cell--used" : ""
                }`}
                onClick={() => onPick(card.id)}
                title={card.nameKo}
              >
                <CardFace card={card} size="sm" />
                <span className="card-picker__cell-name">{card.nameKo}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
