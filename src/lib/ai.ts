import type {
  CallClosing,
  CallGuideKind,
  CallNext,
  CallReaction,
  CallReply,
  CallScript,
  CallSession,
  ExtraCardFlow,
  ExtraCardSuggestion,
  FollowReadingKind,
  Reading,
} from "./types";
import { SPREADS, SPREADS_BY_ID } from "../data/spreads";
import { CARDS_BY_ID } from "../data/cards";
import { getApiKey } from "./settings";

const ANTHROPIC_MODEL = "claude-sonnet-5";
const NO_MARKDOWN_NOTE =
  "(마크다운 문법(#, *, -, --- 등)을 쓰지 말고, 일반 텍스트와 줄바꿈만 사용해서 답해주세요.)";

type ChatMessage = { role: "user" | "assistant"; content: string };

function buildInterpretationPrompt(
  reading: Reading,
  spreadName: string,
  cards: { position: string; card: string }[],
): string {
  const cardLines = cards.map((c) => `- ${c.position}: ${c.card}`).join("\n");

  return [
    `당신은 따뜻하고 신중한 타로 상담사입니다. 아래 리딩을 해석해주세요.`,
    ``,
    `내담자: ${reading.session.querentName || "익명"}`,
    `날짜: ${reading.session.date || "미상"}`,
    `질문: ${reading.session.question || "(질문 없음)"}`,
    `스프레드: ${spreadName}`,
    ``,
    `배치된 카드 (포지션: 카드):`,
    cardLines,
    ``,
    `각 카드를 해당 포지션의 의미에 맞춰 해석하고, 카드들 사이의 흐름을 연결해`,
    `질문에 대한 통합적인 해석을 작성해주세요. 단정적인 예언이 아니라 가능성과`,
    `조언 중심으로, 자연스러운 한국어 문장으로 작성해주세요. 마지막에는 짧은`,
    `한 줄 조언으로 마무리해주세요.`,
    ``,
    `형식: 마크다운 문법(#, *, -, ---  등)을 쓰지 말고, 일반 텍스트와 줄바꿈만`,
    `사용해서 작성해주세요. 카드별로 문단을 나누되 특수기호로 소제목을 달지는 마세요.`,
  ].join("\n");
}

