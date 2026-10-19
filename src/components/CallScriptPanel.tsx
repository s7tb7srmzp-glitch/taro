interface CallScriptPanelProps {
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  canGenerate: boolean;
  hint?: string;
}

/** Shown before a script exists: the generate button, a loading state, and retry on failure. */
export function CallScriptPanel({ loading, error, onGenerate, canGenerate, hint }: CallScriptPanelProps) {
  return (
    <div className="call-script-panel">
      {loading ? (
        <div className="call-loading" role="status">
          <span className="call-spinner" aria-hidden="true" />
          <span>상담 대본을 만드는 중이에요… 보통 10~30초 걸려요.</span>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn--primary btn--large no-print"
          onClick={onGenerate}
          disabled={!canGenerate}
        >
          상담 대본 생성
        </button>
      )}

      {!loading && hint && <p className="interpretation-panel__hint">{hint}</p>}

      {!loading && error && (
        <div className="call-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn" onClick={onGenerate} disabled={!canGenerate}>
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
