import type { CallGuideKind, CallReaction, CallScript } from "../lib/types";
import { GUIDE_KIND_TEXT } from "../lib/callText";

interface CallGuideProps {
  script: CallScript;
  reactions: CallReaction[];
  onCloseCall: () => void;
}

interface CurrentGuide {
  kind: CallGuideKind | null;
  text: string;
}

function currentGuide(script: CallScript, reactions: CallReaction[]): CurrentGuide {
  const latest = reactions[reactions.length - 1];
  if (latest) {
    if (latest.nextQuestion) return { kind: latest.nextQuestionKind ?? "confirm", text: latest.nextQuestion };
    if (latest.next === "close") {
      return { kind: "close", text: "원래 질문에 충분히 답한 것 같아요. 마무리 대본을 만들어 보세요." };
    }
    return { kind: null, text: "지금은 새 질문 없이 내담자의 이야기를 들어보세요." };
  }
  if (script.guide) return { kind: script.guide.kind, text: script.guide.text };
  if (script.questionToAsk) return { kind: "confirm", text: script.questionToAsk };
  return { kind: null, text: "내담자의 반응을 들어보세요." };
}

/** "다음 상담 진행 가이드": one suggested move — a confirming question, a deeper question, or wrapping up. */
export function CallGuide({ script, reactions, onCloseCall }: CallGuideProps) {
  const guide = currentGuide(script, reactions);
  return (
    <div className={`call-guide${guide.kind ? ` call-guide--${guide.kind}` : ""}`}>
      <div className="call-guide__head">
        <span className="call-guide__title">🧭 다음 상담 진행 가이드</span>
        {guide.kind && <span className="call-guide__kind">{GUIDE_KIND_TEXT[guide.kind]}</span>}
      </div>
      <p className="call-guide__text">{guide.text}</p>
      {guide.kind === "close" && (
        <button type="button" className="btn no-print" onClick={onCloseCall}>
          상담 마무리 대본 만들기
        </button>
      )}
    </div>
  );
}
