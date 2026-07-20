import type { Reading } from "./types";
import { SPREADS_BY_ID } from "../data/spreads";
import { CARDS_BY_ID } from "../data/cards";

export async function requestInterpretation(reading: Reading): Promise<string> {
  const spread = SPREADS_BY_ID[reading.spreadId];
  if (!spread) throw new Error("알 수 없는 스프레드입니다.");

  const cards = spread.positions
    .filter((p) => reading.placements[p.id])
    .map((p) => {
      const card = CARDS_BY_ID[reading.placements[p.id]];
      return { position: p.label, card: card?.nameKo ?? "?" };
    });

  const res = await fetch("/api/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      querentName: reading.session.querentName,
      question: reading.session.question,
      date: reading.session.date,
      spreadName: spread.name,
      cards,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `해석 요청 실패 (${res.status})`);
  }

  const data = await res.json();
  return data.interpretation as string;
}
