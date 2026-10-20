import { useState } from "react";
import { REACTION_TAGS } from "../lib/callText";
import type { CallTurnInput } from "../lib/ai";

interface CallComposerProps {
  onGenerate: (input: CallTurnInput) => Promise<void>;
  disabled?: boolean;
}

/** Middle of the call screen: optional quick-reaction buttons + a short note, sent only on demand. */
export function CallComposer({ onGenerate, disabled }: CallComposerProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [remark, setRemark] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = (tags.length > 0 || remark.trim().length > 0) && !pending && !disabled;

  function toggle(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function send() {
    if (!canSend) return;
    setPending(true);
    setError(null);
    try {
      await onGenerate({ tags, remark: remark.trim() });
      setTags([]);
      setRemark("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "대본 생성 중 오류가 발생했어요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="call-composer no-print">
      <div className="call-composer__label">내담자 반응 (필요할 때만)</div>
      <div className="call-chips" role="group" aria-label="내담자 반응 버튼">
        {REACTION_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={tags.includes(tag)}
            className={`call-chip${tags.includes(tag) ? " call-chip--on" : ""}`}
            onClick={() => toggle(tag)}
            disabled={pending}
          >
            {tag}
          </button>
        ))}
      </div>
      <textarea
        id="call-reaction-input"
        className="call-composer__input"
        placeholder="내담자 발언을 짧게 적어주세요 (키워드만 적어도 돼요) 예: 다시 살고 싶지만 예전처럼 될까 걱정"
        rows={2}
        value={remark}
        disabled={pending}
        onChange={(e) => setRemark(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
      />
      <p className="call-composer__privacy">
        입력한 내용은 대본을 만들기 위해 외부 AI(Anthropic Claude API)로 전송돼요. 이름·연락처 같은
        민감한 정보는 적지 마세요.
      </p>
      <button type="button" className="btn btn--primary call-composer__send" onClick={send} disabled={!canSend}>
        {pending ? "다음 상담 대본 만드는 중…" : "다음 상담 대본 생성"}
      </button>

      {pending && (
        <div className="call-loading" role="status">
          <span className="call-spinner" aria-hidden="true" />
          <span>보통 5~20초 걸려요. 입력한 내용은 그대로 남아 있어요.</span>
        </div>
      )}
      {error && (
        <div className="call-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn" onClick={send} disabled={!canSend}>
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
