import { useState } from "react";
import type { FollowUp } from "../lib/types";

interface CallReactionThreadProps {
  reactions: FollowUp[];
  onAsk: (reaction: string) => Promise<void>;
}

export function CallReactionThread({ reactions, onAsk }: CallReactionThreadProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      await onAsk(trimmed);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "답변 생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="call-reaction-thread">
      <h3>내담자 반응</h3>

      {reactions.length > 0 && (
        <div className="call-reaction-thread__history">
          {reactions.map((r, i) => (
            <div key={i} className="call-reaction-thread__item">
              <p className="call-reaction-thread__question">내담자: {r.question}</p>
              <p className="call-reaction-thread__answer">{r.answer}</p>
            </div>
          ))}
        </div>
      )}

      <div className="call-reaction-thread__composer no-print">
        <textarea
          placeholder="내담자가 통화 중 한 말이나 질문을 입력하세요 (예: 근데 그 사람이 왜 그런 선입견을 가졌을까요?)"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
        />
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleAsk}
          disabled={loading || !text.trim()}
        >
          {loading ? "답변 생성 중…" : "답변 생성"}
        </button>
      </div>

      {error && <p className="interpretation-panel__error">{error}</p>}
    </div>
  );
}
