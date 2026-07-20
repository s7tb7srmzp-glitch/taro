export interface SessionInfo {
  querentName: string;
  question: string;
  /** ISO date string (yyyy-mm-dd) */
  date: string;
}

export interface Reading {
  id: string;
  session: SessionInfo;
  spreadId: string;
  /** positionId -> cardId */
  placements: Record<string, string>;
  interpretation?: string;
  createdAt: string;
}
