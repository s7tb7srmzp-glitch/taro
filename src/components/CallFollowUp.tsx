import { useState } from "react";
import type { CallFollowReading, CallReaction } from "../lib/types";
import { GUIDE_KIND_TEXT, NEXT_TEXT } from "../lib/callText";
import { CARDS_BY_ID } from "../data/cards";
import { readingTypeLabel } from "./CallReadings";

interface CallFollowUpProps {
  reactions: CallReaction[];
  readings: CallFollowReading[];
}

function cardNames(ids: string[]): string {
  return ids.map((id) => CARDS_BY_ID[id]?.nameKo ?? id).join(", ");
}

function inputSummary(r: CallReaction, reading?: CallFollowReading): string {
  if (reading) return `🔮 후속 리딩 ${reading.order} · ${readingTypeLabel(reading)} · ${reading.question}`;
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
export function CallFollowUp({ reactions, readings }: CallFollowUpProps) {
  const [showOlder, setShowOlder] = useState(false);
  const latest = reactions[reactions.length - 1];
  if (!latest) return null;
  const older = reactions.slice(0, -1).reverse();
  const readingOf = (r: CallReaction) => (r.readingId ? readings.find((x) => x.id === r.readingId) : undefined);
  const latestReading = readingOf(latest);
  // Older saves kept the extra-card result on the turn itself.
  const result = latestReading
    ? { conclusion: latestReading.result.conclusion, cards: latestReading.result.cards, relation: latestReading.result.relation }
    : latest.extraReading
      ? { conclusion: latest.extraReading.directAnswer, cards: latest.extraReading.cards, relation: latest.extraReading.relation }
      : undefined;

  return (
    <div className="call-followup">
      <p className="call-followup__input">{inputSummary(latest, latestReading)}</p>

      {result && (
        <section className="call-extra-reading">
          <h3>{latestReading ? `🔮 후속 리딩 ${latestReading.order} 핵심 결론` : "🃏 추가 카드 답"}</h3>
          {result.conclusion && <p className="call-extra-reading__answer">{result.conclusion}</p>}
          {(result.cards || result.relation) && (
            <details className="call-fold call-fold--study">
              <summary>카드별 해석 · 기존 상담과 연결</summary>
              {result.cards && <p className="call-fold__body-text">{result.cards}</p>}
              {result.relation && <p className="call-fold__body-text">{result.relation}</p>}
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
                  <p className="call-history__input">{inputSummary(r, readingOf(r))}</p>
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
