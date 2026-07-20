import type { SessionInfo } from "../lib/types";

interface SessionFormProps {
  value: SessionInfo;
  onChange: (value: SessionInfo) => void;
}

export function SessionForm({ value, onChange }: SessionFormProps) {
  return (
    <div className="session-form">
      <label className="field">
        <span className="field__label">내담자 이름</span>
        <input
          type="text"
          placeholder="이름을 입력하세요"
          value={value.querentName}
          onChange={(e) => onChange({ ...value, querentName: e.target.value })}
        />
      </label>

      <label className="field">
        <span className="field__label">날짜</span>
        <input
          type="date"
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
        />
      </label>

      <label className="field field--wide">
        <span className="field__label">질문 / 고민</span>
        <textarea
          placeholder={
            "예) 지금 준비 중인 이직이 올해 안에 잘 풀릴까요?\n" +
            "· 긍정문·열린 질문으로 적어보세요 (닫힌 Yes/No보다 \"어떻게\", \"무엇이\")\n" +
            "· 질문 기간은 6개월 이내로 좁혀보세요\n" +
            "· 한 번에 하나의 질문만 적어주세요"
          }
          rows={4}
          value={value.question}
          onChange={(e) => onChange({ ...value, question: e.target.value })}
        />
      </label>
    </div>
  );
}
