interface InterpretationPanelProps {
  interpretation: string | null;
  loading: boolean;
  error: string | null;
  onInterpret: () => void;
  onSave: () => void;
  onPrint: () => void;
  saved: boolean;
  canInterpret: boolean;
}

export function InterpretationPanel({
  interpretation,
  loading,
  error,
  onInterpret,
  onSave,
  onPrint,
  saved,
  canInterpret,
}: InterpretationPanelProps) {
  return (
    <div className="interpretation-panel">
      <div className="interpretation-panel__actions no-print">
        <button
          type="button"
          className="btn btn--primary"
          onClick={onInterpret}
          disabled={loading || !canInterpret}
        >
          {loading ? "해석 중…" : "AI 해석"}
        </button>
        <button type="button" className="btn" onClick={onSave}>
          {saved ? "저장됨 ✓" : "저장"}
        </button>
        <button type="button" className="btn" onClick={onPrint}>
          인쇄
        </button>
      </div>

      {!canInterpret && (
        <p className="interpretation-panel__hint">모든 칸에 카드를 배치하면 AI 해석을 받을 수 있어요.</p>
      )}

      {error && <p className="interpretation-panel__error">{error}</p>}

      {interpretation && (
        <div className="interpretation-panel__result">
          <h3>해석</h3>
          <p>{interpretation}</p>
        </div>
      )}
    </div>
  );
}
