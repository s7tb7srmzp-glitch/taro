import type { Reading } from "../lib/types";
import { SPREADS_BY_ID } from "../data/spreads";

interface ReadingListProps {
  readings: Reading[];
  onOpen: (reading: Reading) => void;
  onDelete: (id: string) => void;
}

export function ReadingList({ readings, onOpen, onDelete }: ReadingListProps) {
  if (readings.length === 0) {
    return <p className="reading-list__empty">저장된 리딩이 없습니다.</p>;
  }

  return (
    <ul className="reading-list">
      {readings.map((r) => {
        const spread = SPREADS_BY_ID[r.spreadId];
        return (
          <li key={r.id} className="reading-list__item">
            <button type="button" className="reading-list__open" onClick={() => onOpen(r)}>
              <span className="reading-list__name">{r.session.querentName || "(이름 없음)"}</span>
              <span className="reading-list__meta">
                {r.session.date} · {spread?.name ?? r.spreadId}
              </span>
              <span className="reading-list__question">{r.session.question}</span>
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onDelete(r.id)}
              aria-label="삭제"
            >
              삭제
            </button>
          </li>
        );
      })}
    </ul>
  );
}
