import type { CallClosing } from "../lib/types";
import { estimateSpeechSeconds } from "../lib/callText";

interface CallClosingPanelProps {
  closing: CallClosing | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
}

const PARTS: { key: keyof Omit<CallClosing, "createdAt">; label: string }[] = [
  { key: "questionSummary", label: "질문 요약" },
  { key: "flow", label: "카드 흐름" },
  { key: "confirmed", label: "확인된 정보" },
  { key: "considerations", label: "현실 고려" },
  { key: "closingLine", label: "마무리 멘트" },
];

/** The 20~30 second wrap-up, shown as one script to read top to bottom. */
export function CallClosingPanel({ closing, loading, error, onGenerate }: CallClosingPanelProps) {
  if (!closing && !loading && !error) return null;
  const parts = closing ? PARTS.filter((p) => closing[p.key]) : [];
  const seconds = closing ? estimateSpeechSeconds(parts.map((p) => closing[p.key]).join(" ")) : 0;

  return (
    <section className="call-closing">
      <div className="call-core__head">
        <h3>👋 상담 마무리 대본</h3>
        {closing && <span className={`call-core__badge${seconds > 32 ? " call-core__badge--long" : ""}`}>약 {seconds}초</span>}
      </div>

      {loading && (
        <div className="call-loading" role="status">
          <span className="call-spinner" aria-hidden="true" />
          <span>지금까지의 상담으로 마무리 대본을 만드는 중이에요…</span>
        </div>
      )}

      {closing && (
        <ol className="call-closing__parts">
          {parts.map((p) => (
            <li key={p.key}>
              <span className="call-closing__label">{p.label}</span>
              <span>{closing[p.key]}</span>
            </li>
          ))}
        </ol>
      )}

      {error && !loading && (
        <div className="call-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn" onClick={onGenerate}>
            다시 시도
          </button>
        </div>
      )}
    </section>
  );
}
