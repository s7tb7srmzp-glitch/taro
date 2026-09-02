import type { Reading } from "./types";

const STORAGE_KEY = "taro-readings";

function readAll(): Reading[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(readings: Reading[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(readings));
}

export function listReadings(): Reading[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveReading(reading: Reading): void {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === reading.id);
  if (idx >= 0) {
    all[idx] = reading;
  } else {
    all.push(reading);
  }
  writeAll(all);
}

export function deleteReading(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}

export function getReading(id: string): Reading | undefined {
  return readAll().find((r) => r.id === id);
}

function isReading(value: unknown): value is Reading {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.spreadId === "string" &&
    typeof r.placements === "object" &&
    r.placements !== null &&
    typeof r.createdAt === "string" &&
    typeof r.session === "object" &&
    r.session !== null
  );
}

/** Serializes every saved reading to a JSON string, for the user to download as a backup file. */
export function exportReadingsJson(): string {
  return JSON.stringify(readAll(), null, 2);
}

/**
 * Restores readings from a previously exported JSON backup. Existing readings with a matching id
 * are overwritten by the imported version; readings not present in the file are left untouched.
 * Throws if the file doesn't look like a valid backup.
 */
export function importReadingsJson(json: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("올바른 JSON 파일이 아니에요.");
  }
  if (!Array.isArray(parsed) || !parsed.every(isReading)) {
    throw new Error("타로 리딩 백업 파일 형식이 아니에요.");
  }

  const all = readAll();
  for (const incoming of parsed) {
    const idx = all.findIndex((r) => r.id === incoming.id);
    if (idx >= 0) {
      all[idx] = incoming;
    } else {
      all.push(incoming);
    }
  }
  writeAll(all);
  return parsed.length;
}
