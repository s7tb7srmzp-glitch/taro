import type { CallGuideKind, CallNext } from "./types";

/** Rough spoken length for Korean at ~5 syllables per second. */
export function estimateSpeechSeconds(text: string): number {
  return Math.max(1, Math.round(text.replace(/\s/g, "").length / 5));
}

export const GUIDE_KIND_TEXT: Record<CallGuideKind, string> = {
  confirm: "확인 질문",
  deepen: "심화 질문",
  close: "상담 마무리",
};

export const NEXT_TEXT: Record<CallNext, string> = {
  continue: "상담 계속",
  "extra-card": "추가 카드 검토",
  close: "상담 마무리 가능",
};

/** Quick reaction buttons; they only hint at the situation and never count as confirmed facts. */
export const REACTION_TAGS = ["공감", "해석 불일치", "새로운 정보", "추가 질문", "결정 고민", "기타"] as const;