async function callClaude(
  apiKey: string,
  messages: ChatMessage[],
): Promise<{ text: string; truncated: boolean }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401) {
      throw new Error("API 키가 올바르지 않습니다. 설정에서 키를 다시 확인해주세요.");
    }
    throw new Error(`요청 실패 (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
  };
  const text = data.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Claude 응답에서 텍스트를 찾지 못했습니다.");
  return { text, truncated: data.stop_reason === "max_tokens" };
}

/** Runs the conversation, automatically asking Claude to continue if a reply gets cut off by max_tokens. */
async function runToCompletion(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const working = [...messages];
  let fullText = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    const { text, truncated } = await callClaude(apiKey, working);
    fullText += text;
    if (!truncated) break;
    working.push({ role: "assistant", content: text });
    working.push({ role: "user", content: "이어서 계속 써주세요." });
  }

  return fullText;
}

function requireApiKey(): string {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API 키가 설정되어 있지 않습니다. 설정에서 Anthropic API 키를 먼저 등록해주세요.");
  }
  return apiKey;
}

export async function requestInterpretation(reading: Reading): Promise<string> {
  const spread = SPREADS_BY_ID[reading.spreadId];
  if (!spread) throw new Error("알 수 없는 스프레드입니다.");

  const apiKey = requireApiKey();

  const cards = spread.positions
    .filter((p) => reading.placements[p.id])
    .map((p) => {
      const card = CARDS_BY_ID[reading.placements[p.id]];
      return { position: p.label, card: card?.nameKo ?? "?" };
    });

  const prompt = buildInterpretationPrompt(reading, spread.name, cards);
  return runToCompletion(apiKey, [{ role: "user", content: prompt }]);
}

/** Builds the full conversation so far (original reading + interpretation + prior follow-ups) so a new
 * follow-up question is answered with the same context Claude used originally. */
export async function requestFollowUp(reading: Reading, question: string): Promise<string> {
  const spread = SPREADS_BY_ID[reading.spreadId];
  if (!spread) throw new Error("알 수 없는 스프레드입니다.");
  if (!reading.interpretation) throw new Error("먼저 AI 해석을 받은 뒤에 추가 질문을 할 수 있어요.");

  const apiKey = requireApiKey();

  const cards = spread.positions
    .filter((p) => reading.placements[p.id])
    .map((p) => {
      const card = CARDS_BY_ID[reading.placements[p.id]];
      return { position: p.label, card: card?.nameKo ?? "?" };
    });

  const messages: ChatMessage[] = [
    { role: "user", content: buildInterpretationPrompt(reading, spread.name, cards) },
    { role: "assistant", content: reading.interpretation },
  ];

  for (const followUp of reading.followUps ?? []) {
    messages.push({ role: "user", content: followUp.question });
    messages.push({ role: "assistant", content: followUp.answer });
  }

  messages.push({ role: "user", content: `${question}\n\n${NO_MARKDOWN_NOTE}` });

  return runToCompletion(apiKey, messages);
}

/* ---------- phone-consultation mode ---------- */

const SCRIPT_LABELS = [
  "핵심결론",
  "상세설명",
  "가이드유형",
  "가이드",
  "마무리",
  "카드키워드",
  "위치근거",
  "카드관계",
  "결론근거",
  "주의점",
  "해석근거",
  "질문",
] as const;
const REPLY_LABELS = [
  "할말",
  "질문유형",
  "다음질문",
  "참고메모",
  "해석수정",
  "새사실",
  "다음진행",
  "카드제안",
  "추가카드",
  "핵심결론",
  "카드해석",
  "기존카드관계",
  "질문답변",
  "답변",
  "근거",
] as const;
const CLOSING_LABELS = ["질문요약", "핵심흐름", "확인된정보", "현실고려", "마무리멘트"] as const;

/** How many recent live turns are replayed verbatim; older ones are folded into a short summary. */
const RECENT_TURNS = 6;

type CallCardLine = { position: string; weight: number; card: string };

function requireSpread(spreadId: string) {
  const spread = SPREADS_BY_ID[spreadId];
  if (!spread) throw new Error("알 수 없는 스프레드입니다.");
  return spread;
}

/** Position label, weight and card for each filled position of a registered spread. */
function spreadCardLines(spread: ReturnType<typeof requireSpread>, placements: Record<string, string>): CallCardLine[] {
  return spread.positions
    .filter((p) => placements[p.id])
    .map((p) => {
      const card = CARDS_BY_ID[placements[p.id]];
      return { position: p.label, weight: p.weight ?? 2, card: card?.nameKo ?? "?" };
    });
}

function buildCallCardLines(session: CallSession, spread: ReturnType<typeof requireSpread>): CallCardLine[] {
  return spreadCardLines(spread, session.placements);
}

function formatCardLines(cards: CallCardLine[]): string {
  return cards.map((c) => `- ${c.position} (비중 ${c.weight}/3, 3이 핵심): ${c.card}`).join("\n");
}

/** Extra reading instructions for spreads whose structure needs a specific comparison. */
const CALL_SPREAD_GUIDANCE: Record<string, string[]> = {
  "two-choice": [
    `이 배열은 양자택일입니다. 질문 속 두 선택지를 A와 B로 보고 다음을 지켜주세요.`,
    `- A와 B 각각 "과정(가까운 미래 자리)"과 "결과(결과 자리)"를 따로 구분해서 읽으세요.`,
    `- 핵심결론에서 두 선택의 차이를 비교하고, "~를 더 중요하게 여기신다면 A, ~라면 B"처럼`,
    `  어떤 조건에서 어느 쪽이 맞는지를 말하세요.`,
    `- 한쪽을 무조건 정답으로 정해주지 말고, 최종 결정은 내담자에게 남겨두세요.`,
    `- 결과가 좋아 보여도 과정 자리 카드에 어려움이 있으면 그 대가를 함께 말하세요.`,
  ],
};

const CALL_READING_RULES = [
  `해석 원칙:`,
  `- 카드 한 장의 사전적 의미보다 "그 카드가 놓인 자리의 역할"과 "카드끼리의 관계(흐름,`,
  `  대비, 충돌)"를 우선해서 읽으세요. 비중이 높은 자리를 중심축으로 삼으세요.`,
  `- 과정 자리 카드와 결과 자리 카드가 어떻게 이어지는지를 중요하게 다루세요. 결과 카드가`,
  `  긍정적이어도 과정·장애 자리에 어려움이 보이면 반드시 함께 설명하세요.`,
  `- "긍정 카드/부정 카드"라는 단순 분류만으로 결론을 내리지 마세요. 부정적인 의미의 카드를`,
  `  억지로 긍정적으로 바꾸지 말고, 어려움은 어려움대로 말한 뒤 대처 방법을 덧붙이세요.`,
  `- "다 잘될 거예요" 같은 막연하고 뭉뚱그린 위로를 반복하지 마세요.`,
  `- 카드가 보여주는 가능성과 현실에서 확정된 사실을 구분하세요. 카드에 나타나지 않은 사실이나`,
  `  내담자·상대방의 감정을 단정하지 말고, 상대방의 마음이나 미래는 "~일 가능성이 보여요"처럼`,
  `  가능성과 경향으로 표현하세요. 근거 없이 미래를 단정하지 마세요.`,
  `- 의료·법률·재정적 결정을 대신 내리지 말고, 필요하면 전문가 상담을 권하세요.`,
  `- 마크다운 문법(#, *, -, --- 등)을 쓰지 말고 일반 텍스트와 줄바꿈만 사용하세요.`,
];

const CALL_QUESTION_RULES = [
  `질문 원칙:`,
  `- 질문은 한 번에 최대 하나만, 꼭 필요할 때만 만드세요. 필요 없으면 만들지 마세요.`,
  `- 짧고 자연스러운 구어체로 쓰고, 한 문장에 질문을 두 개 넣지 마세요.`,
  `- 내담자를 추궁하거나 판단하는 표현을 쓰지 마세요.`,
  `- 이미 확인한 정보나 이미 한 질문을 다시 묻지 마세요.`,
  `- 카드 해석을 실제 사실로 단정하는 질문을 하지 마세요.`,
  `- 심리 분석을 위해 불필요하게 사적인 정보를 캐묻지 말고, 내담자의 원래 질문과 직접 관련된`,
  `  질문을 우선하세요.`,
];

