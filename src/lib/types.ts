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
  createdAt: string;
}

export interface CallReply {
  answer: string;
  rationale: string;
  revision: string;
  newFacts: string[];
}
