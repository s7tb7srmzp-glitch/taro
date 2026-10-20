export interface SessionInfo {
  querentName: string;
  question: string;
  /** ISO date string (yyyy-mm-dd) */
  date: string;
}

export interface FollowUp {
  question: string;
  answer: string;
}

export interface Reading {
  id: string;
  session: SessionInfo;
  spreadId: string;
  /** positionId -> cardId */
  placements: Record<string, string>;
  interpretation?: string;
  /** Follow-up Q&A asked about the interpretation, in order. */
  followUps?: FollowUp[];
  /** Free-text note the user writes themselves, separate from the AI interpretation. */
  userComment?: string;
  createdAt: string;
}

/** The structured phone-consultation script generated for a counselor mid-call. */
export interface CallScript {
  /** ~15 seconds: the one or two sentences the counselor leads with. */
  coreConclusion: string;
  /** ~1 minute: fuller explanation weaving position weight and card relationships. */
  detail: string;
  /** Question(s) to ask the client back. */
  questionToAsk: string;
  /** Closing remarks. */
  closing: string;
  /** Why it was interpreted this way — study notes, not meant to be read aloud. */
  rationale: string;
  /** What the counselor should do next. Absent on scripts saved before this existed. */
  guide?: CallGuide;
  /** Structured study notes. Absent on scripts saved before this existed (use `rationale`). */
  notes?: CallNotes;
}

/** "확인 질문" | "심화 질문" | "상담 마무리" */
export type CallGuideKind = "confirm" | "deepen" | "close";

export interface CallGuide {
  kind: CallGuideKind;
  text: string;
}

export interface CallNotes {
  keywords: string;
  positions: string;
  relations: string;
  basis: string;
  cautions: string;
}

/** AI's recommendation for the counselor; the counselor decides. */
export type CallNext = "continue" | "extra-card" | "close";

export interface ExtraCardSuggestion {
  purpose: string;
  question: string;
  count: string;
  spread: string;
  /** Parsed card count (1~3); absent on suggestions saved before this existed. */
  countNum?: number;
}

/**
 * Where an extra-card draw currently stands. No flow (undefined) means normal consultation.
 * proposed → accepted → selecting → selected → interpreting → (back to normal)
 */
export type ExtraFlowStatus = "proposed" | "accepted" | "selecting" | "selected" | "interpreting";

export interface ExtraCardFlow {
  id: string;
  status: ExtraFlowStatus;
  source: "ai" | "manual";
  /** The question the extra cards answer. Fixed once accepted unless the counselor edits it. */
  question: string;
  purpose: string;
  count: number;
  spread: string;
  /** Cards picked so far, in order. Kept across cancel, API errors and reloads. */
  cardIds: string[];
  /** How the client's acceptance was registered. */
  acceptedBy?: "button" | "remark";
  error?: string;
}

/** History of every extra-card proposal and what became of it. */
export interface ExtraCardLogEntry {
  id: string;
  question: string;
  purpose?: string;
  source: "ai" | "manual";
  outcome: "drawn" | "declined" | "dismissed";
  acceptedBy?: "button" | "remark";
  cardIds?: string[];
  at: string;
}

/** The structured part of an extra-card reading. */
export interface ExtraCardReading {
  question: string;
  cardIds: string[];
  cards: string;
  relation: string;
  directAnswer: string;
}

/** The 20~30 second wrap-up generated when the counselor ends the call. */
export interface CallClosing {
  questionSummary: string;
  flow: string;
  confirmed: string;
  considerations: string;
  closingLine: string;
  createdAt: string;
}

/** A card drawn mid-call outside the original spread, linked back to the existing reading. */
export interface CallExtraCard {
  id: string;
  cardId: string;
  /** Why the counselor drew it (e.g. "다음 달은 어떨까요?"). */
  label: string;
  /** AI's short note connecting this card to the existing script. */
  note?: string;
}

/** One live exchange in a call: the client's remark (or an extra card draw) and the reply to read aloud. */
export interface CallReaction extends FollowUp {
  /** Short study note on why the reply was given — not read aloud. */
  rationale?: string;
  /** Present when the reply corrects an earlier interpretation in light of new facts. */
  revision?: string;
  kind?: "reaction" | "extra-card";
  /** Quick reaction buttons the counselor tapped (e.g. "해석 불일치"). */
  tags?: string[];
  /** What the counselor typed about the client's remark, without the tags. */
  remark?: string;
  /** At most one follow-up question; absent when no question is needed. */
  nextQuestion?: string;
  nextQuestionKind?: CallGuideKind;
  next?: CallNext;
  extraCardSuggestion?: ExtraCardSuggestion;
  /** Set when an AI card proposal was not shown because it repeated an earlier one. */
  proposalSuppressed?: string;
  extraReading?: ExtraCardReading;
}

export interface CallSession {
  id: string;
  session: SessionInfo;
  spreadId: string;
  /** positionId -> cardId */
  placements: Record<string, string>;
  script?: CallScript;
  /** Client reactions/questions asked live and the short replies given, in order. */
  reactions?: CallReaction[];
  extraCards?: CallExtraCard[];
  /** Facts the client confirmed during the call, carried into every later reply. */
  facts?: string[];
  closing?: CallClosing;
  extraFlow?: ExtraCardFlow;
  extraCardLog?: ExtraCardLogEntry[];
  createdAt: string;
}

export interface CallReply {
  /** What the counselor says now (2~3 sentences). */
  answer: string;
  /** Counselor memo: related cards, links to the reading, what to revise or hold back, info limits. */
  rationale: string;
  revision: string;
  newFacts: string[];
  nextQuestion: string;
  nextQuestionKind?: CallGuideKind;
  next: CallNext;
  extraCardSuggestion?: ExtraCardSuggestion;
  /** True when the AI proposed drawing more cards (structured field, with a text fallback). */
  cardProposed: boolean;
  extraReading?: Omit<ExtraCardReading, "question" | "cardIds">;
}