function buildCallScriptPrompt(session: CallSession, spreadId: string, spreadName: string, cards: CallCardLine[]): string {
  const cardLines = formatCardLines(cards);
  const guidance = CALL_SPREAD_GUIDANCE[spreadId];

  return [
    `당신은 숙련된 타로 상담사가 전화 상담 중인 초보 상담사를 돕는 보조 도구입니다.`,
    `상담사가 상담을 주도하고, 당신은 상담사가 참고하거나 그대로 소리 내어 읽을 문장을 제안합니다.`,
    ``,
    `내담자: ${session.session.querentName || "익명"}`,
    `날짜: ${session.session.date || "미상"}`,
    `상담 질문: ${session.session.question || "(질문 없음)"}`,
    `스프레드: ${spreadName}`,
    ``,
    `배치된 카드 (자리: 카드):`,
    cardLines,
    ``,
    ...(guidance ? [...guidance, ``] : []),
    `다음 형식을 정확히 지켜서, 구분자 줄을 그대로 포함해 작성해주세요 (구분자 앞뒤에 다른`,
    `글자를 붙이지 마세요):`,
    ``,
    `===핵심결론===`,
    `(전화로 15초 안에 말할 분량: 2~3문장, 공백 포함 80~100자 안팎. 첫 문장에서 내담자의 질문에`,
    `직접 답하세요. 인사나 배경 설명으로 시작하지 마세요. 선택형 질문이면 각 선택지의 특징을`,
    `비교하세요. 과정에 어려움이 있다면 한 문장으로 함께 언급하세요. 지나치게 모호하게 쓰지`,
    `마세요.)`,
    `===상세설명===`,
    `(1분 분량, 공백 포함 300~400자 안팎. 각 자리의 의미를 반영하고, 카드 간 관계와 과정→결과의`,
    `연결을 중심으로 설명하세요.)`,
    `===가이드유형===`,
    `(다음 셋 중 하나만 그대로 쓰세요: 확인 질문 / 심화 질문 / 상담 마무리.`,
    `상담 시작 직후에는 카드 해석과 실제 상황을 연결할 정보가 부족한 경우가 많으므로 보통`,
    `"확인 질문"을 고르세요.)`,
    `===가이드===`,
    `(확인 질문·심화 질문이면 질문 한 문장만. 상담 마무리면 자연스러운 마무리 연결 멘트 1~2문장.)`,
    `===마무리===`,
    `(상담을 자연스럽게 마무리하는 멘트 1~2문장.)`,
    `===카드키워드===`,
    `(카드별 핵심 키워드. 한 줄에 "자리: 카드 — 키워드" 형식)`,
    `===위치근거===`,
    `(각 자리의 역할에 비추어 왜 그렇게 읽었는지 한 줄씩)`,
    `===카드관계===`,
    `(카드끼리의 흐름·대비·충돌, 과정 카드와 결과 카드의 연결)`,
    `===결론근거===`,
    `(핵심결론이 어떤 자리·카드에서 나왔는지)`,
    `===주의점===`,
    `(이 해석을 쓸 때 조심할 점: 단정하면 안 되는 부분, 확인이 필요한 부분 등)`,
    ``,
    ...CALL_READING_RULES,
    ...CALL_QUESTION_RULES,
    `- "핵심결론"/"상세설명"/"가이드"/"마무리"는 상담사가 그대로 소리 내어 읽을 자연스러운`,
    `  구어체(해요체)로 쓰세요. 카드키워드~주의점은 상담사만 보는 메모이므로 짧은 설명조로 쓰세요.`,
  ].join("\n");
}

const GUIDE_KIND_LABEL: Record<CallGuideKind, string> = {
  confirm: "확인 질문",
  deepen: "심화 질문",
  close: "상담 마무리",
};

const NEXT_LABEL: Record<CallNext, string> = {
  continue: "상담 계속",
  "extra-card": "추가 카드 검토",
  close: "상담 마무리 가능",
};

function parseGuideKind(text: string | undefined): CallGuideKind | undefined {
  if (!text) return undefined;
  if (text.includes("마무리")) return "close";
  if (text.includes("심화")) return "deepen";
  if (text.includes("확인")) return "confirm";
  return undefined;
}

function parseNext(text: string | undefined): CallNext {
  if (!text) return "continue";
  if (text.includes("추가")) return "extra-card";
  if (text.includes("마무리")) return "close";
  return "continue";
}

function isNone(text: string | undefined): boolean {
  return !text || /^(없음|해당\s*없음|없습니다|-)\.?$/.test(text.trim());
}

/** Keeps a single question: everything up to the first question mark. */
function singleQuestion(text: string): string {
  const t = text.trim();
  const i = t.search(/[?？]/);
  return i >= 0 ? t.slice(0, i + 1).trim() : t;
}

function serializeCallScript(script: CallScript): string {
  const guide = script.guide ?? { kind: "confirm" as const, text: script.questionToAsk };
  const notes = script.notes;
  return [
    `===핵심결론===`,
    script.coreConclusion,
    `===상세설명===`,
    script.detail,
    `===가이드유형===`,
    GUIDE_KIND_LABEL[guide.kind],
    `===가이드===`,
    guide.text || "없음",
    `===마무리===`,
    script.closing,
    ...(notes
      ? [
          `===카드키워드===`,
          notes.keywords,
          `===위치근거===`,
          notes.positions,
          `===카드관계===`,
          notes.relations,
          `===결론근거===`,
          notes.basis,
          `===주의점===`,
          notes.cautions,
        ]
      : [`===결론근거===`, script.rationale]),
  ].join("\n");
}

/** Splits a reply on `===label===` delimiter lines. Returns null when no delimiter is found. */
function parseSections<L extends string>(raw: string, labels: readonly L[]): Partial<Record<L, string>> | null {
  const re = new RegExp(`===\\s*(${labels.join("|")})\\s*===`, "g");
  const matches = [...raw.matchAll(re)];
  if (matches.length === 0) return null;

  const sections: Partial<Record<L, string>> = {};
  matches.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : raw.length;
    sections[m[1] as L] = raw.slice(start, end).trim();
  });
  return sections;
}

