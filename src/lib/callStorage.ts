import type { CallSession } from "./types";

const STORAGE_KEY = "taro-call-sessions";

function readAll(): CallSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(sessions: CallSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function listCallSessions(): CallSession[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveCallSession(session: CallSession): void {
  const all = readAll();
  const idx = all.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    all[idx] = session;
  } else {
    all.push(session);
  }
  writeAll(all);
}

export function deleteCallSession(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}

export function getCallSession(id: string): CallSession | undefined {
  return readAll().find((s) => s.id === id);
}

function isCallSession(value: unknown): value is CallSession {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.spreadId === "string" &&
    typeof s.placements === "object" &&
    s.placements !== null &&
    typeof s.createdAt === "string" &&
    typeof s.session === "object" &&
    s.session !== null
  );
}

/** Serializes every saved call session to a JSON string, for the user to download as a backup file. */
export function exportCallSessionsJson(): string {
  return JSON.stringify(readAll(), null, 2);
}

/**
 * Restores call sessions from a previously exported JSON backup. Existing sessions with a matching
 * id are overwritten by the imported version; sessions not present in the file are left untouched.
 * Throws if the file doesn't look like a valid backup.
 */
export function importCallSessionsJson(json: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("올바른 JSON 파일이 아니에요.");
  }
  if (!Array.isArray(parsed) || !parsed.every(isCallSession)) {
    throw new Error("전화상담 세션 백업 파일 형식이 아니에요.");
  }

  const all = readAll();
  for (const incoming of parsed) {
    const idx = all.findIndex((s) => s.id === incoming.id);
    if (idx >= 0) {
      all[idx] = incoming;
    } else {
      all.push(incoming);
    }
  }
  writeAll(all);
  return parsed.length;
}

/*
 * The call in progress, kept in sessionStorage so a page refresh mid-call doesn't lose picked
 * extra cards or the conversation. It disappears when the tab is closed or a new call starts.
 */
const DRAFT_KEY = "taro-call-draft";

export interface CallDraft {
  call: CallSession;
  saved: boolean;
}

export function saveCallDraft(draft: CallDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage full or unavailable: the draft is a convenience only.
  }
}

export function loadCallDraft(): CallDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && isCallSession(parsed.call) ? { call: parsed.call, saved: !!parsed.saved } : null;
  } catch {
    return null;
  }
}

export function clearCallDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
