import type { CallScript } from "../lib/types";

interface CallScriptPanelProps {
  script: CallScript | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  canGenerate: boolean;
  hint?: string;
}

export function CallScriptPanel({
  script,
  loading,
  error,
  onGenerate,
  canGenerate,
  hint,
}: CallScriptPanelProps) {
  return (
    <div className="call-script-panel">
      <div className="call-script-panel__actions no-print">
        <button
          type="button"
          className="btn btn--primary btn--large"
          onClick={onGenerate}
          disabled={loading || !canGenerate}
        >
          {loading ? "스크립트 생성 중…" : script ? "스크립트 다시 생성" : "상담 스크립트 생성"}
        </button>
      </div>

      {hint && <p className="interpretation-panel__hint">{hint}</p>}
      {error && <p className="interpretation-panel__error">{error}</p>}

      {script && (
        <div className="call-script-panel__body">
          {script.coreConclusion && (
            <section className="call-script-panel__section call-script-panel__section--core">
              <h3>📣 15초 핵심 결론</h3>
              <p>{script.coreConclusion}</p>
            </section>
          )}
          {script.detail && (
            <section className="call-script-panel__section">
              <h3>🗣 1분 상세 설명</h3>
              <p>{script.detail}</p>
            </section>
          )}
          {script.questionToAsk && (
            <section className="call-script-panel__section">
              <h3>❓ 내담자에게 물어볼 질문</h3>
              <p>{script.questionToAsk}</p>
            </section>
          )}
          {script.closing && (
            <section className="call-script-panel__section">
              <h3>👋 마무리</h3>
              <p>{script.closing}</p>
            </section>
          )}
          {script.rationale && (
            <details className="call-script-panel__rationale" open>
              <summary>📚 해석 근거 (학습용 — 상담사가 읽는 대본 아님)</summary>
              <p>{script.rationale}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
