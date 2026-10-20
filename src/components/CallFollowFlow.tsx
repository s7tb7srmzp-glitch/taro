import { useState } from "react";
import { CardPickerPanel } from "./CardPickerPanel";
import { SpreadBoard } from "./SpreadBoard";
import { SpreadPicker } from "./SpreadPicker";
import { CARDS_BY_ID } from "../data/cards";
import { SPREADS_BY_ID } from "../data/spreads";
import type { ExtraCardFlow, FollowReadingKind } from "../lib/types";
import { flowMissingSlots } from "../lib/followReading";

interface CallFollowFlowProps {
  flow: ExtraCardFlow;
  /** Cards already on the table (spread + earlier supplements), greyed out for supplement picks. */
  usedCardIds: Set<string>;
  onEdit: (patch: Partial<Pick<ExtraCardFlow, "question" | "count" | "kind">>) => void;
  onSelectSpread: (spreadId: string) => void;
  /** Supplement: start (or resume) picking cards. */
  onPickStart: () => void;
  /** New spread: open the picker for one position. */
  onSlotClick: (positionId: string) => void;
  onPick: (cardId: string) => void;
  onClearSlot: () => void;
  onPickCancel: () => void;
  onRemoveCard: (index: number) => void;
  onInterpret: () => void;
  /** "후속 리딩 없이 계속": ends the proposal without drawing. */
  onSkip: () => void;
}

const KIND_TEXT: Record<FollowReadingKind, { title: string; desc: string }> = {
  supplement: { title: "보충 카드", desc: "기존 리딩의 특정 부분을 1~2장으로 보완" },
  spread: { title: "새 스프레드", desc: "새 질문에 맞춰 등록된 배열을 새로 펼치기" },
};

function statusText(flow: ExtraCardFlow): string {
  if (!flow.kind) return "어떤 방식으로 이어서 볼지 골라주세요.";
  switch (flow.status) {
    case "proposed":
      return "AI가 후속 리딩을 제안했어요. 내담자가 원하면 진행해주세요.";
    case "accepted":
      return flow.kind === "spread" ? "질문을 확인하고 스프레드를 골라 카드를 놓아주세요." : "질문을 확인하고 카드를 뽑아주세요.";
    case "selecting":
      return "카드를 고르는 중이에요.";
    case "selected":
      return "카드를 다 골랐어요. 이 질문으로 해석해요.";
    case "interpreting":
      return "후속 리딩을 해석하는 중이에요…";
  }
}

/**
 * The follow-up reading panel under the script: pick a type (supplement cards or a new spread),
 * confirm the question, choose a count or a spread, place the cards, then interpret.
 */
