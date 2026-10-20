import { useState } from "react";
import type { CallReaction } from "../lib/types";
import { GUIDE_KIND_TEXT, NEXT_TEXT } from "../lib/callText";
import { CARDS_BY_ID } from "../data/cards";

interface CallFollowUpProps {
  reactions: CallReaction[];
}

function cardNames(ids: string[]): string {
  return ids.map((id) => CARDS_BY_ID[id]?.nameKo ?? id).join(", ");
}

function inputSummary(r: CallReaction): string {
  if (r.extraReading) return `🃏 추가 카드 · ${r.extraReading.question} → ${cardNames(r.extraReading.cardIds)}`;
  if (r.kind === "extra-card" || r.question.startsWith("[카드 추가]")) {
    return `🃏 ${r.question.replace(/^\[카드 추가\]\s*/, "")}`;
  }
  if (r.tags || r.remark !== undefined) {
    const parts = [...(r.tags ?? []).map((t) => `[${t}]`), r.remark ? `"${r.remark}"` : ""].filter(Boolean);
    return `내담자 반응: ${parts.join(" ")}`;
  }
  return `내담자: ${r.question}`;
}

/** Bottom of the call screen: the newest suggested script, plus folded history. */
export function CallFollowUp({ reactions }: CallFollowUpProps) {
  const [showOlder, setShowOlder] = useState(false);
  const latest = reactions[reactions.length - 1];
  if (!latest) return null;
  const older = reactions.slice(0, -1).reverse();

  return (
    <div className="call-followup">
      <p className="call-followup__input">{inputSummary(latest)}</p>

      {latest.extraReading && (
        <section className="call-extra-reading">
          <h3>🃏 추가 카드 답</h3>
          {latest.extraReading.directAnswer && <p className="call-extra-reading__answer">{latest.extraReading.directAnswer}</p>}
          {(latest.extraReading.cards || latest.extraReading.relation) && (
            <details className="call-fold call-fold--study">
              <summary>카드 해석 · 기존 카드와의 관계</summary>
              {latest.extraReading.cards && <p className="call-fold__body-text">{latest.extraReading.cards}</p>}
              {latest.extraReading.relation && <p className="call-fold__body-text">{latest.extraReading.relation}</p>}
            </details>
          )}
        </section>
      )}

      <section className="call-say">
        <h3>🗣 지금 상담사가 할 말</h3>
        <p>{latest.answer}</p>
      </section>

      {latest.nextQuestion && (
        <section className="call-ask">
          <h3>
            ❓ 다음 질문
            {latest.nextQuestionKind && <span className="call-ask__kind">{GUIDE_KIND_TEXT[latest.nextQuestionKind]}</span>}
          </h3>
          <p>{latest.nextQuestion}</p>
        </section>
      )}

      {latest.revision && <p className="call-followup__revision">🔄 해석 조정 · {latest.revision}</p>}

      {latest.rationale && (
        <details className="call-fold call-fold--study">
          <summary>📝 상담사 참고 메모</summary>
          <p className="call-fold__body-text">{latest.rationale}</p>
        </details>
      )}

      {latest.next && (
        <div className={`call-next call-next--${latest.next}`}>
          <span className="call-next__label">AI 권고: {NEXT_TEXT[latest.next]}</span>
          <span className="call-next__hint">진행 여부는 상담사가 결정해요.</span>
        </div>
      )}

      {latest.proposalSuppressed && (
        <p className="call-followup__suppressed">ℹ️ 추가 카드 제안은 생략했어요 · {latest.proposalSuppressed}</p>
      )}

      {older.length > 0 && (
        <>
          <button
            type="button"
            className="btn btn--ghost call-followup__older-toggle no-print"
            onClick={() => setShowOlder((v) => !v)}
          >
            {showOlder ? "이전 대화 접기" : `이전 대화 ${older.length}개 보기`}
          </button>
          {showOlder && (
            <ul className="call-history">
              {older.map((r, i) => (
                <li key={i} className="call-history__item">
                  <p className="call-history__input">{inputSummary(r)}</p>
                  <p className="call-history__say">{r.answer}</p>
                  {r.nextQuestion && <p className="call-history__ask">❓ {r.nextQuestion}</p>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
