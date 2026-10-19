import type { CallExtraCard, CallScript, CallSession, Reading } from "./types";
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

const CALL_SECTION_LABELS = ["핵심결론", "상세설명", "질문", "마무리", "해석근거"] as const;

function buildCallCardLines(session: CallSession, spread: ReturnType<typeof requireSpread>) {
  return spread.positions
    .filter((p) => session.placements[p.id])
    .map((p) => {
      const card = CARDS_BY_ID[session.placements[p.id]];
      return { position: p.label, weight: p.weight ?? 2, card: card?.nameKo ?? "?" };
    });
}

function requireSpread(spreadId: string) {
  const spread = SPREADS_BY_ID[spreadId];
  if (!spread) throw new Error("알 수 없는 스프레드입니다.");
  return spread;
}

function buildCallScriptPrompt(
  session: CallSession,
  spreadName: string,
  cards: { position: string; weight: number; card: string }[],
): string {
  const cardLines = cards
    .map((c) => `- ${c.position} (비중 ${c.weight}/3, 3이 핵심): ${c.card}`)
    .join("\n");

  return [
    `당신은 숙련된 타로 상담사가 전화 상담 중인 초보 상담사를 실시간으로 돕는 보조 도구입니다.`,
    `상담사는 지금 실제 내담자와 전화 통화 중이며, 당신이 쓴 문장을 그대로 소리 내어 읽습니다.`,
    ``,
    `내담자: ${session.session.querentName || "익명"}`,
    `날짜: ${session.session.date || "미상"}`,
    `상담 질문: ${session.session.question || "(질문 없음)"}`,
    `스프레드: ${spreadName}`,
    ``,
    `배치된 카드:`,
    cardLines,
    ``,
    `다음 형식을 정확히 지켜서, 구분자 줄을 그대로 포함해 작성해주세요 (구분자 앞뒤에 다른`,
    `글자를 붙이지 마세요):`,
    ``,
    `===핵심결론===`,
    `(통화를 시작하자마자 15초 안에 말할 수 있는 1~2문장. 질문에 대한 가장 중요한 결론만.)`,
    `===상세설명===`,
    `(이어서 1분 정도 분량. 비중이 높은 포지션을 중심으로, 카드들 사이의 관계와 흐름을`,
    `연결해서 설명하세요.)`,
    `===질문===`,
    `(상담사가 내담자에게 되물어서 상담을 더 풍부하게 만들 수 있는 질문 1~2개.)`,
    `===마무리===`,
    `(상담을 자연스럽게 마무리하는 멘트 1~2문장.)`,
    `===해석근거===`,
    `(위 내용을 왜 이렇게 해석했는지 설명하는 학습 노트. 이 부분은 상담사가 읽는 대본이`,
    `아니라 상담사 본인의 학습을 위한 것임을 기억하고, 포지션 비중과 카드 간 관계를 어떻게`,
    `반영했는지 구체적으로 설명하세요.)`,
    ``,
    `작성 규칙:`,
    `- "핵심결론"/"상세설명"/"질문"/"마무리"는 상담사가 그대로 소리 내어 읽을 자연스러운`,
    `  구어체(해요체)로 작성하세요. "해석근거"만 설명조로 써도 됩니다.`,
    `- 모든 카드가 좋다거나 "다 잘될 거예요" 같은 막연하고 뭉뚱그린 위로를 반복하지 마세요.`,
    `  카드가 암시하는 긴장, 갈등, 주의할 지점이 있다면 정직하게 짚어주세요.`,
    `- 상대방(제3자)의 실제 마음이나 미래에 벌어질 일을 단정적인 사실처럼 말하지 마세요.`,
    `  "~일 수 있어요", "~한 가능성이 보여요"처럼 가능성과 경향으로 표현하세요.`,
    `- 내담자의 질문이 의료·법률·재정적인 결정을 요구한다면, 그 결정을 대신 내려주지 말고`,
    `  전문가와 상담해보시라고 자연스럽게 안내하는 문장을 포함하세요.`,
    `- 마크다운 문법(#, *, -, --- 등)을 쓰지 말고 일반 텍스트와 줄바꿈만 사용하세요.`,
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

function parseCallScript(raw: string): CallScript {
  const re = new RegExp(`===\\s*(${CALL_SECTION_LABELS.join("|")})\\s*===`, "g");
  const matches = [...raw.matchAll(re)];

  if (matches.length === 0) {
    return { coreConclusion: "", detail: raw.trim(), questionToAsk: "", closing: "", rationale: "" };
  }

  const sections: Record<string, string> = {};
  matches.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : raw.length;
    sections[m[1]] = raw.slice(start, end).trim();
  });

  return {
    coreConclusion: sections["핵심결론"] ?? "",
    detail: sections["상세설명"] ?? "",
    questionToAsk: sections["질문"] ?? "",
    closing: sections["마무리"] ?? "",
    rationale: sections["해석근거"] ?? "",
  };
}

