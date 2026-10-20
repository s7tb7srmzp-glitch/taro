import { useEffect, useState } from "react";
import type { CallReaction, CallScript } from "../lib/types";
import { estimateSpeechSeconds } from "../lib/callText";

interface CallInterpretationProps {
  script: CallScript;
  reactions: CallReaction[];
  facts: string[];
  onRemoveFact: (index: number) => void;
}

const NOTE_SECTIONS: { key: keyof NonNullable<CallScript["notes"]>; title: string }[] = [
  { key: "keywords", title: "카드별 핵심 키워드" },
  { key: "positions", title: "위치별 해석 근거" },
  { key: "relations", title: "카드 간 관계" },
  { key: "basis", title: "최종 결론의 근거" },
  { key: "cautions", title: "해석할 때 주의할 점" },
];

/** Top of the call screen: the reading itself (15s conclusion, 1-minute detail, study notes). */
export function CallInterpretation({ script, reactions, facts, onRemoveFact }: CallInterpretationProps) {
  const hasFollowUps = reactions.length > 0;
  const [detailOpen, setDetailOpen] = useState(!hasFollowUps);

  // Once the conversation moves on, fold the long explanation away to save scrolling.
  useEffect(() => {
    if (hasFollowUps) setDetailOpen(false);
  }, [hasFollowUps]);

  const seconds = estimateSpeechSeconds(script.coreConclusion);
  const revisions = reactions.filter((r) => r.revision);

  return (
    <div className="call-reading">
      <section className="call-core">
        <div className="call-core__head">
          <h3>📣 15초 핵심 결론</h3>
          {script.coreConclusion && (
            <span className={`call-core__badge${seconds > 18 ? " call-core__badge--long" : ""}`}>약 {seconds}초</span>
          )}
        </div>
        <p>{script.coreConclusion || "핵심 결론이 비어 있어요. 대본을 다시 생성해주세요."}</p>
      </section>

      {script.detail && (
        <details className="call-fold" open={detailOpen} onToggle={(e) => setDetailOpen(e.currentTarget.open)}>
          <summary>🗣 1분 상세 설명</summary>
          <p className="call-fold__script">{script.detail}</p>
        </details>
      )}

      <details className="call-fold call-fold--study">
        <summary>📚 해석 근거 (상담사 참고용 · 읽어주는 대본 아님)</summary>
        <div className="call-fold__body">
          {script.notes ? (
            NOTE_SECTIONS.filter((s) => script.notes![s.key]).map((s) => (
              <section key={s.key} className="call-note">
                <h4>{s.title}</h4>
                <p>{script.notes![s.key]}</p>
              </section>
            ))
          ) : (
            script.rationale && (
              <section className="call-note">
                <p>{script.rationale}</p>
              </section>
            )
          )}

          <section className="call-note">
            <h4>상담 중 확인된 사실 (내담자 발언 기준)</h4>
            {facts.length === 0 ? (
              <p className="call-note__empty">아직 없어요. 내담자 발언에서 자동으로 정리돼요.</p>
            ) : (
              <ul className="call-facts">
                {facts.map((f, i) => (
                  <li key={`${i}-${f}`} className="call-facts__item">
                    <span>{f}</span>
                    <button
                      type="button"
                      className="call-facts__remove no-print"
                      onClick={() => onRemoveFact(i)}
                      aria-label={`사실 삭제: ${f}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {revisions.length > 0 && (
            <section className="call-note">
              <h4>해석 수정 이력</h4>
              <ul className="call-note__list">
                {revisions.map((r, i) => (
                  <li key={i}>🔄 {r.revision}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </details>
    </div>
  );
}
