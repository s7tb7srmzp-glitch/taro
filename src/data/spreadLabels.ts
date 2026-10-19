/**
 * Display-only short names for spread positions. The long `label` in spreads.ts is still what the
 * AI prompts and the card picker header use; these only shorten what is drawn under each card.
 */
const SHORT_LABELS: Record<string, Record<string, string>> = {
  "one-card": { card: "오늘의 카드" },
  "three-card": { past: "과거·원인", present: "현재·나", future: "미래·결과" },
  "mind-of-other": {
    "how-sees-me": "상대가 보는 나",
    feeling: "상대의 감정",
    "first-impression": "첫 선입견",
  },
  "monthly-fortune": {
    overview: "이달 전체",
    week1: "1주",
    week2: "2주",
    week3: "3주",
    week4: "4주",
    week5: "5주",
    advice: "조언",
  },
  "two-choice": {
    current: "현재",
    "a-near": "A 과정",
    "b-near": "B 과정",
    "a-result": "A 결과",
    "b-result": "B 결과",
  },
  horseshoe: {
    current: "현재",
    upcoming: "다가올 일",
    core: "문제 핵심",
    "near-future": "3개월 후",
    "far-future": "6개월 후",
  },
  "separation-combination": {
    remove: "없앨 것",
    manage: "관리할 것",
    achieve: "이룰 것",
    support: "보조",
  },
  "separation-78": {
    "major-past": "메이저 과거",
    "major-present": "메이저 현재",
    "major-future": "메이저 미래",
    "minor-past": "마이너 과거",
    "minor-present": "마이너 현재",
    "minor-future": "마이너 미래",
    advice: "조언",
  },
  "new-year-fortune": {
    "spring-1": "1월",
    "spring-2": "2월",
    "spring-3": "3월",
    "summer-1": "4월",
    "summer-2": "5월",
    "summer-3": "6월",
    "autumn-1": "7월",
    "autumn-2": "8월",
    "autumn-3": "9월",
    "winter-1": "10월",
    "winter-2": "11월",
    "winter-3": "12월",
    situation: "올해 상황",
    attitude: "필요한 자세",
    outcome: "전체 결과",
  },
  "relationship-78": {
    me: "나",
    partner: "상대",
    current: "둘의 현재",
    upcoming: "다가올 일",
    core: "문제 핵심",
    "near-future": "3개월 후",
    "far-future": "6개월 후",
  },
  "compatibility-heart": {
    start: "시작",
    me: "나",
    partner: "상대",
    "my-wish": "내 바람",
    "partner-wish": "상대 바람",
    "my-worry": "내 걱정",
    "partner-worry": "상대 걱정",
    result: "결과",
    advice: "조언",
  },
  "celtic-cross": {
    present: "현재",
    challenge: "장애/도움",
    unconscious: "무의식",
    past: "과거",
    conscious: "의식",
    "near-future": "가까운 미래",
    "self-view": "내 시각",
    "others-view": "주변 시각",
    "hopes-fears": "희망·두려움",
    outcome: "결과",
  },
};

export function shortLabel(spreadId: string, positionId: string, fallback: string): string {
  return SHORT_LABELS[spreadId]?.[positionId] ?? fallback;
}

/** Where the label sits relative to its card; defaults to "below". */
export const LABEL_ABOVE: Record<string, string[]> = {
  // The "present" card is crossed by the "challenge" card, so its label goes above it.
  "celtic-cross": ["present"],
};

/** Card pairs that overlap on purpose (the crossing card in a Celtic Cross). */
export const INTENDED_OVERLAPS: Record<string, [string, string][]> = {
  "celtic-cross": [["present", "challenge"]],
};
