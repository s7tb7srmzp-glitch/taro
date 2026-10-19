import { useState } from "react";
import type { CallReaction, CallScript } from "../lib/types";

type Tab = "script" | "rationale" | "closing";

const TABS: { key: Tab; label: string }[] = [
  { key: "script", label: "상담 대본" },
  { key: "rationale", label: "해석 근거" },
  { key: "closing", label: "마무리" },
];

interface CallScriptTabsProps {
  script: CallScript;
  reactions: CallReaction[];
  facts: string[];
  onRemoveFact: (index: number) => void;
}

export function CallScriptTabs({ script, reactions, facts, onRemoveFact }: CallScriptTabsProps) {
  const [tab, setTab] = useState<Tab>("script");
  const notes = reactions.filter((r) => r.rationale || r.revision);

  return (
    <div className="call-tabs">
      <div className="call-tabs__bar" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`call-tabs__tab${tab === t.key ? " call-tabs__tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="call-tabs__panel" role="tabpanel">
        {tab === "script" && (
          <>
            {script.detail && (
              <section className="call-tabs__section">
                <h3>🗣 1분 상세 설명</h3>
                <p>{script.detail}</p>
              </section>
            )}
            {script.questionToAsk && (
              <section className="call-tabs__section">
                <h3>❓ 내담자에게 물어볼 질문</h3>
                <p>{script.questionToAsk}</p>
              </section>
            )}
          </>
        )}

        {tab === "rationale" && (
          <div className="call-tabs__study">
            <p className="call-tabs__study-label">📚 학습용 — 상담사가 읽는 대본이 아니에요</p>
            {script.rationale && (
              <section className="call-tabs__section">
                <h3>대본 해석 근거</h3>
                <p>{script.rationale}</p>
              </section>
            )}

            <section className="call-tabs__section">
              <h3>상담 중 확인된 사실</h3>
              {facts.length === 0 ? (
                <p className="call-tabs__empty">아직 없어요. 내담자 발언에서 자동으로 정리돼요.</p>
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

            {notes.length > 0 && (
              <section className="call-tabs__section">
                <h3>대화별 근거 · 해석 수정</h3>
                <ul className="call-notes">
                  {notes.map((r, i) => (
                    <li key={i} className="call-notes__item">
                      <p className="call-notes__q">{r.question}</p>
                      {r.revision && <p className="call-notes__revision">🔄 {r.revision}</p>}
                      {r.rationale && <p className="call-notes__rationale">{r.rationale}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {tab === "closing" && (
          <section className="call-tabs__section">
            <h3>👋 상담 마무리</h3>
            <p>{script.closing || "마무리 멘트가 없어요. 대본을 다시 생성해보세요."}</p>
          </section>
        )}
      </div>
    </div>
  );
}
