interface CommentBoxProps {
  value: string;
  onChange: (value: string) => void;
}

export function CommentBox({ value, onChange }: CommentBoxProps) {
  return (
    <div className="comment-box">
      <h3>내 코멘트</h3>
      <textarea
        className="comment-box__textarea no-print"
        placeholder="이 리딩에 대한 내 생각이나 메모를 남겨보세요 (AI 해석과는 별개로 저장돼요)"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && <p className="comment-box__print print-only">{value}</p>}
    </div>
  );
}
