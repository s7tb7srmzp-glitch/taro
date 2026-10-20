import type { CallFollowReading } from "../lib/types";
import { CARDS_BY_ID } from "../data/cards";
import { SPREADS_BY_ID } from "../data/spreads";
import { estimateSpeechSeconds } from "../lib/callText";
import { CallCardStrip } from "./CallCardStrip";
import { CardFace } from "./CardFace";

export function readingTypeLabel(reading: CallFollowReading): string {
  if (reading.kind === "spread") {
    return `새 스프레드 · ${(reading.spreadId && SPREADS_BY_ID[reading.spreadId]?.name) || reading.spreadId}`;
  }
  return `보충 카드 ${reading.cardIds?.length ?? 0}장`;
}

interface CallReadingNavProps {
  initialQuestion: string;
  readings: CallFollowReading[];
  /** null = the initial reading. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** Switches the top of the call screen between the initial reading and each follow-up reading. */
export function CallReadingNav({ initialQuestion, readings, selectedId, onSelect }: CallReadingNavProps) {
  const items = [
    { id: null, title: "최초 리딩", question: initialQuestion },
    ...readings.map((r) => ({ id: r.id as string | null, title: `후속 ${r.order}`, question: r.question })),
  ];
  return (
    <nav className="call-reading-nav no-print" aria-label="리딩 기록">
      {items.map((item) => (
        <button
          key={item.id ?? "initial"}
          type="button"
          aria-pressed={selectedId === item.id}
          className={`call-reading-nav__item${selectedId === item.id ? " call-reading-nav__item--on" : ""}`}
          onClick={() => onSelect(item.id)}
        >
          <span className="call-reading-nav__title">{item.title}</span>
          <span className="call-reading-nav__question">{item.question}</span>
        </button>
      ))}
    </nav>
  );
}

/** A past follow-up reading: its cards (in its own spread) and the result, read-only. */
export function CallFollowReadingView({ reading }: { reading: CallFollowReading }) {
  const spread = reading.kind === "spread" && reading.spreadId ? SPREADS_BY_ID[reading.spreadId] : undefined;
  const seconds = estimateSpeechSeconds(reading.result.conclusion);
  return (
    <div className="call-reading call-follow-reading">
      <p className="call-follow-reading__meta">
        후속 리딩 {reading.order} · {readingTypeLabel(reading)}
      </p>
      <p className="call-follow-reading__question">Q. {reading.question}</p>

      {spread ? (
        <CallCardStrip spread={spread} placements={reading.placements ?? {}} extraCards={[]} title="후속 배열" />
      ) : (
        <ul className="call-card-strip__list call-follow-reading__cards">
          {(reading.cardIds ?? []).map((id, i) => {
            const card = CARDS_BY_ID[id];
            return (
              <li key={id} className="call-card-strip__item call-card-strip__item--extra">
                {card && <CardFace card={card} size="sm" />}
                <span className="call-card-strip__pos">보충 {i + 1}</span>
                <span className="call-card-strip__name">{card?.nameKo ?? id}</span>
              </li>
            );
          })}
        </ul>
      )}

      {reading.result.conclusion && (
        <section className="call-core">
          <div className="call-core__head">
            <h3>📣 핵심 결론</h3>
            <span className={`call-core__badge${seconds > 18 ? " call-core__badge--long" : ""}`}>약 {seconds}초</span>
          </div>
          <p>{reading.result.conclusion}</p>
        </section>
      )}
      {reading.result.cards && (
        <details className="call-fold" open>
          <summary>🃏 카드별 해석</summary>
          <p className="call-fold__body-text">{reading.result.cards}</p>
        </details>
      )}
      {reading.result.relation && (
        <details className="call-fold">
          <summary>🔗 기존 상담과 연결되는 부분</summary>
          <p className="call-fold__body-text">{reading.result.relation}</p>
        </details>
      )}
      {reading.result.script && (
        <details className="call-fold">
          <summary>🗣 그때 한 말</summary>
          <p className="call-fold__body-text">{reading.result.script}</p>
        </details>
      )}
    </div>
  );
}
