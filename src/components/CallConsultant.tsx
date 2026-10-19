import { useEffect, useMemo, useRef, useState } from "react";
import { SessionForm } from "./SessionForm";
import { SpreadPicker } from "./SpreadPicker";
import { SpreadBoard } from "./SpreadBoard";
import { CardPickerPanel } from "./CardPickerPanel";
import { CallScriptPanel } from "./CallScriptPanel";
import { CallReactionThread } from "./CallReactionThread";
import { CallExtraCardPicker } from "./CallExtraCardPicker";
import { CallCardStrip } from "./CallCardStrip";
import { CallScriptTabs } from "./CallScriptTabs";
import { SettingsPanel } from "./SettingsPanel";
import { SPREADS_BY_ID } from "../data/spreads";
import { CARDS_BY_ID } from "../data/cards";
import type { CallExtraCard, CallReaction, CallReply, CallScript, CallSession, SessionInfo } from "../lib/types";
import {
  listCallSessions,
  saveCallSession,
  deleteCallSession,
  exportCallSessionsJson,
  importCallSessionsJson,
} from "../lib/callStorage";
import { requestCallScript, requestCallFollowUp, requestExtraCardLink } from "../lib/ai";
import { hasApiKey } from "../lib/settings";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Rough spoken length for Korean at ~5 syllables per second. */
function estimateSpeechSeconds(text: string): number {
  return Math.max(1, Math.round(text.replace(/\s/g, "").length / 5));
}

function mergeFacts(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing);
  return [...existing, ...incoming.filter((f) => !seen.has(f))];
}

type CallStep = "setup" | "live";

interface CallConsultantProps {
  onExit: () => void;
}

