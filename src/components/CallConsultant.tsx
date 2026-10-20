import { useEffect, useMemo, useRef, useState } from "react";
import { SessionForm } from "./SessionForm";
import { SpreadPicker } from "./SpreadPicker";
import { SpreadBoard } from "./SpreadBoard";
import { CardPickerPanel } from "./CardPickerPanel";
import { CallScriptPanel } from "./CallScriptPanel";
import { CallExtraFlow } from "./CallExtraFlow";
import { CallCardStrip } from "./CallCardStrip";
import { CallInterpretation } from "./CallInterpretation";
import { CallGuide } from "./CallGuide";
import { CallComposer } from "./CallComposer";
import { CallFollowUp } from "./CallFollowUp";
import { CallClosingPanel } from "./CallClosingPanel";
import { SettingsPanel } from "./SettingsPanel";
import { SPREADS_BY_ID } from "../data/spreads";
import type {
  CallClosing,
  CallExtraCard,
  CallReaction,
  CallReply,
  CallScript,
  CallSession,
  ExtraCardFlow,
  ExtraCardLogEntry,
  SessionInfo,
} from "../lib/types";
import {
  listCallSessions,
  saveCallSession,
  deleteCallSession,
  exportCallSessionsJson,
  importCallSessionsJson,
  saveCallDraft,
  loadCallDraft,
  clearCallDraft,
} from "../lib/callStorage";
import { requestCallScript, requestCallFollowUp, requestExtraCardReading, requestCallClosing } from "../lib/ai";
import type { CallTurnInput } from "../lib/ai";
import { classifyProposalAnswer, findRepeatedQuestion } from "../lib/callText";
import { hasApiKey } from "../lib/settings";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mergeFacts(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing);
  return [...existing, ...incoming.filter((f) => !seen.has(f))];
}

/** A flow restored from storage can't still be mid-pick or mid-request; resume it one step back. */
function resumeFlow(flow: ExtraCardFlow | undefined): ExtraCardFlow | null {
  if (!flow) return null;
  if (flow.status === "selecting") return { ...flow, status: flow.cardIds.length >= flow.count ? "selected" : "accepted" };
  if (flow.status === "interpreting") {
    return { ...flow, status: "selected", error: "해석이 끝나기 전에 화면이 닫혔어요. 다시 해석해주세요." };
  }
  return flow;
}

function logEntry(flow: ExtraCardFlow, outcome: ExtraCardLogEntry["outcome"]): ExtraCardLogEntry {
  return {
    id: flow.id,
    question: flow.question.trim(),
    purpose: flow.purpose || undefined,
    source: flow.source,
    outcome,
    cardIds: outcome === "drawn" ? flow.cardIds : undefined,
    acceptedBy: flow.acceptedBy,
    at: new Date().toISOString(),
  };
}

/** The proposal log and pending flow a reply should be judged against. */
interface ExtraContext {
  log: ExtraCardLogEntry[];
  flow: ExtraCardFlow | null;
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
  const [closing, setClosing] = useState<CallClosing | null>(null);
  const [closingLoading, setClosingLoading] = useState(false);
  const [closingError, setClosingError] = useState<string | null>(null);
  const [extraFlow, setExtraFlow] = useState<ExtraCardFlow | null>(null);
  const [extraLog, setExtraLog] = useState<ExtraCardLogEntry[]>([]);
  /** Mirrors `extraFlow` synchronously so rapid taps never act on a stale flow. */
  const extraFlowRef = useRef<ExtraCardFlow | null>(null);
  const extraBusyRef = useRef(false);
  const extraFlowElRef = useRef<HTMLDivElement>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const followUpRef = useRef<HTMLElement>(null);
  const closingRef = useRef<HTMLDivElement>(null);
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

