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
