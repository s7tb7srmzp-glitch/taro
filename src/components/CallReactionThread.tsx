import { useState } from "react";
import type { CallReaction } from "../lib/types";

interface CallReactionThreadProps {
  reactions: CallReaction[];
  onAsk: (reaction: string) => Promise<void>;
}

function isExtraCard(r: CallReaction): boolean {
  return r.kind === "extra-card" || r.question.startsWith("[카드 추가]");
}

function ReactionItem({ r, latest }: { r: CallReaction; latest?: boolean }) {
  return (
    <div className={`call-reaction-thread__item${latest ? " call-reaction-thread__item--latest" : ""}`}>
      <p className="call-reaction-thread__question">
        {isExtraCard(r) ? `🃏 ${r.question.replace(/^\[카드 추가\]\s*/, "")}` : `내담자: ${r.question}`}
      </p>
      <p className="call-reaction-thread__answer">{r.answer}</p>
      {r.revision && <p className="call-reaction-thread__revision">🔄 해석 업데이트 · {r.revision}</p>}
    </div>
  );
}

export function CallReactionThread({ reactions, onAsk }: CallReactionThreadProps) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOlder, setShowOlder] = useState(false);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(trimmed);
    setError(null);
    try {
      await onAsk(trimmed);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "답변 생성 중 오류가 발생했어요.");
    } finally {
      setPending(null);
    }
  }

  const latest = reactions[reactions.length - 1];
  const older = reactions.slice(0, -1).reverse();

  return (
    <div className="call-reaction-thread">
      <div className="call-reaction-thread__composer no-print">
        <label className="call-reaction-thread__label" htmlFor="call-reaction-input">
          내담자 발언
        </label>
        <textarea
          id="call-reaction-input"
          placeholder="내담자가 한 말이나 질문을 그대로 적어주세요 (예: 사실 그 사람이랑 지난주에 다퉜어요)"
          rows={2}
          value={text}
          disabled={!!pending}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="button" className="btn btn--primary" onClick={send} disabled={!!pending || !text.trim()}>
          {pending ? "답변 만드는 중…" : "답변 생성"}
        </button>
      </div>

      {pending && (
        <div className="call-loading" role="status">
          <span className="call-spinner" aria-hidden="true" />
          <span>"{pending}"에 대한 답변을 만드는 중이에요…</span>
        </div>
      )}

      {error && (
        <div className="call-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn" onClick={send} disabled={!text.trim()}>
            다시 시도
          </button>
        </div>
      )}

      {latest && <ReactionItem r={latest} latest />}

      {older.length > 0 && (
        <>
          <button
            type="button"
            className="btn btn--ghost call-reaction-thread__older-toggle no-print"
            onClick={() => setShowOlder((v) => !v)}
          >
            {showOlder ? "이전 대화 접기" : `이전 대화 ${older.length}개 보기`}
          </button>
          {showOlder && older.map((r, i) => <ReactionItem key={i} r={r} />)}
        </>
      )}
    </div>
  );
}