/** Rebuilds the conversation so far (original script prompt + reply + prior live reactions),
 * so a new reaction or extra card draw is answered with full context. */
function buildCallConversationSoFar(
  session: CallSession,
  spread: ReturnType<typeof requireSpread>,
  cards: { position: string; weight: number; card: string }[],
): ChatMessage[] {
  if (!session.script) {
    throw new Error("먼저 상담 스크립트를 받은 뒤에 이어서 진행할 수 있어요.");
  }

  const messages: ChatMessage[] = [
    { role: "user", content: buildCallScriptPrompt(session, spread.name, cards) },
    { role: "assistant", content: serializeCallScript(session.script) },
  ];

  for (const r of session.reactions ?? []) {
    messages.push({ role: "user", content: r.question });
    messages.push({ role: "assistant", content: r.answer });
  }

  return messages;
}

const CALL_REPLY_RULES = [
  `상담사가 바로 이어서 읽을 수 있도록 2~4문장으로 답해주세요. 구어체(해요체)로, 마크다운`,
  `없이 작성하고, 제3자의 마음/미래를 단정하거나 의료·법률·재정 결정을 대신 내리지 마세요.`,
].join("\n");

export async function requestCallScript(session: CallSession): Promise<CallScript> {
  const spread = requireSpread(session.spreadId);
  const apiKey = requireApiKey();
  const cards = buildCallCardLines(session, spread);
  if (cards.length === 0) throw new Error("먼저 카드를 배치해주세요.");

  const prompt = buildCallScriptPrompt(session, spread.name, cards);
  const raw = await runToCompletion(apiKey, [{ role: "user", content: prompt }]);
  return parseCallScript(raw);
}

/** A client's live reaction/question during the call; returns a short 2~4 sentence reply. */
export async function requestCallFollowUp(session: CallSession, reaction: string): Promise<string> {
  const spread = requireSpread(session.spreadId);
  const apiKey = requireApiKey();
  const cards = buildCallCardLines(session, spread);
  const messages = buildCallConversationSoFar(session, spread, cards);

  messages.push({
    role: "user",
    content: [`내담자가 통화 중 이렇게 반응하거나 질문했어요: "${reaction}"`, ``, CALL_REPLY_RULES].join("\n"),
  });

  return runToCompletion(apiKey, messages);
}

/** Links a card drawn mid-call to the existing script; returns a short 2~4 sentence note. */
export async function requestExtraCardLink(session: CallSession, extraCard: CallExtraCard): Promise<string> {
  const spread = requireSpread(session.spreadId);
  const apiKey = requireApiKey();
  const cards = buildCallCardLines(session, spread);
  const messages = buildCallConversationSoFar(session, spread, cards);

  const card = CARDS_BY_ID[extraCard.cardId];
  messages.push({
    role: "user",
    content: [
      `상담 중 카드를 한 장 더 뽑았어요: ${card?.nameKo ?? "?"}`,
      `추가로 뽑은 이유/질문: ${extraCard.label}`,
      ``,
      `이 카드를 기존 스프레드 해석과 연결해서 답해주세요.`,
      CALL_REPLY_RULES,
    ].join("\n"),
  });

  return runToCompletion(apiKey, messages);
}
