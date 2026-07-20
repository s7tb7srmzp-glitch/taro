import { SPREADS } from "../data/spreads";

interface SpreadPickerProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SpreadPicker({ selectedId, onSelect }: SpreadPickerProps) {
  return (
    <div className="spread-picker">
      {SPREADS.map((spread) => (
        <button
          key={spread.id}
          type="button"
          className={`spread-picker__item${spread.id === selectedId ? " spread-picker__item--selected" : ""}`}
          onClick={() => onSelect(spread.id)}
        >
          <span className="spread-picker__name">{spread.name}</span>
          <span className="spread-picker__count">{spread.positions.length}장</span>
          <span className="spread-picker__summary">{spread.summary}</span>
        </button>
      ))}
    </div>
  );
}