  // Restore a call interrupted by a page refresh (kept in sessionStorage only).
  useEffect(() => {
    const draft = loadCallDraft();
    if (draft) loadCall(draft.call, draft.saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== "live" || !spreadId) return;
    saveCallDraft({ call: buildSession(), saved });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, callId, session, spreadId, placements, script, reactions, extraCards, facts, closing, extraFlow, extraLog, saved]);

  useEffect(() => {
    if (!confirmRegen) return;
    const timer = setTimeout(() => setConfirmRegen(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmRegen]);

  useEffect(() => {
    if (!confirmLeave) return;
    const timer = setTimeout(() => setConfirmLeave(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmLeave]);

  function handleCloseSettings() {
    setShowSettings(false);
    setApiKeyPresent(hasApiKey());
  }

  function refreshSessions() {
    setSessions(listCallSessions());
  }

  function commitFlow(flow: ExtraCardFlow | null) {
    extraFlowRef.current = flow;
    setExtraFlow(flow);
  }

  function resetExtra(flow: ExtraCardFlow | null = null, log: ExtraCardLogEntry[] = []) {
    commitFlow(flow);
    setExtraLog(log);
    extraBusyRef.current = false;
  }

  function resetForNewCall() {
    clearCallDraft();
    resetExtra();
    setCallId(newId("call"));
    setSession({ querentName: "", question: "", date: todayIso() });
    setSpreadId(null);
    setPlacements({});
    setScript(null);
    setReactions([]);
    setExtraCards([]);
    setFacts([]);
    setClosing(null);
    setClosingError(null);
    setError(null);
    setSaved(false);
    setConfirmLeave(false);
    setStep("setup");
  }

  /** Leaving drops anything unsaved, so an unsaved call in progress needs a second tap. */
  function handleLeaveClick() {
    const hasUnsaved = !saved && (!!script || Object.keys(placements).length > 0);
    if (!hasUnsaved || confirmLeave) resetForNewCall();
    else setConfirmLeave(true);
  }

  function loadCall(s: CallSession, isSaved: boolean) {
    setCallId(s.id);
    setSession(s.session);
    setSpreadId(s.spreadId);
    setPlacements(s.placements);
    setScript(s.script ?? null);
    setReactions(s.reactions ?? []);
    setExtraCards(s.extraCards ?? []);
    setFacts(s.facts ?? []);
    setClosing(s.closing ?? null);
    setClosingError(null);
    resetExtra(resumeFlow(s.extraFlow), s.extraCardLog ?? []);
    setError(null);
    setSaved(isSaved);
    setStep("live");
  }

  function openSession(s: CallSession) {
    loadCall(s, true);
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
    setClosing(null);
    setClosingError(null);
    resetExtra();
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
      closing: closing ?? undefined,
      extraFlow: extraFlow ?? undefined,
      extraCardLog: extraLog,
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
      setClosing(null);
      setClosingError(null);
      resetExtra();
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

  function scrollTo(el: HTMLElement | null) {
    requestAnimationFrame(() => el?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  /**
   * Turns an AI card proposal into a pending flow, unless it repeats a question already drawn or
   * declined, a draw is already underway, or it comes right after an extra reading with nothing new.
   */
  function proposalFromReply(reply: CallReply, ctx: ExtraContext): { flow: ExtraCardFlow | null; suppressed?: string } {
    const suggestion = reply.cardProposed ? reply.extraCardSuggestion : undefined;
    if (!suggestion) return { flow: ctx.flow };
    if (ctx.flow && ctx.flow.status !== "proposed") return { flow: ctx.flow, suppressed: "이미 진행 중인 추가 카드가 있어요." };
    const repeated = findRepeatedQuestion(suggestion.question, ctx.log.map((e) => e.question));
    if (repeated) return { flow: ctx.flow, suppressed: `이미 다룬 질문이에요 ("${repeated}").` };
    const last = reactions[reactions.length - 1];
    if (last?.extraReading && !suggestion.question.trim()) {
      return { flow: ctx.flow, suppressed: "방금 추가 카드를 해석했어요." };
    }
    return {
      flow: {
        id: newId("proposal"),
        status: "proposed",
        source: "ai",
        question: suggestion.question,
        purpose: suggestion.purpose,
        count: suggestion.countNum ?? 1,
        spread: suggestion.spread,
        cardIds: [],
      },
    };
  }

  function recordReply(turn: Omit<CallReaction, "answer">, reply: CallReply, ctx: ExtraContext) {
    const { flow, suppressed } = proposalFromReply(reply, ctx);
    setReactions((prev) => [
      ...prev,
      {
        ...turn,
        answer: reply.answer,
        rationale: reply.rationale || undefined,
        revision: reply.revision || undefined,
        nextQuestion: reply.nextQuestion || undefined,
        nextQuestionKind: reply.nextQuestionKind,
        next: suppressed && reply.next === "extra-card" ? "continue" : reply.next,
        extraCardSuggestion: reply.cardProposed ? reply.extraCardSuggestion : undefined,
        proposalSuppressed: suppressed,
      },
    ]);
    setExtraLog(ctx.log);
    commitFlow(flow);
    if (reply.newFacts.length > 0) setFacts((prev) => mergeFacts(prev, reply.newFacts));
    setSaved(false);
    scrollTo(followUpRef.current);
  }

  async function handleAskReaction(input: CallTurnInput) {
    // A remark sent while a proposal is pending answers it: a decline ends it, anything else moves past it.
    // (Clear acceptances never get here — the composer turns them into handleAcceptProposal.)
    const current = extraFlowRef.current;
    const pending = current?.status === "proposed" ? current : null;
    const log = pending
      ? [...extraLog, logEntry(pending, classifyProposalAnswer(input.remark) === "decline" ? "declined" : "dismissed")]
      : extraLog;
    const flow = pending ? null : current;
    const reply = await requestCallFollowUp(
      { ...buildSession(), extraFlow: flow ?? undefined, extraCardLog: log },
      input,
    );
    const question = [...input.tags.map((t) => `[${t}]`), input.remark].filter(Boolean).join(" ");
    recordReply({ question, tags: input.tags, remark: input.remark, kind: "reaction" }, reply, { log, flow });
  }

  async function handleCloseCall() {
    setClosingLoading(true);
    setClosingError(null);
    scrollTo(closingRef.current);
    try {
      const result = await requestCallClosing(buildSession());
      setClosing(result);
      setSaved(false);
      scrollTo(closingRef.current);
    } catch (e) {
      setClosingError(e instanceof Error ? e.message : "마무리 대본 생성 중 오류가 발생했어요.");
    } finally {
      setClosingLoading(false);
    }
  }

  function updateFlow(patch: Partial<ExtraCardFlow>) {
    const flow = extraFlowRef.current;
    if (!flow) return;
    commitFlow({ ...flow, ...patch });
    setSaved(false);
  }

  function handleAcceptProposal(by: "button" | "remark") {
    const flow = extraFlowRef.current;
    if (!flow || flow.status !== "proposed") return;
    commitFlow({ ...flow, status: "accepted", acceptedBy: by });
    setSaved(false);
    scrollTo(extraFlowElRef.current);
  }

  function handleManualExtra() {
    if (!extraFlowRef.current) {
      commitFlow({
        id: newId("proposal"),
        status: "accepted",
        source: "manual",
        question: "",
        purpose: "",
        count: 1,
        spread: "",
        cardIds: [],
      });
    }
    scrollTo(extraFlowElRef.current);
  }

  function handleExtraPickStart() {
    const flow = extraFlowRef.current;
    if (!flow || extraBusyRef.current || !flow.question.trim() || flow.cardIds.length >= flow.count) return;
    if (flow.status !== "proposed" && flow.status !== "accepted" && flow.status !== "selected") return;
    commitFlow({
      ...flow,
      status: "selecting",
      acceptedBy: flow.acceptedBy ?? (flow.source === "ai" ? "button" : undefined),
      error: undefined,
    });
  }

  function handleExtraPick(cardId: string) {
    const flow = extraFlowRef.current;
    if (!flow || flow.status !== "selecting" || flow.cardIds.includes(cardId)) return;
    const cardIds = [...flow.cardIds, cardId];
    const done = cardIds.length >= flow.count;
    const next: ExtraCardFlow = { ...flow, cardIds, status: done ? "selected" : "selecting" };
    commitFlow(next);
    setSaved(false);
    if (done) interpretExtra(next);
  }

  function handleExtraPickCancel() {
    const flow = extraFlowRef.current;
    if (!flow || flow.status !== "selecting") return;
    commitFlow({ ...flow, status: flow.cardIds.length >= flow.count ? "selected" : "accepted" });
  }

  function handleExtraRemoveCard(index: number) {
    const flow = extraFlowRef.current;
    if (!flow || extraBusyRef.current) return;
    const status = flow.status === "proposed" ? "proposed" : "accepted";
    updateFlow({ cardIds: flow.cardIds.filter((_, i) => i !== index), status, error: undefined });
  }

  function handleExtraSkip() {
    const flow = extraFlowRef.current;
    if (!flow || extraBusyRef.current) return;
    if (flow.question.trim() || flow.source === "ai") {
      setExtraLog((prev) => [...prev, logEntry(flow, flow.status === "proposed" ? "declined" : "dismissed")]);
    }
    commitFlow(null);
    setSaved(false);
  }

  async function interpretExtra(flow: ExtraCardFlow) {
    if (extraBusyRef.current || flow.cardIds.length === 0 || !flow.question.trim()) return;
    extraBusyRef.current = true;
    commitFlow({ ...flow, status: "interpreting", error: undefined });
    try {
      const reply = await requestExtraCardReading(buildSession(), flow);
      const question = flow.question.trim();
      const note = reply.extraReading?.directAnswer || reply.answer;
      const log = [...extraLog, logEntry(flow, "drawn")];
      setExtraCards((prev) => [...prev, ...flow.cardIds.map((cardId) => ({ id: newId("extra"), cardId, label: question, note }))]);
      recordReply(
        {
          question: `[추가 카드] ${question}`,
          kind: "extra-card",
          extraReading: {
            question,
            cardIds: flow.cardIds,
            cards: reply.extraReading?.cards ?? "",
            relation: reply.extraReading?.relation ?? "",
            directAnswer: reply.extraReading?.directAnswer ?? "",
          },
        },
        reply,
        { log, flow: null },
      );
    } catch (e) {
      // Keep the picked cards and the question so a retry costs only a tap.
      commitFlow({
        ...flow,
        status: "selected",
        error: e instanceof Error ? e.message : "추가 카드 해석 중 오류가 발생했어요.",
      });
    } finally {
      extraBusyRef.current = false;
    }
  }

  function handleExtraInterpret() {
    const flow = extraFlowRef.current;
    if (!flow || flow.status === "interpreting" || flow.status === "selecting") return;
    interpretExtra({ ...flow, status: "selected" });
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
      ⚠️ 이 모드는 상담사를 돕는 보조 도구예요. 상담은 상담사가 이끌고, AI는 필요할 때만 대본을
      제안해요. 의료·법률·재정적 결정을 대신하지 않고, 제3자의 마음이나 미래를 단정하지 않아요.
      카드 정보와 상담사가 입력한 내담자 발언은 대본 생성을 위해 외부 AI(Anthropic Claude API)로
      전송되니, 실제 서비스에서는 내담자에게 이를 안내하고 동의를 받아주세요.
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
        <button
          type="button"
          className={`btn btn--ghost${confirmLeave ? " call-actions__confirm" : ""}`}
          onClick={handleLeaveClick}
        >
          {confirmLeave ? "저장 안 한 상담이 지워져요" : "‹ 처음으로"}
        </button>
        <h1>📞 전화상담 모드</h1>
        <div className="app-header__actions">
          <button type="button" className="btn btn--ghost" onClick={() => setShowSettings(true)}>
            설정
          </button>
        </div>
      </header>

      <details className="call-disclaimer call-disclaimer--compact">
        <summary>⚠️ 보조 도구 · 개인정보 안내</summary>
        의료·법률·재정적 결정을 대신하지 않고, 제3자의 마음이나 미래를 단정하지 않아요. 카드 정보와
        입력한 내담자 발언은 대본 생성을 위해 외부 AI(Anthropic Claude API)로 전송돼요. 이름·연락처 등
        민감한 정보는 입력하지 마세요.
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

          <section className="call-zone" aria-label="카드 해석">
            <CallInterpretation script={script} reactions={reactions} facts={facts} onRemoveFact={handleRemoveFact} />
          </section>

          <section className="call-zone" aria-label="상담 진행">
            <h2 className="call-zone__title">상담 진행</h2>
            <CallGuide script={script} reactions={reactions} onCloseCall={handleCloseCall} />
            <CallComposer
              onGenerate={handleAskReaction}
              disabled={loading || closingLoading || extraFlow?.status === "interpreting"}
              proposalPending={extraFlow?.status === "proposed"}
              onAcceptProposal={() => handleAcceptProposal("remark")}
            />
          </section>

          <section className="call-zone" aria-label="후속 상담" ref={followUpRef}>
            <h2 className="call-zone__title">후속 상담</h2>
            {reactions.length === 0 ? (
              <p className="call-zone__empty">
                내담자 반응을 입력하고 "다음 상담 대본 생성"을 누르면 여기에 할 말과 다음 질문이 나와요.
              </p>
            ) : (
              <CallFollowUp reactions={reactions} />
            )}
            <div ref={extraFlowElRef}>
              {extraFlow && (
                <CallExtraFlow
                  flow={extraFlow}
                  usedCardIds={usedCardIds}
                  onEdit={updateFlow}
                  onPickStart={handleExtraPickStart}
                  onPick={handleExtraPick}
                  onPickCancel={handleExtraPickCancel}
                  onRemoveCard={handleExtraRemoveCard}
                  onInterpret={handleExtraInterpret}
                  onSkip={handleExtraSkip}
                />
              )}
            </div>
            <div className="call-actions no-print">
              <button type="button" className="btn btn--ghost" onClick={handleManualExtra} disabled={!!extraFlow}>
                🃏 추가 카드 뽑기
              </button>
              <button type="button" className="btn" onClick={handleCloseCall} disabled={closingLoading}>
                {closingLoading ? "마무리 대본 만드는 중…" : closing ? "마무리 대본 다시 만들기" : "👋 상담 마무리"}
              </button>
            </div>
            <div ref={closingRef}>
              <CallClosingPanel closing={closing} loading={closingLoading} error={closingError} onGenerate={handleCloseCall} />
            </div>
          </section>

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
            <button
              type="button"
              className={`btn${confirmRegen ? " call-actions__confirm" : ""}`}
              onClick={handleRegenerateClick}
              disabled={loading || !canGenerate}
            >
              {loading ? "생성 중…" : confirmRegen ? "한 번 더 누르면 대화가 초기화돼요" : "최초 해석 다시 생성"}
            </button>
            <button type="button" className="btn" onClick={handleSave}>
              {saved ? "저장됨 ✓" : "저장"}
            </button>
          </div>
          <p className="call-save-note no-print">
            {saved
              ? "이 기기의 브라우저에만 저장됐어요. 이후 바뀐 내용은 다시 저장해야 남아요."
              : "저장하지 않으면 '처음으로'를 누를 때 이 상담 내용(입력한 발언 포함)은 사라져요. 저장하면 이 기기에만 보관돼요."}
          </p>
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