export function parseCallScript(raw: string): CallScript {
  const s = parseSections(raw, SCRIPT_LABELS);
  if (!s) {
    return { coreConclusion: "", detail: raw.trim(), questionToAsk: "", closing: "", rationale: "" };
  }

  const kind = parseGuideKind(s["가이드유형"]) ?? (s["가이드"] ? "confirm" : undefined);
  const rawGuide = s["가이드"] ?? s["질문"] ?? "";
  const guideText = isNone(rawGuide) ? "" : kind === "close" ? rawGuide : singleQuestion(rawGuide);

  const noteParts = {
    keywords: s["카드키워드"] ?? "",
    positions: s["위치근거"] ?? "",
    relations: s["카드관계"] ?? "",
    basis: s["결론근거"] ?? "",
    cautions: s["주의점"] ?? "",
  };
  const hasNotes = Object.values(noteParts).some(Boolean);
  const rationale = hasNotes
    ? [
        noteParts.keywords && `[카드별 키워드]\n${noteParts.keywords}`,
        noteParts.positions && `[위치별 근거]\n${noteParts.positions}`,
        noteParts.relations && `[카드 간 관계]\n${noteParts.relations}`,
        noteParts.basis && `[결론 근거]\n${noteParts.basis}`,
        noteParts.cautions && `[주의할 점]\n${noteParts.cautions}`,
      ]
        .filter(Boolean)
        .join("\n\n")
    : (s["해석근거"] ?? "");

  return {
    coreConclusion: s["핵심결론"] ?? "",
    detail: s["상세설명"] ?? "",
    questionToAsk: guideText,
    closing: s["마무리"] ?? "",
    rationale,
    guide: kind && (guideText || kind === "close") ? { kind, text: guideText } : undefined,
    notes: hasNotes ? noteParts : undefined,
  };
}

/** Finds the registered spread an AI suggestion names (exact name, or the name before any parenthesis). */
function matchSpreadId(text: string): string | undefined {
  const squash = (t: string) => t.replace(/[\s·—-]/g, "");
  const t = squash(text);
  if (!t) return undefined;
  const byLength = [...SPREADS].sort((a, b) => b.name.length - a.name.length);
  return (
    byLength.find((s) => t.includes(squash(s.name)))?.id ??
    byLength.find((s) => {
      const base = squash(s.name.split("(")[0]);
      return base.length >= 3 && (t.includes(base) || base.startsWith(t));
    })?.id
  );
}

function parseExtraCardSuggestion(text: string | undefined): ExtraCardSuggestion | undefined {
  if (isNone(text)) return undefined;
  const pick = (label: RegExp) => {
    const line = text!.split("\n").find((l) => label.test(l.split(/[:：]/)[0]));
    return line ? line.replace(/^\s*(?:[-·•*]\s*)?[^:：]*[:：]\s*/, "").trim() : "";
  };
  const count = pick(/카드\s*수|장\s*수/);
  const n = parseInt(count.replace(/[^0-9]/g, ""), 10);
  const spread = pick(/스프레드|배열/);
  const kindText = pick(/유형/);
  const spreadId = isNone(spread) ? undefined : matchSpreadId(spread);
  const kind: FollowReadingKind | undefined = /스프레드|배열|새/.test(kindText)
    ? "spread"
    : /보충|카드/.test(kindText)
      ? "supplement"
      : undefined;
  const suggestion: ExtraCardSuggestion = {
    purpose: pick(/목적/),
    question: pick(/추천\s*질문|질문/),
    count,
    spread: isNone(spread) ? "" : spread,
    countNum: Number.isFinite(n) ? Math.min(2, Math.max(1, n)) : 1,
    kind: kind ?? "supplement",
    spreadId: (kind ?? "supplement") === "spread" ? spreadId : undefined,
  };
  return [suggestion.purpose, suggestion.question, suggestion.count, suggestion.spread].some(Boolean)
    ? suggestion
    : undefined;
}

/** Fallback only: the reply text itself offers to draw another card. */
const CARD_OFFER_RE =
  /(카드|한\s*장).{0,12}(더\s*)?뽑아\s*(볼까요|드릴까요|봐요|보면|볼게요|보시겠어요)|추가\s*카드.{0,8}(뽑|보)|(스프레드|배열|카드).{0,8}(새로|다시)?\s*펼쳐\s*(볼까요|드릴까요|봐요|보면)/;

export function parseCallReply(raw: string): CallReply {
  const s = parseSections(raw, REPLY_LABELS);
  if (!s) {
    return {
      answer: raw.trim(),
      rationale: "",
      revision: "",
      newFacts: [],
      nextQuestion: "",
      next: "continue",
      cardProposed: false,
    };
  }

  const revision = s["해석수정"] ?? "";
  const facts = s["새사실"] ?? "";
  const rawQuestion = s["다음질문"] ?? "";
  const nextQuestion = isNone(rawQuestion) ? "" : singleQuestion(rawQuestion);
  const answer = s["할말"] ?? s["답변"] ?? "";
  const proposalField = s["카드제안"];
  const explicitYes = !!proposalField && /^(예|네|yes)/i.test(proposalField.trim());
  const explicitNo = !!proposalField && /^(아니|no)/i.test(proposalField.trim());
  const suggestion = parseExtraCardSuggestion(s["추가카드"]);
  const cardProposed =
    explicitYes || (!explicitNo && (parseNext(s["다음진행"]) === "extra-card" || CARD_OFFER_RE.test(answer)));
  const next = cardProposed ? "extra-card" : parseNext(s["다음진행"]) === "extra-card" ? "continue" : parseNext(s["다음진행"]);
  const qKind = parseGuideKind(s["질문유형"]);
  const conclusion = s["핵심결론"] ?? s["질문답변"];
  const reading =
    s["카드해석"] || s["기존카드관계"] || conclusion
      ? { cards: s["카드해석"] ?? "", relation: s["기존카드관계"] ?? "", directAnswer: conclusion ?? "" }
      : undefined;

  return {
    answer,
    rationale: s["참고메모"] ?? s["근거"] ?? "",
    revision: isNone(revision) ? "" : revision,
    newFacts: isNone(facts)
      ? []
      : facts
          .split("\n")
          .map((line) => line.replace(/^\s*(?:[-·•*]|\d+[.)])\s*/, "").trim())
          .filter((line) => line && !isNone(line)),
    nextQuestion,
    nextQuestionKind: nextQuestion ? (qKind === "close" ? "confirm" : (qKind ?? "confirm")) : undefined,
    next,
    cardProposed,
    extraCardSuggestion: cardProposed
      ? (suggestion ?? { purpose: "", question: "", count: "1장", spread: "", countNum: 1, kind: "supplement" })
      : undefined,
    extraReading: reading,
  };
}

