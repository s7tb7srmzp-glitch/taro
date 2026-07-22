import type { Reading } from "./types";
import { SPREADS_BY_ID } from "../data/spreads";
import { CARDS_BY_ID } from "../data/cards";
import { getApiKey } from "./settings";

const ANTHROPIC_MODEL = "claude-sonnet-5";

function buildPrompt(reading: Reading, spreadName: string, cards: { position: string; card: string }[]): string {
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

export async function requestInterpretation(reading: Reading): Promise<string> {
  const spread = SPREADS_BY_ID[reading.spreadId];
  if (!spread) throw new Error("알 수 없는 스프레드입니다.");

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API 키가 설정되어 있지 않습니다. 설정에서 Anthropic API 키를 먼저 등록해주세요.");
  }

  const cards = spread.positions
    .filter((p) => reading.placements[p.id])
    .map((p) => {
      const card = CARDS_BY_ID[reading.placements[p.id]];
      return { position: p.label, card: card?.nameKo ?? "?" };
    });

  type ChatMessage = { role: "user" | "assistant"; content: string };

  async function callClaude(messages: ChatMessage[]): Promise<{ text: string; truncated: boolean }> {
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
      throw new Error(`해석 요청 실패 (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
      stop_reason?: string;
    };
    const text = data.content?.find((b) => b.type === "text")?.text;
    if (!text) throw new Error("Claude 응답에서 해석 텍스트를 찾지 못했습니다.");
    return { text, truncated: data.stop_reason === "max_tokens" };
  }

  const prompt = buildPrompt(reading, spread.name, cards);
  const messages: ChatMessage[] = [{ role: "user", content: prompt }];
  let fullText = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    const { text, truncated } = await callClaude(messages);
    fullText += text;
    if (!truncated) break;
    messages.push({ role: "assistant", content: text });
    messages.push({ role: "user", content: "이어서 계속 써주세요." });
  }

  return fullText;
}
