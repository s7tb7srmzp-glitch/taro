import { CardPickerPanel } from "./CardPickerPanel";
import { CARDS_BY_ID } from "../data/cards";
import type { ExtraCardFlow } from "../lib/types";

interface CallExtraFlowProps {
  flow: ExtraCardFlow;
  /** Cards already on the table (spread + earlier extras), so the picker greys them out. */
  usedCardIds: Set<string>;
  onEdit: (patch: Partial<Pick<ExtraCardFlow, "question" | "count">>) => void;
  /** Start (or resume) picking cards. */
  onPickStart: () => void;
  onPick: (cardId: string) => void;
  onPickCancel: () => void;
  onRemoveCard: (index: number) => void;
  onInterpret: () => void;
  /** "추가 카드 없이 계속": ends the proposal without drawing. */
  onSkip: () => void;
}

const STATUS_TEXT: Record<ExtraCardFlow["status"], string> = {
  proposed: "AI가 추가 카드를 제안했어요. 내담자가 원하면 카드를 뽑아주세요.",
  accepted: "내담자가 추가 카드를 원해요. 카드를 뽑아주세요.",
  selecting: "카드를 고르는 중이에요.",
  selected: "카드를 다 골랐어요. 이 질문으로 해석해요.",
  interpreting: "추가 카드를 해석하는 중이에요…",
};

/**
 * The extra-card proposal under the script: the question the cards will answer, how many to draw,
 * and the buttons that turn a proposal into an actual card draw.
 */
export function CallExtraFlow({
  flow,
  usedCardIds,
  onEdit,
  onPickStart,
  onPick,
  onPickCancel,
  onRemoveCard,
  onInterpret,
  onSkip,
}: CallExtraFlowProps) {
  const busy = flow.status === "interpreting";
  const picked = flow.cardIds.length;
  const remaining = flow.count - picked;
  const hasQuestion = flow.question.trim().length > 0;
  const editable = flow.status === "proposed" || flow.status === "accepted" || (flow.status === "selected" && !!flow.error);
  const pickerUsed = new Set([...usedCardIds, ...flow.cardIds]);

  return (
    <section className={`call-extra-flow call-extra-flow--${flow.status}`} aria-label="추가 카드 제안">
      <div className="call-extra-flow__head">
        <h3>🃏 {flow.source === "ai" ? "추가 카드 제안" : "추가 카드 뽑기"}</h3>
        {flow.acceptedBy === "remark" && <span className="call-extra-flow__badge">내담자 수락</span>}
      </div>
      <p className="call-extra-flow__status">{STATUS_TEXT[flow.status]}</p>

      <label className="call-extra-flow__field">
        <span>추가 카드로 확인할 질문</span>
        {editable ? (
          <textarea
            className="call-extra-flow__question"
            rows={2}
            value={flow.question}
            placeholder="예) 그 사람이 이번 달 안에 먼저 연락할까요?"
            onChange={(e) => onEdit({ question: e.target.value })}
          />
        ) : (
          <p className="call-extra-flow__question-text">{flow.question}</p>
        )}
      </label>

      {flow.purpose && <p className="call-extra-flow__purpose">목적 · {flow.purpose}</p>}

      <div className="call-extra-flow__count">
        <span>카드 수</span>
        {editable && picked === 0 ? (
          <div className="call-chips" role="group" aria-label="추가 카드 수">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={flow.count === n}
                className={`call-chip${flow.count === n ? " call-chip--on" : ""}`}
                onClick={() => onEdit({ count: n })}
              >
                {n}장
              </button>
            ))}
          </div>
        ) : (
          <strong>
            {picked}/{flow.count}장
          </strong>
        )}
        {flow.spread && <span className="call-extra-flow__spread">{flow.spread}</span>}
      </div>

      {picked > 0 && (
        <ul className="call-extra-flow__cards">
          {flow.cardIds.map((id, i) => (
            <li key={id} data-extra-card-id={id}>
              <span>{CARDS_BY_ID[id]?.nameKo ?? id}</span>
              {!busy && (
                <button type="button" aria-label={`${CARDS_BY_ID[id]?.nameKo ?? id} 빼기`} onClick={() => onRemoveCard(i)}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {busy && (
        <div className="call-loading" role="status">
          <span className="call-spinner" aria-hidden="true" />
          <span>추가 카드를 질문에 맞춰 해석하는 중이에요… 보통 10~30초 걸려요.</span>
        </div>
      )}

      {flow.error && !busy && (
        <div className="call-error" role="alert">
          <p>{flow.error}</p>
          <p className="call-extra-flow__hint">뽑은 카드는 그대로 남아 있어요.</p>
        </div>
      )}

      {!busy && (
        <div className="call-extra-flow__actions no-print">
          {remaining > 0 && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onPickStart}
              disabled={!hasQuestion || flow.status === "selecting"}
            >
              {picked === 0 ? (flow.count > 1 ? `카드 ${flow.count}장 뽑기` : "카드 뽑기") : `이어서 뽑기 (${picked}/${flow.count})`}
            </button>
          )}
          {picked > 0 && (
            <button
              type="button"
              className={remaining > 0 ? "btn" : "btn btn--primary"}
              onClick={onInterpret}
              disabled={!hasQuestion}
            >
              {flow.error ? "다시 해석하기" : remaining > 0 ? "뽑은 카드로 해석" : "해석하기"}
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onSkip}>
            추가 카드 없이 계속
          </button>
        </div>
      )}
      {!hasQuestion && !busy && <p className="call-extra-flow__hint">질문을 적어야 카드를 뽑을 수 있어요.</p>}

      {flow.status === "selecting" && (
        <CardPickerPanel
          slotLabel={`추가 카드 ${picked + 1}/${flow.count}`}
          slotHint={flow.question}
          usedCardIds={pickerUsed}
          onPick={onPick}
          onClear={() => {}}
          onClose={onPickCancel}
        />
      )}
    </section>
  );
}
