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

/**
 * How a remark typed while an extra-card proposal is pending relates to it.
 * A bare "네" is "unclear": it may answer the proposal or something else, so the counselor decides.
 */
export type ProposalAnswer = "accept" | "decline" | "unclear" | "other";

export function classifyProposalAnswer(text: string): ProposalAnswer {
  const t = text.trim();
  if (!t) return "other";
  if (/안\s*뽑|뽑지\s*(말|않|마)|카드\s*(는|은)?\s*(괜찮|됐|필요\s*없)/.test(t)) return "decline";
  if (/(뽑아|뽑을게|뽑자|뽑아\s*볼|한\s*장\s*더|카드\s*(볼게|보고\s*싶|봐\s*주|봐\s*줘|더\s*봐))/.test(t)) return "accept";
  if (/^(아니|아뇨|아니요|괜찮아요|괜찮습니다|됐어요|됐습니다|싫어요|다음에)/.test(t)) return "decline";
  if (/^(네|예|응|넵|넹|좋아요|좋습니다|그래요|그럴게요|해\s*주세요|부탁드려요|부탁해요)[\s.!~,]*$/.test(t)) return "unclear";
  return "other";
}

function normalizeQuestion(q: string): string {
  return q.replace(/[\s?？.!~,'"·…]/g, "").replace(/(인가요|일까요|할까요|나요|까요|요)$/, "");
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** Returns the earlier question this one repeats (same, contained, or near-identical wording), if any. */
export function findRepeatedQuestion(question: string, previous: string[]): string | undefined {
  const a = normalizeQuestion(question);
  if (a.length < 2) return undefined;
  const ga = bigrams(a);
  return previous.find((p) => {
    const b = normalizeQuestion(p);
    if (b.length < 2) return false;
    if (a === b) return true;
    if (Math.min(a.length, b.length) >= 6 && (a.includes(b) || b.includes(a))) return true;
    const gb = bigrams(b);
    let common = 0;
    for (const g of ga) if (gb.has(g)) common++;
    return (2 * common) / (ga.size + gb.size) >= 0.6;
  });
}
