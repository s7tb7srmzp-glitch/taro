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
