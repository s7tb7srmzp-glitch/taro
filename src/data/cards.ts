export type Arcana = "major" | "court" | "pip";
export type Suit = "wands" | "cups" | "swords" | "pentacles";

export interface CardDef {
  id: string;
  nameKo: string;
  nameEn: string;
  arcana: Arcana;
  suit?: Suit;
  /** Major arcana: 0-21. Pip: 1(Ace)-10. Court: undefined (see rank). */
  number?: number;
  rank?: "page" | "knight" | "queen" | "king";
  /** Path under /public where a real card image can be dropped in later. */
  imagePath: string;
}

const MAJOR_NAMES: [string, string][] = [
  ["바보", "The Fool"],
  ["마법사", "The Magician"],
  ["여사제", "The High Priestess"],
  ["여황제", "The Empress"],
  ["황제", "The Emperor"],
  ["교황", "The Hierophant"],
  ["연인", "The Lovers"],
  ["전차", "The Chariot"],
  ["힘", "Strength"],
  ["은둔자", "The Hermit"],
  ["운명의 수레바퀴", "Wheel of Fortune"],
  ["정의", "Justice"],
  ["매달린 사람", "The Hanged Man"],
  ["죽음", "Death"],
  ["절제", "Temperance"],
  ["악마", "The Devil"],
  ["탑", "The Tower"],
  ["별", "The Star"],
  ["달", "The Moon"],
  ["태양", "The Sun"],
  ["심판", "Judgement"],
  ["세계", "The World"],
];

const SUITS: { suit: Suit; nameKo: string; nameEn: string }[] = [
  { suit: "wands", nameKo: "완즈", nameEn: "Wands" },
  { suit: "cups", nameKo: "컵", nameEn: "Cups" },
  { suit: "swords", nameKo: "소드", nameEn: "Swords" },
  { suit: "pentacles", nameKo: "펜타클", nameEn: "Pentacles" },
];

const COURT_RANKS: { rank: "page" | "knight" | "queen" | "king"; nameKo: string; nameEn: string }[] = [
  { rank: "page", nameKo: "시종", nameEn: "Page" },
  { rank: "knight", nameKo: "기사", nameEn: "Knight" },
  { rank: "queen", nameKo: "여왕", nameEn: "Queen" },
  { rank: "king", nameKo: "왕", nameEn: "King" },
];

const PIP_NUMBER_NAMES: [string, string][] = [
  ["에이스", "Ace"],
  ["2", "Two"],
  ["3", "Three"],
  ["4", "Four"],
  ["5", "Five"],
  ["6", "Six"],
  ["7", "Seven"],
  ["8", "Eight"],
  ["9", "Nine"],
  ["10", "Ten"],
];

const CARDS_BASE = `${import.meta.env.BASE_URL}cards/`;

const majorCards: CardDef[] = MAJOR_NAMES.map(([nameKo, nameEn], number) => ({
  id: `major-${String(number).padStart(2, "0")}`,
  nameKo: `${number}. ${nameKo}`,
  nameEn,
  arcana: "major",
  number,
  imagePath: `${CARDS_BASE}major-${String(number).padStart(2, "0")}.jpg`,
}));

const courtCards: CardDef[] = SUITS.flatMap(({ suit, nameKo: suitKo, nameEn: suitEn }) =>
  COURT_RANKS.map(({ rank, nameKo: rankKo, nameEn: rankEn }) => ({
    id: `court-${suit}-${rank}`,
    nameKo: `${suitKo} ${rankKo}`,
    nameEn: `${rankEn} of ${suitEn}`,
    arcana: "court" as Arcana,
    suit,
    rank,
    imagePath: `${CARDS_BASE}court-${suit}-${rank}.jpg`,
  })),
);

const pipCards: CardDef[] = SUITS.flatMap(({ suit, nameKo: suitKo, nameEn: suitEn }) =>
  PIP_NUMBER_NAMES.map(([numKo, numEn], idx) => ({
    id: `pip-${suit}-${String(idx + 1).padStart(2, "0")}`,
    nameKo: `${suitKo} ${numKo}`,
    nameEn: `${numEn} of ${suitEn}`,
    arcana: "pip" as Arcana,
    suit,
    number: idx + 1,
    imagePath: `${CARDS_BASE}pip-${suit}-${String(idx + 1).padStart(2, "0")}.jpg`,
  })),
);

export const ALL_CARDS: CardDef[] = [...majorCards, ...courtCards, ...pipCards];

export const CARDS_BY_ID: Record<string, CardDef> = Object.fromEntries(
  ALL_CARDS.map((c) => [c.id, c]),
);

export const SUIT_LABELS: Record<Suit, { ko: string; en: string; symbol: string }> = {
  wands: { ko: "완즈", en: "Wands", symbol: "🔥" },
  cups: { ko: "컵", en: "Cups", symbol: "💧" },
  swords: { ko: "소드", en: "Swords", symbol: "⚔" },
  pentacles: { ko: "펜타클", en: "Pentacles", symbol: "☆" },
};
