import type { CallExtraCard, CallReaction, CallReply, CallScript, CallSession, Reading } from "./types";
import { SPREADS_BY_ID } from "../data/spreads";
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

const SCRIPT_LABELS = ["핵심결론", "상세설명", "질문", "마무리", "해석근거"] as const;
const REPLY_LABELS = ["답변", "근거", "해석수정", "새사실"] as const;

type CallCardLine = { position: string; weight: number; card: string };

function requireSpread(spreadId: string) {
  const spread = SPREADS_BY_ID[spreadId];
  if (!spread) throw new Error("알 수 없는 스프레드입니다.");
  return spread;
}

function buildCallCardLines(session: CallSession, spread: ReturnType<typeof requireSpread>): CallCardLine[] {
  return spread.positions
    .filter((p) => session.placements[p.id])
    .map((p) => {
      const card = CARDS_BY_ID[session.placements[p.id]];
      return { position: p.label, weight: p.weight ?? 2, card: card?.nameKo ?? "?" };
    });
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
  `- 결과 자리 카드가 긍정적이어도 과정·장애 자리에 어려움이 보이면 반드시 함께 설명하세요.`,
  `- 부정적인 의미의 카드를 억지로 긍정적으로 바꾸지 마세요. 어려움은 어려움대로 말하고,`,
  `  어떻게 대처할 수 있는지를 덧붙이세요.`,
  `- "다 잘될 거예요" 같은 막연하고 뭉뚱그린 위로를 반복하지 마세요.`,
  `- 카드에 나타나지 않은 사실이나 내담자·상대방의 감정을 단정하지 마세요. 상대방의 마음이나`,
  `  미래는 "~일 가능성이 보여요"처럼 가능성과 경향으로 표현하세요.`,
  `- 의료·법률·재정적 결정을 대신 내리지 말고, 필요하면 전문가 상담을 권하세요.`,
  `- 마크다운 문법(#, *, -, --- 등)을 쓰지 말고 일반 텍스트와 줄바꿈만 사용하세요.`,
];

function buildCallScriptPrompt(session: CallSession, spreadId: string, spreadName: string, cards: CallCardLine[]): string {
  const cardLines = cards
    .map((c) => `- ${c.position} (비중 ${c.weight}/3, 3이 핵심): ${c.card}`)
    .join("\n");
  const guidance = CALL_SPREAD_GUIDANCE[spreadId];

  return [
    `당신은 숙련된 타로 상담사가 전화 상담 중인 초보 상담사를 실시간으로 돕는 보조 도구입니다.`,
    `상담사는 지금 실제 내담자와 전화 통화 중이며, 당신이 쓴 문장을 그대로 소리 내어 읽습니다.`,
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
    `(전화로 15초 안에 말할 분량: 2~3문장, 공백 포함 80~100자 안팎. 첫 문장에서 질문에 대한`,
    `답을 바로 말하세요. 인사나 배경 설명으로 시작하지 마세요. 과정에 어려움이 있다면 한 문장으로`,
    `함께 언급하세요.)`,
    `===상세설명===`,
    `(1분 분량, 공백 포함 300~400자 안팎. 비중이 높은 자리를 중심으로 카드들 사이의 관계와`,
    `흐름을 연결해서 설명하세요.)`,
    `===질문===`,
    `(상담사가 내담자에게 되물어서 상담을 더 구체적으로 만들 수 있는 질문 1~2개.)`,
    `===마무리===`,
    `(상담을 자연스럽게 마무리하는 멘트 1~2문장.)`,
    `===해석근거===`,
    `(왜 이렇게 해석했는지 설명하는 학습 노트. 상담사가 읽는 대본이 아니라 상담사 본인의`,
    `학습용입니다. 어떤 자리의 어떤 카드를 중심축으로 삼았는지, 카드 간 관계를 어떻게`,
    `읽었는지, 어려운 카드를 어떻게 다뤘는지 구체적으로 설명하세요.)`,
    ``,
    ...CALL_READING_RULES,
    `- "핵심결론"/"상세설명"/"질문"/"마무리"는 상담사가 그대로 소리 내어 읽을 자연스러운`,
    `  구어체(해요체)로 작성하세요. "해석근거"만 설명조로 써도 됩니다.`,
  ].join("\n");
}

