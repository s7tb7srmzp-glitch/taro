import { useState } from "react";
import type { FollowUp } from "../lib/types";

interface FollowUpThreadProps {
  followUps: FollowUp[];
  onAsk: (question: string) => Promise<void>;
}

export function FollowUpThread({ followUps, onAsk }: FollowUpThreadProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    const trimmed = question.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      await onAsk(trimmed);
      setQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "질문 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="followup-thread">
      <h3>더 물어보기</h3>

      {followUps.length > 0 && (
        <div className="followup-thread__history">
          {followUps.map((f, i) => (
            <div key={i} className="followup-thread__item">
              <p className="followup-thread__question">Q. {f.question}</p>
              <p className="followup-thread__answer">{f.answer}</p>
            </div>
          ))}
        </div>
      )}

      <div className="followup-thread__composer no-print">
        <textarea
          placeholder="해석 결과에 대해 더 궁금한 점을 물어보세요 (예: 이 관계가 언제쯤 진전이 있을까요?)"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
        />
        <button type="button" className="btn btn--primary" onClick={handleAsk} disabled={loading || !question.trim()}>
          {loading ? "물어보는 중…" : "질문하기"}
        </button>
      </div>

      {error && <p className="interpretation-panel__error">{error}</p>}
    </div>
  );
}
