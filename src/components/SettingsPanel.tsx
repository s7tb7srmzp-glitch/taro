import { useState } from "react";
import { getApiKey, setApiKey } from "../lib/settings";

interface SettingsPanelProps {
  onClose: () => void;
}

function maskKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 10)}${"•".repeat(8)}${key.slice(-4)}`;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [value, setValue] = useState("");
  const existing = getApiKey();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setApiKey(value);
    setSaved(true);
    setValue("");
  }

  function handleClear() {
    setApiKey("");
    setSaved(false);
  }

  return (
    <div className="card-picker-overlay" onClick={onClose}>
      <div className="card-picker settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="card-picker__header">
          <div>
            <div className="card-picker__slot">AI 해석 설정</div>
            <div className="card-picker__hint">
              Anthropic API 키는 이 기기의 브라우저에만 저장되고, 해석 요청 시 Claude로 직접 전송됩니다.
            </div>
          </div>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="settings-panel__body">
          {existing && !saved && (
            <p className="settings-panel__current">현재 저장된 키: {maskKey(existing)}</p>
          )}
          {saved && <p className="settings-panel__current">키가 저장되었습니다 ✓</p>}

          <label className="field field--wide">
            <span className="field__label">Anthropic API 키</span>
            <input
              type="password"
              placeholder="sk-ant-..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
            />
          </label>

          <div className="settings-panel__actions">
            <button type="button" className="btn btn--primary" onClick={handleSave} disabled={!value.trim()}>
              저장
            </button>
            {existing && (
              <button type="button" className="btn btn--ghost" onClick={handleClear}>
                저장된 키 삭제
              </button>
            )}
          </div>

          <p className="settings-panel__help">
            키가 없으신가요? <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">console.anthropic.com</a>
            에서 발급받을 수 있어요 (API Keys → Create Key).
          </p>
        </div>
      </div>
    </div>
  );
}