export function parseCallClosing(raw: string): CallClosing {
  const s = parseSections(raw, CLOSING_LABELS);
  const clean = (t: string | undefined) => (isNone(t) ? "" : t!.trim());
  if (!s) {
    return { questionSummary: "", flow: "", confirmed: "", considerations: "", closingLine: raw.trim(), createdAt: new Date().toISOString() };
  }
  return {
    questionSummary: clean(s["질문요약"]),
    flow: clean(s["핵심흐름"]),
    confirmed: clean(s["확인된정보"]),
    considerations: clean(s["현실고려"]),
    closingLine: clean(s["마무리멘트"]),
    createdAt: new Date().toISOString(),
  };
}

function followReadingOf(session: CallSession, r: CallReaction) {
  return r.readingId ? session.followReadings?.find((x) => x.id === r.readingId) : undefined;
}

function cardNames(ids: string[]): string {
  return ids.map((id) => CARDS_BY_ID[id]?.nameKo ?? id).join(", ");
}

/** One-line description of a follow-up reading: its type, spread and cards, with position labels. */
function describeFollowReading(reading: NonNullable<CallSession["followReadings"]>[number]): string {
  if (reading.kind === "spread" && reading.spreadId) {
    const spread = SPREADS_BY_ID[reading.spreadId];
    const cards = spread ? spreadCardLines(spread, reading.placements ?? {}) : [];
    return `[후속 리딩 ${reading.order} · 새 스프레드: ${spread?.name ?? reading.spreadId}] 질문: ${reading.question} / 카드: ${cards
      .map((c) => `${c.position}=${c.card}`)
      .join(", ")}`;
  }
  return `[후속 리딩 ${reading.order} · 보충 카드] 질문: ${reading.question} / 뽑은 카드: ${cardNames(reading.cardIds ?? [])}`;
}

/** How the counselor's input for one turn is shown back to the model. */
function describeTurn(r: CallReaction, session: CallSession): string {
  const reading = followReadingOf(session, r);
  if (reading) return describeFollowReading(reading);
  if (r.kind === "extra-card" && r.extraReading) {
    const names = r.extraReading.cardIds.map((id) => CARDS_BY_ID[id]?.nameKo ?? id).join(", ");
    return `[추가 카드] 질문: ${r.extraReading.question} / 뽑은 카드: ${names}`;
  }
  if (r.kind === "extra-card") return r.question;
  if (r.tags || r.remark !== undefined) {
    return [
      `반응 유형(상담사가 고른 버튼): ${r.tags?.length ? r.tags.join(", ") : "없음"}`,
      `내담자 발언 메모: ${r.remark ? `"${r.remark}"` : "없음"}`,
    ].join("\n");
  }
  return r.question;
}

