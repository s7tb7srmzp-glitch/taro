import { useState } from "react";
import type { CardDef } from "../data/cards";
import { SUIT_LABELS } from "../data/cards";
import "../styles/card.css";

const ROMAN = [
  "0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI",
];

function centerGlyph(card: CardDef): string {
  if (card.arcana === "major") return ROMAN[card.number ?? 0];
  if (card.arcana === "court") return SUIT_LABELS[card.suit!].symbol;
  if (card.number === 1) return "A" + SUIT_LABELS[card.suit!].symbol;
  return `${card.number}${SUIT_LABELS[card.suit!].symbol}`;
}

interface CardFaceProps {
  card: CardDef;
  size?: "sm" | "md" | "lg";
}

/** Renders a real card image if present under /public/cards, otherwise a
 * generated placeholder face so the app is fully usable before real art is added. */
export function CardFace({ card, size = "md" }: CardFaceProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={`card-face card-face--${size} card-face--${card.arcana}`}>
      {!imageFailed && (
        <img
          src={card.imagePath}
          alt={card.nameKo}
          className="card-face__img"
          style={{ display: imageLoaded ? "block" : "none" }}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageFailed(true)}
        />
      )}
      {!imageLoaded && (
        <div className="card-face__placeholder">
          <span className="card-face__corner card-face__corner--tl">{centerGlyph(card)}</span>
          <span className="card-face__glyph">{centerGlyph(card)}</span>
          <span className="card-face__name">{card.nameKo}</span>
          <span className="card-face__corner card-face__corner--br">{centerGlyph(card)}</span>
        </div>
      )}
    </div>
  );
}

export function CardBack({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`card-face card-face--${size} card-back`}>
      <div className="card-back__pattern" />
    </div>
  );
}