function serializeCallScript(script: CallScript): string {
  return [
    `===핵심결론===`,
    script.coreConclusion,
    `===상세설명===`,
    script.detail,
    `===질문===`,
    script.questionToAsk,
    `===마무리===`,
    script.closing,
    `===해석근거===`,
    script.rationale,
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

function parseCallScript(raw: string): CallScript {
  const s = parseSections(raw, SCRIPT_LABELS);
  if (!s) {
    return { coreConclusion: "", detail: raw.trim(), questionToAsk: "", closing: "", rationale: "" };
  }
  return {
    coreConclusion: s["핵심결론"] ?? "",
    detail: s["상세설명"] ?? "",
    questionToAsk: s["질문"] ?? "",
    closing: s["마무리"] ?? "",
    rationale: s["해석근거"] ?? "",
  };
}

function isNone(text: string): boolean {
  return /^(없음|해당\s*없음|없습니다)\.?$/.test(text.trim());
}

export function parseCallReply(raw: string): CallReply {
  const s = parseSections(raw, REPLY_LABELS);
  if (!s) return { answer: raw.trim(), rationale: "", revision: "", newFacts: [] };

  const revision = s["해석수정"] ?? "";
  const facts = s["새사실"] ?? "";
  return {
    answer: s["답변"] ?? "",
    rationale: s["근거"] ?? "",
    revision: isNone(revision) ? "" : revision,
    newFacts: isNone(facts)
      ? []
      : facts
          .split("\n")
          .map((line) => line.replace(/^\s*(?:[-·•*]|\d+[.)])\s*/, "").trim())
          .filter((line) => line && !isNone(line)),
  };
}

/** Rebuilds the conversation so far (original script prompt + reply + prior live reactions),
 * so a new reaction or extra card draw is answered with full context. */
function serializeCallReaction(r: CallReaction): string {
  const parts = [`===답변===`, r.answer];
  if (r.rationale) parts.push(`===근거===`, r.rationale);
  if (r.revision) parts.push(`===해석수정===`, r.revision);
  return parts.join("\n");
}

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

  for (const r of session.reactions ?? []) {
    messages.push({ role: "user", content: r.question });
    messages.push({ role: "assistant", content: serializeCallReaction(r) });
  }

  return messages;
}

function buildFactsBlock(facts: string[] | undefined): string {
  if (!facts || facts.length === 0) return `상담 중 확인된 사실: 아직 없음`;
  return [`상담 중 확인된 사실 (모두 사실로 유지하세요):`, ...facts.map((f) => `· ${f}`)].join("\n");
}

const CALL_REPLY_FORMAT = [
  `아래 형식으로 답해주세요. 구분자 줄은 그대로 쓰고, 앞뒤에 다른 글자를 붙이지 마세요.`,
  ``,
  `===답변===`,
  `(상담사가 바로 소리 내어 읽을 2~4문장, 해요체 구어체)`,
  `===근거===`,
  `(왜 이렇게 답했는지 1~2문장 학습 노트. 어떤 자리의 어떤 카드를 근거로 했는지.)`,
  `===해석수정===`,
  `(내담자의 새 발언이 앞선 해석과 맞지 않을 때만, 어떤 해석을 어떻게 고치는지 1~2문장.`,
  `해당 없으면 "없음")`,
  `===새사실===`,
  `(이번 발언에서 새로 확인된 사실만 한 줄에 하나씩 짧게. 카드 해석이 아니라 내담자가 직접`,
  `말한 사실만 적고, 이미 확인된 사실은 반복하지 마세요. 없으면 "없음")`,
  ``,
  `답변 원칙:`,
  `- 기본 흐름은 "공감 → 기존 카드와 연결 → 직접적인 답 또는 되묻는 질문"이지만, 매번 세`,
  `  요소를 다 넣거나 같은 순서로 쓰지 마세요. 앞선 답변과 같은 도입부("그렇군요", "충분히`,
  `  그럴 수 있어요" 등)를 반복하지 마세요.`,
  `- 앞선 대화와 확인된 사실은 계속 유지하세요. 새 사실이 앞선 해석과 충돌하면 고집하지 말고`,
  `  답변에서 자연스럽게 바로잡은 뒤 ===해석수정===에 기록하세요.`,
  `- 지금 배열된 카드로 답하기 어려운 질문이면 억지로 해석하지 마세요. 그렇다고 솔직하게`,
  `  말하고, 카드를 한 장 더 뽑아보거나 내담자에게 되물어보자고 제안하세요.`,
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

/** A client's live remark during the call; returns a 2~4 sentence reply plus study notes. */
export async function requestCallFollowUp(session: CallSession, reaction: string): Promise<CallReply> {
  const spread = requireSpread(session.spreadId);
  const apiKey = requireApiKey();
  const cards = buildCallCardLines(session, spread);
  const messages = buildCallConversationSoFar(session, spread, cards);

  messages.push({
    role: "user",
    content: [
      buildFactsBlock(session.facts),
      ``,
      `내담자가 통화 중 이렇게 말했어요: "${reaction}"`,
      ``,
      CALL_REPLY_FORMAT,
    ].join("\n"),
  });

  return parseCallReply(await runToCompletion(apiKey, messages));
}

/** Links a card drawn mid-call to the existing reading; returns a 2~4 sentence reply plus study notes. */
export async function requestExtraCardLink(session: CallSession, extraCard: CallExtraCard): Promise<CallReply> {
  const spread = requireSpread(session.spreadId);
  const apiKey = requireApiKey();
  const cards = buildCallCardLines(session, spread);
  const messages = buildCallConversationSoFar(session, spread, cards);

  const card = CARDS_BY_ID[extraCard.cardId];
  messages.push({
    role: "user",
    content: [
      buildFactsBlock(session.facts),
      ``,
      `상담 중 카드를 한 장 더 뽑았어요: ${card?.nameKo ?? "?"}`,
      `뽑은 이유/질문: ${extraCard.label}`,
      `이 카드는 "추가 카드" 자리입니다. 기존 배열의 자리·카드들과의 관계 속에서 이 질문에`,
      `답하되, 기존 해석을 뒤집기보다 보완하는 용도로 읽어주세요.`,
      ``,
      CALL_REPLY_FORMAT,
    ].join("\n"),
  });

  return parseCallReply(await runToCompletion(apiKey, messages));
}