function serializeCallReaction(r: CallReaction, session: CallSession): string {
  const parts: string[] = [];
  const reading = followReadingOf(session, r);
  if (reading) {
    parts.push(
      `===핵심결론===`,
      reading.result.conclusion,
      `===카드해석===`,
      reading.result.cards,
      `===기존카드관계===`,
      reading.result.relation,
    );
  } else if (r.extraReading) {
    parts.push(
      `===카드해석===`,
      r.extraReading.cards,
      `===기존카드관계===`,
      r.extraReading.relation,
      `===질문답변===`,
      r.extraReading.directAnswer,
    );
  }
  parts.push(`===할말===`, r.answer, `===다음질문===`, r.nextQuestion || "없음");
  if (r.rationale) parts.push(`===참고메모===`, r.rationale);
  if (r.revision) parts.push(`===해석수정===`, r.revision);
  parts.push(`===다음진행===`, NEXT_LABEL[r.next ?? "continue"]);
  parts.push(`===카드제안===`, r.next === "extra-card" ? "예" : "아니오");
  return parts.join("\n");
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * Rebuilds the conversation so far: the original reading, a short summary of older turns, and the
 * most recent turns verbatim. Only this session's data is used.
 */
function buildCallConversationSoFar(
  session: CallSession,
  spread: ReturnType<typeof requireSpread>,
  cards: CallCardLine[],
): ChatMessage[] {
  if (!session.script) {
    throw new Error("먼저 상담 대본을 받은 뒤에 이어서 진행할 수 있어요.");
  }

  const messages: ChatMessage[] = [
    { role: "user", content: buildCallScriptPrompt(session, session.spreadId, spread.name, cards) },
    { role: "assistant", content: serializeCallScript(session.script) },
  ];

  const reactions = session.reactions ?? [];
  const older = reactions.slice(0, Math.max(0, reactions.length - RECENT_TURNS));
  const recent = reactions.slice(older.length);

  if (older.length > 0) {
    messages.push({
      role: "user",
      content: [
        `앞선 상담 내용 요약 (오래된 대화를 줄여서 정리한 것):`,
        ...older.map((r) => {
          const said = r.kind === "extra-card" ? describeTurn(r, session) : (r.remark || r.tags?.join(", ") || r.question);
          return `- ${r.kind === "extra-card" ? "추가 리딩" : "내담자 측"}: ${clip(said, 120)} → 상담사가 한 말: ${clip(r.answer, 70)}${
            r.nextQuestion ? ` (물어본 질문: ${r.nextQuestion})` : ""
          }${r.revision ? ` [해석 수정: ${clip(r.revision, 50)}]` : ""}`;
        }),
      ].join("\n"),
    });
    messages.push({ role: "assistant", content: `네, 앞선 상담 내용을 참고해서 이어가겠습니다.` });
  }

  for (const r of recent) {
    messages.push({ role: "user", content: describeTurn(r, session) });
    messages.push({ role: "assistant", content: serializeCallReaction(r, session) });
  }

  return messages;
}

function askedQuestions(session: CallSession): string[] {
  const asked: string[] = [];
  const guide = session.script?.guide;
  if (guide && guide.kind !== "close" && guide.text) asked.push(guide.text);
  else if (!guide && session.script?.questionToAsk) asked.push(session.script.questionToAsk);
  for (const r of session.reactions ?? []) if (r.nextQuestion) asked.push(r.nextQuestion);
  return asked;
}

function extraCardHistoryLines(session: CallSession): string[] {
  const log = session.extraCardLog ?? [];
  const drawn = log.filter((e) => e.outcome === "drawn").map((e) => e.question);
  const refused = log.filter((e) => e.outcome !== "drawn").map((e) => e.question).filter(Boolean);
  const lines: string[] = [];
  if (drawn.length) lines.push([`이미 후속 리딩을 한 질문 (같은 질문으로 다시 제안하지 마세요):`, ...drawn.map((q) => `· ${q}`)].join("\n"));
  if (refused.length) lines.push([`내담자가 거절했거나 넘어간 후속 리딩 제안 (반복하지 마세요):`, ...refused.map((q) => `· ${q}`)].join("\n"));
  const readings = session.followReadings ?? [];
  if (readings.length) {
    lines.push(
      [
        `이전 후속 리딩 (각각 자기 질문과 자기 스프레드 기준으로 읽은 결과):`,
        ...readings.map((x) => `· ${describeFollowReading(x)} → 결론: ${clip(x.result.conclusion, 90)}`),
      ].join("\n"),
    );
  }
  const last = (session.reactions ?? []).at(-1);
  if (last?.kind === "extra-card" && (last.extraReading || last.readingId)) {
    lines.push(`직전에 후속 리딩을 해석했어요. 완전히 새로운 주제가 아니면 이번에는 카드나 리딩을 또 제안하지 마세요.`);
  }
  return lines;
}

function buildContextBlock(session: CallSession): string {
  const facts = session.facts ?? [];
  const asked = askedQuestions(session);
  const extras = session.extraCards ?? [];
  return [
    `[상담 맥락]`,
    `최초 상담 질문: ${session.session.question || "(질문 없음)"}`,
    facts.length
      ? [`내담자가 실제로 말해서 확인된 사실 (사실로 유지):`, ...facts.map((f) => `· ${f}`)].join("\n")
      : `내담자가 실제로 말해서 확인된 사실: 아직 없음`,
    asked.length
      ? [`이미 한 질문 (다시 묻지 마세요):`, ...asked.map((q) => `· ${q}`)].join("\n")
      : `이미 한 질문: 없음`,
    extras.length
      ? [`보충으로 뽑은 카드 (최초 스프레드 밖):`, ...extras.map((x) => `· ${CARDS_BY_ID[x.cardId]?.nameKo ?? x.cardId} — ${x.label}`)].join("\n")
      : `보충으로 뽑은 카드: 없음`,
    ...extraCardHistoryLines(session),
    `주의: 앞선 AI 해석은 카드가 보여주는 가능성일 뿐 확정된 사실이 아니에요. 내담자의 실제 발언과`,
    `맞지 않으면 해석을 조정하거나 불확실하다고 분명히 말하세요.`,
  ].join("\n");
}

const CALL_REPLY_FORMAT = [
  `아래 형식으로 답해주세요. 구분자 줄은 그대로 쓰고, 앞뒤에 다른 글자를 붙이지 마세요.`,
  ``,
  `===할말===`,
  `(상담사가 지금 바로 소리 내어 읽을 2~3문장, 해요체 구어체. 내담자의 발언을 자연스럽게`,
  `반영하고 기존 카드 해석과 연결하세요. 앞에서 한 설명을 반복하지 마세요.)`,
  `===질문유형===`,
  `(확인 질문 / 심화 질문 / 없음 중 하나. 해석과 실제 상황을 잇는 정보가 부족하면 확인 질문,`,
  `내담자가 새 정보나 중요한 고민을 말했으면 심화 질문, 질문이 필요 없으면 없음)`,
  `===다음질문===`,
  `(꼭 필요할 때만 질문 한 문장. 필요 없으면 "없음")`,
  `===참고메모===`,
  `(상담사만 보는 메모 2~4줄: 이번 답과 관련된 카드, 기존 해석과 연결되는 부분, 수정하거나`,
  `판단을 유보해야 하는 부분. 입력 정보가 부족하면 그 한계를 분명히 적으세요.)`,
  `===해석수정===`,
  `(내담자의 실제 발언이 앞선 해석과 맞지 않을 때만, 어떤 해석을 어떻게 고치거나 유보하는지`,
  `1~2문장. 해당 없으면 "없음")`,
  `===새사실===`,
  `(내담자가 이번에 실제로 말한 사실만 한 줄에 하나씩 짧게. 반응 버튼만으로 사실을 만들지 말고,`,
  `카드 해석이나 추측은 적지 마세요. 이미 확인된 사실은 반복하지 마세요. 없으면 "없음")`,
  `===다음진행===`,
  `(상담 계속 / 추가 카드 검토 / 상담 마무리 가능 중 하나. 상담사에게 주는 권고일 뿐입니다.)`,
  `===카드제안===`,
  `(예 / 아니오. 후속 리딩(카드를 더 뽑거나 새 스프레드를 펼치는 것)을 제안할 때만 "예".`,
  `할말에서 카드를 더 뽑거나 새로 펼쳐보자고 말했다면 반드시 "예", 그렇지 않으면 "아니오")`,
  `===추가카드===`,
  `(카드제안이 "예"일 때만 아래 다섯 줄, 아니면 "없음")`,
  `추천 유형: (보충 카드 / 새 스프레드 중 하나)`,
  `목적: ...`,
  `추천 질문: (후속 리딩으로 확인할 질문 한 문장)`,
  `추천 카드 수: (보충 카드일 때 1 또는 2, 보통 1)`,
  `추천 스프레드: (새 스프레드일 때만 다음 이름 중 하나를 그대로, 아니면 "없음": ${SPREADS.map((s) => s.name).join(" / ")})`,
  ``,
  `진행 판단 기준:`,
  `- 추가 카드 검토는 기존 카드로 답하기 어려운 새 질문이 나왔을 때, 특정 선택의 조건이나`,
  `  장애물을 더 구체적으로 봐야 할 때, 내담자가 확인하고 싶은 주제를 분명히 말했을 때만`,
  `  권하세요. 기존 카드로 충분히 설명할 수 있거나, 같은 질문이 반복되거나, 상담 시간을`,
  `  늘리기 위한 경우에는 권하지 마세요.`,
  `- 기존 리딩의 특정 부분을 보완하면 되는 경우는 "보충 카드", 최초 질문과 다른 새 질문이라 자리`,
  `  의미가 있는 배열이 필요한 경우는 "새 스프레드"를 추천하세요. 추천일 뿐 상담사가 정합니다.`,
  `- 원래 질문에 이미 충분히 답했거나 추가 질문의 필요성이 낮으면 "상담 마무리 가능"을 고르고,`,
  `  질문을 억지로 만들지 마세요.`,
  ``,
  `답변 원칙:`,
  `- 공감 → 기존 카드와 연결 → 직접적인 답 또는 질문이 기본 흐름이지만, 매번 같은 틀이나 같은`,
  `  도입부("그렇군요", "충분히 그럴 수 있어요" 등)를 반복하지 마세요.`,
  `- 입력이 짧거나 반응 유형만 있으면, 구체적인 상황을 지어내지 말고 아는 만큼만 답하세요.`,
  `- 지금 배열된 카드로 답하기 어려운 질문이면 억지로 해석하지 말고 그렇다고 솔직하게 말하세요.`,
  ...CALL_QUESTION_RULES.slice(1),
  ...CALL_READING_RULES.slice(1),
].join("\n");

export async function requestCallScript(session: CallSession): Promise<CallScript> {
  const spread = requireSpread(session.spreadId);
  const apiKey = requireApiKey();
  const cards = buildCallCardLines(session, spread);
  if (cards.length === 0) throw new Error("먼저 카드를 배치해주세요.");

  const prompt = buildCallScriptPrompt(session, session.spreadId, spread.name, cards);
  const raw = await runToCompletion(apiKey, [{ role: "user", content: prompt }]);
  return parseCallScript(raw);
}

export interface CallTurnInput {
  /** Quick reaction buttons the counselor tapped. They hint at the situation; they are not facts. */
  tags: string[];
  /** A short note of what the client said (keywords are fine). */
  remark: string;
}

/** Suggests what the counselor says next, after the counselor logs the client's reaction. */
export async function requestCallFollowUp(session: CallSession, input: CallTurnInput): Promise<CallReply> {
  if (input.tags.length === 0 && !input.remark.trim()) {
    throw new Error("반응 버튼을 고르거나 내담자 발언을 입력해주세요.");
  }
  const spread = requireSpread(session.spreadId);
  const apiKey = requireApiKey();
  const cards = buildCallCardLines(session, spread);
  const messages = buildCallConversationSoFar(session, spread, cards);

  messages.push({
    role: "user",
    content: [
      buildContextBlock(session),
      ``,
      `[이번 상담사 입력]`,
      `반응 유형(상담사가 고른 버튼 — 참고용이며 내담자의 상황을 확정하지 않음): ${
        input.tags.length ? input.tags.join(", ") : "없음"
      }`,
      `내담자 발언 메모: ${input.remark.trim() ? `"${input.remark.trim()}"` : "없음 (버튼만 선택함)"}`,
      ``,
      CALL_REPLY_FORMAT,
    ].join("\n"),
  });

  return parseCallReply(await runToCompletion(apiKey, messages));
}

function followReadingFormat(kind: FollowReadingKind): string {
  return [
    `아래 형식으로 답해주세요. 구분자 줄은 그대로 쓰고, 앞뒤에 다른 글자를 붙이지 마세요.`,
    ``,
    `===핵심결론===`,
    `(후속 질문에 대한 핵심 결론 2~3문장. 첫 문장에서 후속 질문에 직접 답하고, 단정하지 말고 가능성으로)`,
    `===카드해석===`,
    kind === "spread"
      ? `(이번 스프레드의 자리마다 한 줄: "자리: 카드 — 그 자리 의미로 읽은 해석")`
      : `(보충 카드마다 1~2문장, 후속 질문에 비추어 직접 해석)`,
    `===기존카드관계===`,
    `(최초 리딩·이전 상담과 이어지는 부분 1~2문장. 방향이 다르면 다르다고 말하고 이유를 설명)`,
    `===할말===`,
    `(상담사가 지금 바로 읽을 2~3문장, 해요체 구어체)`,
    `===질문유형===`,
    `(확인 질문 / 심화 질문 / 없음)`,
    `===다음질문===`,
    `(꼭 필요할 때만 질문 한 문장, 아니면 "없음")`,
    `===참고메모===`,
    `(상담사만 보는 메모 1~3줄)`,
    `===새사실===`,
    `("없음" 또는 내담자가 실제로 말한 사실)`,
    `===다음진행===`,
    `(상담 계속 / 상담 마무리 가능 중 하나)`,
    `===카드제안===`,
    `아니오`,
    ``,
    `원칙:`,
    `- 반드시 위 "후속 질문"에 먼저 답하세요. 질문을 바꾸거나 넓히지 마세요.`,
    ...(kind === "spread"
      ? [
          `- 이번 스프레드의 자리 의미와 비중만 적용하세요. 최초 스프레드나 이전 후속 리딩의 자리 의미·`,
          `  비중을 섞지 마세요. 이전 리딩의 카드 해석은 참고만 하세요.`,
          `- 이전 리딩과 다른 방향이 나오면 억지로 맞추지 말고, 질문과 자리의 차이 때문에 다르게`,
          `  보일 수 있다고 설명하세요.`,
        ]
      : [
          `- 보충 카드는 최초 리딩의 해당 부분을 보완하는 용도로 읽되, 내담자의 실제 발언과 맞지 않는`,
          `  부분은 조정하세요.`,
        ]),
    `- 이번 응답에서는 카드를 더 뽑거나 다른 스프레드를 펼치자고 제안하지 마세요.`,
    ...CALL_QUESTION_RULES.slice(1),
    ...CALL_READING_RULES.slice(1),
  ].join("\n");
}

export type FollowReadingRequest = Pick<
  ExtraCardFlow,
  "kind" | "question" | "purpose" | "cardIds" | "spreadId" | "placements"
>;

/**
 * Reads a follow-up: supplement cards or a whole new registered spread, always against the stored
 * follow-up question, with the initial reading and conversation as context.
 */
export async function requestFollowReading(session: CallSession, flow: FollowReadingRequest): Promise<CallReply> {
  const kind = flow.kind ?? "supplement";
  if (!flow.question.trim()) throw new Error("후속 질문을 입력해주세요.");
  let readingLines: string[];
  if (kind === "spread") {
    if (!flow.spreadId) throw new Error("새 스프레드를 먼저 골라주세요.");
    const next = requireSpread(flow.spreadId);
    const placements = flow.placements ?? {};
    const missing = next.positions.filter((p) => !p.optional && !placements[p.id]);
    if (missing.length > 0) throw new Error(`아직 카드를 고르지 않은 자리가 ${missing.length}곳 있어요.`);
    readingLines = [
      `[후속 리딩 — 새 스프레드]`,
      `후속 질문: ${flow.question.trim()}`,
      `목적: ${flow.purpose?.trim() || "(상담사가 따로 적지 않음)"}`,
      `새 스프레드: ${next.name} — ${next.summary}`,
      `이번 스프레드의 자리와 카드 (자리: 카드, 이 자리 의미와 비중으로만 읽으세요):`,
      formatCardLines(spreadCardLines(next, placements)),
      ...(CALL_SPREAD_GUIDANCE[next.id] ? [``, ...CALL_SPREAD_GUIDANCE[next.id]] : []),
    ];
  } else {
    if (flow.cardIds.length === 0) throw new Error("보충 카드를 먼저 선택해주세요.");
    readingLines = [
      `[후속 리딩 — 보충 카드]`,
      `후속 질문: ${flow.question.trim()}`,
      `목적: ${flow.purpose?.trim() || "(상담사가 따로 적지 않음)"}`,
      `새로 뽑은 보충 카드 (최초 스프레드 카드와 별개):`,
      ...flow.cardIds.map((id, i) => `보충 카드 ${i + 1}: ${CARDS_BY_ID[id]?.nameKo ?? id}`),
    ];
  }

  const spread = requireSpread(session.spreadId);
  const apiKey = requireApiKey();
  const messages = buildCallConversationSoFar(session, spread, buildCallCardLines(session, spread));
  messages.push({
    role: "user",
    content: [buildContextBlock(session), ``, ...readingLines, ``, followReadingFormat(kind)].join("\n"),
  });

  const reply = parseCallReply(await runToCompletion(apiKey, messages));
  return {
    ...reply,
    cardProposed: false,
    extraCardSuggestion: undefined,
    next: reply.next === "extra-card" ? "continue" : reply.next,
  };
}

/** A 20~30 second wrap-up built only from what was already read and said in this call. */
export async function requestCallClosing(session: CallSession): Promise<CallClosing> {
  const spread = requireSpread(session.spreadId);
  const apiKey = requireApiKey();
  const cards = buildCallCardLines(session, spread);
  const messages = buildCallConversationSoFar(session, spread, cards);

  messages.push({
    role: "user",
    content: [
      buildContextBlock(session),
      ``,
      `[상담 마무리]`,
      `상담사가 상담을 마무리하려고 해요. 지금까지의 상담 내용만으로 마무리 대본을 써주세요.`,
      `상담사가 아래 다섯 부분을 순서대로 이어서 읽으면 20~30초가 되도록, 전체를 공백 포함`,
      `150~220자 안팎으로 맞춰주세요. 각 부분은 한 문장, 마무리멘트만 1~2문장입니다.`,
      ``,
      `===질문요약===`,
      `(내담자의 최초 질문을 한 문장으로)`,
      `===핵심흐름===`,
      `(카드에서 나타난 핵심 흐름 한 문장)`,
      `===확인된정보===`,
      `(상담 중 내담자가 실제로 말해 확인된 중요한 정보 한 문장. 없으면 "없음")`,
      `===현실고려===`,
      `(현실적으로 고려할 점 한 문장)`,
      `===마무리멘트===`,
      `(자연스러운 마무리 인사 1~2문장)`,
      ``,
      `마무리 원칙:`,
      `- 마무리 단계에서 새로운 해석이나 근거 없는 예측을 추가하지 마세요.`,
      `- 카드가 보여준 가능성과 내담자가 실제로 말한 사실을 섞지 마세요.`,
      `- 상담사가 그대로 읽을 수 있는 해요체 구어체로 쓰고, 마크다운은 쓰지 마세요.`,
    ].join("\n"),
  });

  return parseCallClosing(await runToCompletion(apiKey, messages));
}
