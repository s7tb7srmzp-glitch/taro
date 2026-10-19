import { useEffect, useRef, useState } from "react";
import type { Arcana, Suit } from "../data/cards";
import { ALL_CARDS } from "../data/cards";
import { CardFace } from "./CardFace";

const TABS: { key: Arcana; label: string }[] = [
  { key: "major", label: "메이저" },
  { key: "court", label: "코트 카드" },
  { key: "pip", label: "핍 카드" },
];

const SUIT_BUTTONS: { key: Suit; label: string }[] = [
  { key: "wands", label: "완드" },
  { key: "cups", label: "컵" },
  { key: "swords", label: "소드" },
  { key: "pentacles", label: "펜타클" },
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
  const [suit, setSuit] = useState<Suit>("wands");
  const gridRef = useRef<HTMLDivElement>(null);

  const cards = ALL_CARDS.filter((c) => c.arcana === tab && (tab !== "pip" || c.suit === suit)).sort(
    (a, b) => (tab === "pip" ? (a.number ?? 0) - (b.number ?? 0) : 0),
  );

  useEffect(() => {
    gridRef.current?.scrollTo({ top: 0 });
  }, [tab, suit]);

  return (
    <div className="card-picker-overlay" onClick={onClose}>
      <div className="card-picker" role="dialog" aria-label="카드 선택" onClick={(e) => e.stopPropagation()}>
        <div className="card-picker__header">
          <div className="card-picker__title">
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

        <div className="card-picker__tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`card-picker__tab${tab === t.key ? " card-picker__tab--active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "pip" && (
          <div className="card-picker__suits" role="tablist" aria-label="슈트">
            {SUIT_BUTTONS.map((s) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={suit === s.key}
                className={`card-picker__suit${suit === s.key ? " card-picker__suit--active" : ""}`}
                onClick={() => setSuit(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div ref={gridRef} className={`card-picker__grid card-picker__grid--${tab}`}>
          {cards.map((card) => {
            const isUsedElsewhere = usedCardIds.has(card.id) && card.id !== currentCardId;
            const isCurrent = card.id === currentCardId;
            return (
              <button
                key={card.id}
                type="button"
                disabled={isUsedElsewhere}
                data-card-id={card.id}
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
