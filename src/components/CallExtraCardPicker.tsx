import { useState } from "react";
import { CardPickerPanel } from "./CardPickerPanel";

interface CallExtraCardPickerProps {
  usedCardIds: Set<string>;
  onAdd: (cardId: string, label: string) => Promise<void>;
}

export function CallExtraCardPicker({ usedCardIds, onAdd }: CallExtraCardPickerProps) {
  const [picking, setPicking] = useState(false);
  const [pickedCardId, setPickedCardId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPicking(false);
    setPickedCardId(null);
    setLabel("");
    setError(null);
  }

  async function handleConfirm() {
    if (!pickedCardId || !label.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onAdd(pickedCardId, label.trim());
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "카드 연결 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="call-extra-card no-print">
      <button type="button" className="btn btn--ghost" onClick={() => setPicking(true)}>
        🃏 카드 추가 뽑기
      </button>

      {picking && !pickedCardId && (
        <CardPickerPanel
          slotLabel="추가로 뽑을 카드"
          usedCardIds={usedCardIds}
          onPick={(cardId) => setPickedCardId(cardId)}
          onClear={() => {}}
          onClose={reset}
        />
      )}

      {pickedCardId && (
        <div className="call-extra-card__label-overlay" onClick={reset}>
          <div className="call-extra-card__label-panel" onClick={(e) => e.stopPropagation()}>
            <p className="call-extra-card__label-title">왜 이 카드를 뽑았나요?</p>
            <textarea
              placeholder="예) 다음 달은 어떻게 될까요?"
              rows={2}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
            <div className="call-extra-card__label-actions">
              <button type="button" className="btn btn--ghost" onClick={reset}>
                취소
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleConfirm}
                disabled={loading || !label.trim()}
              >
                {loading ? "연결 중…" : "해석에 연결"}
              </button>
            </div>
            {error && <p className="interpretation-panel__error">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
