import { useMemo, useState } from "react";
import { SessionForm } from "./components/SessionForm";
import { SpreadPicker } from "./components/SpreadPicker";
import { SpreadBoard } from "./components/SpreadBoard";
import { CardPickerPanel } from "./components/CardPickerPanel";
import { InterpretationPanel } from "./components/InterpretationPanel";
import { ReadingList } from "./components/ReadingList";
import { SettingsPanel } from "./components/SettingsPanel";
import { SPREADS_BY_ID } from "./data/spreads";
import type { Reading, SessionInfo } from "./lib/types";
import { listReadings, saveReading, deleteReading } from "./lib/storage";
import { requestInterpretation } from "./lib/ai";
import { hasApiKey } from "./lib/settings";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function newReadingId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `reading-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type Step = "setup" | "board";

export default function App() {
  const [step, setStep] = useState<Step>("setup");
  const [readings, setReadings] = useState<Reading[]>(() => listReadings());

  const [readingId, setReadingId] = useState<string>(() => newReadingId());
  const [session, setSession] = useState<SessionInfo>({
    querentName: "",
    question: "",
    date: todayIso(),
  });
  const [spreadId, setSpreadId] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyPresent, setApiKeyPresent] = useState(() => hasApiKey());

  const spread = spreadId ? SPREADS_BY_ID[spreadId] : null;

  const usedCardIds = useMemo(() => new Set(Object.values(placements)), [placements]);

  const canStart = session.question.trim().length > 0 && !!spreadId;

  const allSlotsFilled = useMemo(() => {
    if (!spread) return false;
    return spread.positions.every((p) => p.optional || placements[p.id]);
  }, [spread, placements]);

  const canInterpret = allSlotsFilled && apiKeyPresent;

  const interpretHint = !allSlotsFilled
    ? "모든 칸에 카드를 배치하면 AI 해석을 받을 수 있어요."
    : !apiKeyPresent
      ? "설정에서 Anthropic API 키를 먼저 등록해주세요."
      : undefined;

  function handleCloseSettings() {
    setShowSettings(false);
    setApiKeyPresent(hasApiKey());
  }

  function refreshReadings() {
    setReadings(listReadings());
  }

  function resetForNewReading() {
    setReadingId(newReadingId());
    setSession({ querentName: "", question: "", date: todayIso() });
    setSpreadId(null);
    setPlacements({});
    setInterpretation(null);
    setError(null);
    setSaved(false);
    setStep("setup");
  }

  function openReading(reading: Reading) {
    setReadingId(reading.id);
    setSession(reading.session);
    setSpreadId(reading.spreadId);
    setPlacements(reading.placements);
    setInterpretation(reading.interpretation ?? null);
    setError(null);
    setSaved(true);
    setStep("board");
  }

  function handleDeleteReading(id: string) {
    deleteReading(id);
    refreshReadings();
  }

  function handleStart() {
    if (!canStart) return;
    setPlacements({});
    setInterpretation(null);
    setSaved(false);
    setStep("board");
  }

  function handleSlotClick(positionId: string) {
    setActiveSlotId(positionId);
  }

  function handlePick(cardId: string) {
    if (!activeSlotId) return;
    setPlacements((prev) => ({ ...prev, [activeSlotId]: cardId }));
    setSaved(false);
    setActiveSlotId(null);
  }

  function handleClearSlot() {
    if (!activeSlotId) return;
    setPlacements((prev) => {
      const next = { ...prev };
      delete next[activeSlotId];
      return next;
    });
    setSaved(false);
    setActiveSlotId(null);
  }

  function buildReading(): Reading {
    return {
      id: readingId,
      session,
      spreadId: spreadId!,
      placements,
      interpretation: interpretation ?? undefined,
      createdAt: new Date().toISOString(),
    };
  }

  async function handleInterpret() {
    setLoading(true);
    setError(null);
    try {
      const text = await requestInterpretation(buildReading());
      setInterpretation(text);
      setSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "해석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    saveReading(buildReading());
    refreshReadings();
    setSaved(true);
  }

  function handlePrint() {
    window.print();
  }

  const activePosition = spread?.positions.find((p) => p.id === activeSlotId);

  if (step === "setup") {
    return (
      <div className="app-shell">
        <header className="app-header no-print">
          <h1>타로 리딩</h1>
          <p>스프레드를 선택하고, 카드를 직접 골라 배치해보세요.</p>
          <div className="app-header__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setShowSettings(true)}>
              {apiKeyPresent ? "설정" : "AI 설정 필요"}
            </button>
          </div>
        </header>

        <section className="setup-section">
          <h2>1. 내담자 정보</h2>
          <SessionForm value={session} onChange={setSession} />
        </section>

        <section className="setup-section">
          <h2>2. 스프레드 선택</h2>
          <SpreadPicker selectedId={spreadId} onSelect={setSpreadId} />
        </section>

        <button type="button" className="btn btn--primary btn--large" disabled={!canStart} onClick={handleStart}>
          리딩 시작하기
        </button>

        <section className="setup-section">
          <h2>저장된 리딩</h2>
          <ReadingList readings={readings} onOpen={openReading} onDelete={handleDeleteReading} />
        </section>

        {showSettings && <SettingsPanel onClose={handleCloseSettings} />}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header no-print">
        <button type="button" className="btn btn--ghost" onClick={resetForNewReading}>
          ‹ 처음으로
        </button>
        <h1>타로 리딩</h1>
        <div className="app-header__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setShowSettings(true)}>
            설정
          </button>
        </div>
      </header>

      <div className="reading-summary print-only">
        <h1>타로 리딩 결과</h1>
        <p>
          <strong>{session.querentName || "내담자"}</strong> · {session.date} · {spread?.name}
        </p>
        <p className="reading-summary__question">Q. {session.question}</p>
      </div>

      <div className="reading-summary no-print">
        <p>
          <strong>{session.querentName || "(이름 없음)"}</strong> · {session.date} · {spread?.name}
        </p>
        <p className="reading-summary__question">Q. {session.question}</p>
      </div>

      {spread && (
        <SpreadBoard spread={spread} placements={placements} onSlotClick={handleSlotClick} />
      )}

      <InterpretationPanel
        interpretation={interpretation}
        loading={loading}
        error={error}
        onInterpret={handleInterpret}
        onSave={handleSave}
        onPrint={handlePrint}
        saved={saved}
        canInterpret={canInterpret}
        hint={interpretHint}
      />

      {showSettings && <SettingsPanel onClose={handleCloseSettings} />}

      {activePosition && (
        <CardPickerPanel
          slotLabel={activePosition.label}
          slotHint={activePosition.hint}
          usedCardIds={usedCardIds}
          currentCardId={placements[activePosition.id]}
          onPick={handlePick}
          onClear={handleClearSlot}
          onClose={() => setActiveSlotId(null)}
        />
      )}
    </div>
  );
}
