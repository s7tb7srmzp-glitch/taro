import type { Connect } from "vite";

interface CardPosition {
  position: string;
  card: string;
}

interface InterpretRequestBody {
  querentName?: string;
  question?: string;
  date?: string;
  spreadName?: string;
  cards?: CardPosition[];
}

function buildPrompt(body: InterpretRequestBody): string {
  const { querentName, question, date, spreadName, cards = [] } = body;

  const cardLines = cards.map((c) => `- ${c.position}: ${c.card}`).join("\n");

  return [
    `당신은 따뜻하고 신중한 타로 상담사입니다. 아래 리딩을 해석해주세요.`,
    ``,
    `내담자: ${querentName || "익명"}`,
    `날짜: ${date || "미상"}`,
    `질문: ${question || "(질문 없음)"}`,
    `스프레드: ${spreadName || "미상"}`,
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

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY가 설정되어 있지 않습니다. .env 파일에 키를 추가해주세요.",
    );
  }
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Claude API 오류 (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Claude 응답에서 해석 텍스트를 찾지 못했습니다.");
  return text;
}

export function interpretHandler(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (req.method !== "POST") {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      res.setHeader("content-type", "application/json");
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        const body: InterpretRequestBody = raw ? JSON.parse(raw) : {};
        const prompt = buildPrompt(body);
        const interpretation = await callClaude(prompt);
        res.statusCode = 200;
        res.end(JSON.stringify({ interpretation }));
      } catch (err) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.",
          }),
        );
      }
    });
  };
}