export function CallConsultant({ onExit }: CallConsultantProps) {
  const [step, setStep] = useState<CallStep>("setup");
  const [sessions, setSessions] = useState<CallSession[]>(() => listCallSessions());

  const [callId, setCallId] = useState<string>(() => newId("call"));
  const [session, setSession] = useState<SessionInfo>({
    querentName: "",
    question: "",
    date: todayIso(),
  });
  const [spreadId, setSpreadId] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  const [script, setScript] = useState<CallScript | null>(null);
  const [reactions, setReactions] = useState<CallReaction[]>([]);
  const [extraCards, setExtraCards] = useState<CallExtraCard[]>([]);
  const [facts, setFacts] = useState<string[]>([]);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyPresent, setApiKeyPresent] = useState(() => hasApiKey());

  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupStatusIsError, setBackupStatusIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const spread = spreadId ? SPREADS_BY_ID[spreadId] : null;
  const usedCardIds = useMemo(
    () => new Set([...Object.values(placements), ...extraCards.map((x) => x.cardId)]),
    [placements, extraCards],
  );
  const canStart = session.question.trim().length > 0 && !!spreadId;

  const allSlotsFilled = useMemo(() => {
    if (!spread) return false;
    return spread.positions.every((p) => p.optional || placements[p.id]);
  }, [spread, placements]);

  const canGenerate = allSlotsFilled && apiKeyPresent;
  const generateHint = !allSlotsFilled
    ? "모든 칸에 카드를 배치하면 대본을 생성할 수 있어요."
    : !apiKeyPresent
      ? "설정에서 Anthropic API 키를 먼저 등록해주세요."
      : undefined;

  useEffect(() => {
    if (!confirmRegen) return;
    const timer = setTimeout(() => setConfirmRegen(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmRegen]);

  function handleCloseSettings() {
    setShowSettings(false);
    setApiKeyPresent(hasApiKey());
  }

  function refreshSessions() {
    setSessions(listCallSessions());
  }

  function resetForNewCall() {
    setCallId(newId("call"));
    setSession({ querentName: "", question: "", date: todayIso() });
    setSpreadId(null);
    setPlacements({});
    setScript(null);
    setReactions([]);
    setExtraCards([]);
    setFacts([]);
    setError(null);
    setSaved(false);
    setStep("setup");
  }

  function openSession(s: CallSession) {
    setCallId(s.id);
    setSession(s.session);
    setSpreadId(s.spreadId);
    setPlacements(s.placements);
    setScript(s.script ?? null);
    setReactions(s.reactions ?? []);
    setExtraCards(s.extraCards ?? []);
    setFacts(s.facts ?? []);
    setError(null);
    setSaved(true);
    setStep("live");
  }

  function handleDeleteSession(id: string) {
    deleteCallSession(id);
    refreshSessions();
  }

  function handleStart() {
    if (!canStart) return;
    setPlacements({});
    setScript(null);
    setReactions([]);
    setExtraCards([]);
    setFacts([]);
    setSaved(false);
    setStep("live");
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

  function buildSession(): CallSession {
    return {
      id: callId,
      session,
      spreadId: spreadId!,
      placements,
      script: script ?? undefined,
      reactions,
      extraCards,
      facts,
      createdAt: new Date().toISOString(),
    };
  }

  async function handleGenerateScript() {
    setConfirmRegen(false);
    setLoading(true);
    setError(null);
    try {
      const result = await requestCallScript(buildSession());
      setScript(result);
      setReactions([]);
      setExtraCards([]);
      setSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "대본 생성 중 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  function handleRegenerateClick() {
    if (reactions.length === 0 || confirmRegen) {
      handleGenerateScript();
    } else {
      setConfirmRegen(true);
    }
  }

  function recordReply(question: string, reply: CallReply, kind: CallReaction["kind"]) {
    setReactions((prev) => [
      ...prev,
      { question, answer: reply.answer, rationale: reply.rationale || undefined, revision: reply.revision || undefined, kind },
    ]);
    if (reply.newFacts.length > 0) setFacts((prev) => mergeFacts(prev, reply.newFacts));
    setSaved(false);
  }

  async function handleAskReaction(reaction: string) {
    const reply = await requestCallFollowUp(buildSession(), reaction);
    recordReply(reaction, reply, "reaction");
  }

  async function handleAddExtraCard(cardId: string, label: string) {
    const extraCard: CallExtraCard = { id: newId("extra"), cardId, label };
    const reply = await requestExtraCardLink(buildSession(), extraCard);
    setExtraCards((prev) => [...prev, { ...extraCard, note: reply.answer }]);
    const cardName = CARDS_BY_ID[cardId]?.nameKo ?? cardId;
    recordReply(`[카드 추가] ${label} → ${cardName}`, reply, "extra-card");
  }

  function handleRemoveFact(index: number) {
    setFacts((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  function handleSave() {
    saveCallSession(buildSession());
    refreshSessions();
    setSaved(true);
  }

  function handleExport() {
    const json = exportCallSessionsJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taro-call-sessions-backup-${todayIso()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setBackupStatusIsError(false);
    setBackupStatus("백업 파일을 내려받았어요.");
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const count = importCallSessionsJson(text);
      setBackupStatusIsError(false);
      setBackupStatus(`${count}개의 상담 세션을 가져왔어요.`);
      refreshSessions();
    } catch (err) {
      setBackupStatusIsError(true);
      setBackupStatus(err instanceof Error ? err.message : "가져오기에 실패했어요.");
    }
  }

  const activePosition = spread?.positions.find((p) => p.id === activeSlotId);

  const disclaimer = (
    <p className="call-disclaimer">
      ⚠️ 이 모드는 상담사를 돕는 보조 도구입니다. 의료·법률·재정적 결정을 대신하지 않고, 제3자의
      마음이나 미래를 단정하지 않습니다 — 항상 참고용으로만 활용하세요.
    </p>
  );

  if (step === "setup") {
    return (
      <div className="app-shell call-mode">
        <header className="app-header no-print">
          <button type="button" className="btn btn--ghost" onClick={onExit}>
            ‹ 학습 모드로
          </button>
          <h1>📞 전화상담 모드</h1>
          <div className="app-header__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setShowSettings(true)}>
              {apiKeyPresent ? "설정" : "AI 설정 필요"}
            </button>
          </div>
        </header>

        {disclaimer}

        <section className="setup-section">
          <h2>1. 상담 정보</h2>
          <SessionForm value={session} onChange={setSession} />
        </section>

        <section className="setup-section">
          <h2>2. 스프레드 선택</h2>
          <SpreadPicker selectedId={spreadId} onSelect={setSpreadId} />
        </section>

        <button type="button" className="btn btn--primary btn--large" disabled={!canStart} onClick={handleStart}>
          상담 시작하기
        </button>

        <section className="setup-section">
          <h2>저장된 상담</h2>
          {sessions.length === 0 ? (
            <p className="reading-list__empty">저장된 상담이 없습니다.</p>
          ) : (
            <ul className="reading-list">
              {sessions.map((s) => {
                const sSpread = SPREADS_BY_ID[s.spreadId];
                return (
                  <li key={s.id} className="reading-list__item">
                    <button type="button" className="reading-list__open" onClick={() => openSession(s)}>
                      <span className="reading-list__name">{s.session.querentName || "(이름 없음)"}</span>
                      <span className="reading-list__meta">
                        {s.session.date} · {sSpread?.name ?? s.spreadId}
                      </span>
                      <span className="reading-list__question">{s.session.question}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => handleDeleteSession(s.id)}
                      aria-label="삭제"
                    >
                      삭제
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="backup-panel">
            <p className="backup-panel__desc">
              상담 세션도 이 기기의 브라우저에만 저장돼요. 다른 기기로 옮기거나 만약을 대비해 파일로
              내려받아두세요.
            </p>
            <div className="backup-panel__actions">
              <button type="button" className="btn btn--ghost" onClick={handleExport}>
                내보내기
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => fileInputRef.current?.click()}>
                가져오기
              </button>
              <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
            </div>
            {backupStatus && (
              <p className={backupStatusIsError ? "backup-panel__status backup-panel__status--error" : "backup-panel__status"}>
                {backupStatus}
              </p>
            )}
          </div>
        </section>

        {showSettings && <SettingsPanel onClose={handleCloseSettings} />}
      </div>
    );
  }

  return (
    <div className="app-shell call-mode">
      <header className="app-header no-print">
        <button type="button" className="btn btn--ghost" onClick={resetForNewCall}>
          ‹ 처음으로
        </button>
        <h1>📞 전화상담 모드</h1>
        <div className="app-header__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setShowSettings(true)}>
            설정
          </button>
        </div>
      </header>

      <details className="call-disclaimer call-disclaimer--compact">
        <summary>⚠️ 보조 도구 안내</summary>
        의료·법률·재정적 결정을 대신하지 않고, 제3자의 마음이나 미래를 단정하지 않아요. 참고용으로만
        활용하세요.
      </details>

      <p className="call-summary">
        <strong>{session.querentName || "(이름 없음)"}</strong> · Q. {session.question}
      </p>

      {!script ? (
        <>
          {spread && <SpreadBoard spread={spread} placements={placements} onSlotClick={handleSlotClick} />}
          <CallScriptPanel
            loading={loading}
            error={error}
            onGenerate={handleGenerateScript}
            canGenerate={canGenerate}
            hint={generateHint}
          />
          <div className="call-actions no-print">
            <button type="button" className="btn" onClick={handleSave}>
              {saved ? "저장됨 ✓" : "저장"}
            </button>
          </div>
        </>
      ) : (
        <>
          {spread && (
            <CallCardStrip
              spread={spread}
              placements={placements}
              extraCards={extraCards}
              onSlotClick={handleSlotClick}
            />
          )}

          <section className="call-core">
            <div className="call-core__head">
              <h3>📣 15초 핵심 결론</h3>
              {script.coreConclusion && (
                <span
                  className={`call-core__badge${
                    estimateSpeechSeconds(script.coreConclusion) > 18 ? " call-core__badge--long" : ""
                  }`}
                >
                  약 {estimateSpeechSeconds(script.coreConclusion)}초
                </span>
              )}
            </div>
            <p>{script.coreConclusion || "핵심 결론이 비어 있어요. 아래 '상담 대본' 탭을 확인하거나 대본을 다시 생성해주세요."}</p>
          </section>

          <CallReactionThread reactions={reactions} onAsk={handleAskReaction} />

          <CallScriptTabs script={script} reactions={reactions} facts={facts} onRemoveFact={handleRemoveFact} />

          {loading && (
            <div className="call-loading" role="status">
              <span className="call-spinner" aria-hidden="true" />
              <span>대본을 다시 만드는 중이에요… 보통 10~30초 걸려요.</span>
            </div>
          )}
          {!loading && error && (
            <div className="call-error" role="alert">
              <p>{error}</p>
              <button type="button" className="btn" onClick={handleGenerateScript} disabled={!canGenerate}>
                다시 시도
              </button>
            </div>
          )}

          <div className="call-actions no-print">
            <CallExtraCardPicker usedCardIds={usedCardIds} onAdd={handleAddExtraCard} />
            <button
              type="button"
              className={`btn${confirmRegen ? " call-actions__confirm" : ""}`}
              onClick={handleRegenerateClick}
              disabled={loading || !canGenerate}
            >
              {loading ? "생성 중…" : confirmRegen ? "한 번 더 누르면 대화가 초기화돼요" : "대본 다시 생성"}
            </button>
            <button type="button" className="btn" onClick={handleSave}>
              {saved ? "저장됨 ✓" : "저장"}
            </button>
          </div>
        </>
      )}

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