export function CallFollowFlow({
  flow,
  usedCardIds,
  onEdit,
  onSelectSpread,
  onPickStart,
  onSlotClick,
  onPick,
  onClearSlot,
  onPickCancel,
  onRemoveCard,
  onInterpret,
  onSkip,
}: CallFollowFlowProps) {
  const [changingSpread, setChangingSpread] = useState(false);
  const busy = flow.status === "interpreting";
  const locked = busy || flow.status === "selecting";
  const hasQuestion = flow.question.trim().length > 0;
  const spread = flow.spreadId ? SPREADS_BY_ID[flow.spreadId] : undefined;
  const placements = flow.placements ?? {};
  const placedCount = Object.keys(placements).length;
  const missing = flowMissingSlots(flow);
  const picked = flow.cardIds.length;
  const remaining = flow.count - picked;
  const activePosition = spread?.positions.find((p) => p.id === flow.activeSlotId);

  function chooseSpread(id: string) {
    setChangingSpread(false);
    onSelectSpread(id);
  }

  return (
    <section className={`call-extra-flow call-extra-flow--${flow.status}`} aria-label="후속 리딩">
      <div className="call-extra-flow__head">
        <h3>🔮 {flow.source === "ai" ? "후속 리딩 제안" : "후속 리딩"}</h3>
        {flow.acceptedBy === "remark" && <span className="call-extra-flow__badge">내담자 수락</span>}
      </div>
      <p className="call-extra-flow__status">{statusText(flow)}</p>

      {/* 1. type */}
      <div className="call-follow-kind" role="radiogroup" aria-label="후속 리딩 유형">
        {(Object.keys(KIND_TEXT) as FollowReadingKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={flow.kind === k}
            className={`call-follow-kind__option${flow.kind === k ? " call-follow-kind__option--on" : ""}`}
            onClick={() => onEdit({ kind: k })}
            disabled={locked}
          >
            <span className="call-follow-kind__title">
              {KIND_TEXT[k].title}
              {flow.suggestedKind === k && <span className="call-follow-kind__ai">AI 추천</span>}
            </span>
            <span className="call-follow-kind__desc">{KIND_TEXT[k].desc}</span>
          </button>
        ))}
      </div>

      {flow.kind && (
        <>
          {/* 2. question */}
          <label className="call-extra-flow__field">
            <span>{flow.kind === "spread" ? "새 스프레드로 볼 후속 질문" : "보충 카드를 뽑는 목적이나 질문"}</span>
            {locked ? (
              <p className="call-extra-flow__question-text">{flow.question}</p>
            ) : (
              <textarea
                className="call-extra-flow__question"
                rows={2}
                value={flow.question}
                placeholder="예) 그 사람이 이번 달 안에 먼저 연락할까요?"
                onChange={(e) => onEdit({ question: e.target.value })}
              />
            )}
          </label>
          {flow.purpose && <p className="call-extra-flow__purpose">목적 · {flow.purpose}</p>}

          {/* 3. count / spread */}
          {flow.kind === "supplement" ? (
            <div className="call-extra-flow__count">
              <span>카드 수</span>
              {!locked && picked === 0 ? (
                <div className="call-chips" role="group" aria-label="보충 카드 수">
                  {[1, 2].map((n) => (
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
            </div>
          ) : !hasQuestion ? (
            <p className="call-extra-flow__hint">질문을 먼저 적으면 스프레드를 고를 수 있어요.</p>
          ) : spread && !changingSpread ? (
            <div className="call-extra-flow__count">
              <span>스프레드</span>
              <strong className="call-follow-spread__name">
                {spread.name} · {spread.positions.length}장
              </strong>
              {!locked && (
                <button type="button" className="btn btn--ghost call-follow-spread__change" onClick={() => setChangingSpread(true)}>
                  스프레드 변경
                </button>
              )}
            </div>
          ) : (
            <div className="call-follow-spread__picker">
              <p className="call-extra-flow__hint">
                {placedCount > 0 ? "다른 스프레드를 고르면 지금 놓은 카드는 비워져요." : "펼칠 스프레드를 골라주세요."}
                {flow.suggestedKind === "spread" && flow.spread && ` (AI 추천: ${flow.spread})`}
              </p>
              <SpreadPicker selectedId={flow.spreadId ?? null} onSelect={chooseSpread} />
              {spread && (
                <button type="button" className="btn btn--ghost" onClick={() => setChangingSpread(false)}>
                  {spread.name} 그대로 두기
                </button>
              )}
            </div>
          )}

          {/* 4. cards */}
          {flow.kind === "supplement" && picked > 0 && (
            <ul className="call-extra-flow__cards">
              {flow.cardIds.map((id, i) => (
                <li key={id} data-extra-card-id={id}>
                  <span>{CARDS_BY_ID[id]?.nameKo ?? id}</span>
                  {!locked && (
                    <button type="button" aria-label={`${CARDS_BY_ID[id]?.nameKo ?? id} 빼기`} onClick={() => onRemoveCard(i)}>
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {flow.kind === "spread" && spread && hasQuestion && !changingSpread && (
            <div className="call-follow-spread">
              <SpreadBoard spread={spread} placements={placements} onSlotClick={(id) => !locked && onSlotClick(id)} />
              <p className="call-extra-flow__hint">
                {missing > 0 ? `자리를 눌러 카드를 놓아주세요 · ${missing}자리 남았어요.` : "모든 자리에 카드를 놓았어요."}
              </p>
            </div>
          )}

          {busy && (
            <div className="call-loading" role="status">
              <span className="call-spinner" aria-hidden="true" />
              <span>후속 질문에 맞춰 해석하는 중이에요… 보통 10~30초 걸려요.</span>
            </div>
          )}

          {flow.error && !busy && (
            <div className="call-error" role="alert">
              <p>{flow.error}</p>
              <p className="call-extra-flow__hint">고른 카드는 그대로 남아 있어요.</p>
            </div>
          )}
        </>
      )}

      {/* 5. actions */}
      {!busy && (
        <div className="call-extra-flow__actions no-print">
          {flow.kind === "supplement" && remaining > 0 && (
            <button type="button" className="btn btn--primary" onClick={onPickStart} disabled={!hasQuestion || locked}>
              {picked === 0 ? (flow.count > 1 ? `카드 ${flow.count}장 뽑기` : "카드 뽑기") : `이어서 뽑기 (${picked}/${flow.count})`}
            </button>
          )}
          {flow.kind === "supplement" && picked > 0 && (
            <button
              type="button"
              className={remaining > 0 ? "btn" : "btn btn--primary"}
              onClick={onInterpret}
              disabled={!hasQuestion || locked}
            >
              {flow.error ? "다시 해석하기" : remaining > 0 ? "뽑은 카드로 해석" : "해석하기"}
            </button>
          )}
          {flow.kind === "spread" && spread && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onInterpret}
              disabled={!hasQuestion || missing > 0 || locked || changingSpread}
            >
              {flow.error ? "다시 해석하기" : "해석 생성"}
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onSkip} disabled={locked}>
            {flow.source === "ai" ? "후속 리딩 없이 계속" : "취소"}
          </button>
        </div>
      )}
      {flow.kind && !hasQuestion && !busy && <p className="call-extra-flow__hint">질문을 적어야 카드를 고를 수 있어요.</p>}

      {flow.status === "selecting" && flow.kind === "supplement" && (
        <CardPickerPanel
          slotLabel={`보충 카드 ${picked + 1}/${flow.count}`}
          slotHint={flow.question}
          usedCardIds={new Set([...usedCardIds, ...flow.cardIds])}
          onPick={onPick}
          onClear={() => {}}
          onClose={onPickCancel}
        />
      )}
      {flow.status === "selecting" && flow.kind === "spread" && activePosition && (
        <CardPickerPanel
          slotLabel={activePosition.label}
          slotHint={activePosition.hint ?? flow.question}
          usedCardIds={new Set(Object.values(placements))}
          currentCardId={placements[activePosition.id]}
          onPick={onPick}
          onClear={onClearSlot}
          onClose={onPickCancel}
        />
      )}
    </section>
  );
}
