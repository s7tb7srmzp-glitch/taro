import { useRef, useState } from "react";
import { exportReadingsJson, importReadingsJson } from "../lib/storage";

interface BackupPanelProps {
  onImported: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BackupPanel({ onImported }: BackupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);

  function handleExport() {
    const json = exportReadingsJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taro-readings-backup-${todayIso()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatusIsError(false);
    setStatus("백업 파일을 내려받았어요.");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const count = importReadingsJson(text);
      setStatusIsError(false);
      setStatus(`${count}개의 리딩을 가져왔어요.`);
      onImported();
    } catch (err) {
      setStatusIsError(true);
      setStatus(err instanceof Error ? err.message : "가져오기에 실패했어요.");
    }
  }

  return (
    <div className="backup-panel">
      <p className="backup-panel__desc">
        리딩 기록은 이 기기의 브라우저에만 저장돼요. 다른 기기로 옮기거나 만약을 대비해 파일로
        내려받아두세요.
      </p>
      <div className="backup-panel__actions">
        <button type="button" className="btn btn--ghost" onClick={handleExport}>
          내보내기
        </button>
        <button type="button" className="btn btn--ghost" onClick={handleImportClick}>
          가져오기
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleFileChange}
        />
      </div>
      {status && (
        <p className={statusIsError ? "backup-panel__status backup-panel__status--error" : "backup-panel__status"}>
          {status}
        </p>
      )}
    </div>
  );
}
