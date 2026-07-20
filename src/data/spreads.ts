export interface SpreadPosition {
  id: string;
  label: string;
  /** Percent coordinates (0-100) within the spread board. */
  x: number;
  y: number;
  rotation?: number;
  /** Advisory hint shown under the slot label (e.g. "메이저 카드 권장"). */
  hint?: string;
  optional?: boolean;
}

export interface SpreadTemplate {
  id: string;
  name: string;
  summary: string;
  /** width/height of the board area this spread wants to render in. */
  boardAspect: number;
  positions: SpreadPosition[];
}

export const SPREADS: SpreadTemplate[] = [
  {
    id: "one-card",
    name: "원 카드",
    summary: "간단한 질문이나 오늘의 흐름을 한 장으로 본다.",
    boardAspect: 1.1,
    positions: [{ id: "card", label: "오늘의 카드", x: 50, y: 50 }],
  },
  {
    id: "three-card",
    name: "쓰리 카드 (기본)",
    summary: "과거-현재-미래 / 원인-나-결과의 가장 보편적인 3장 배열.",
    boardAspect: 2.6,
    positions: [
      { id: "past", label: "과거 / 원인", x: 18, y: 50 },
      { id: "present", label: "현재 / 나", x: 50, y: 50 },
      { id: "future", label: "미래 / 결과", x: 82, y: 50 },
    ],
  },
  {
    id: "mind-of-other",
    name: "상대방 마음을 알고 싶을 때",
    summary: "타인과 나의 관계, 상대방이 나를 보는 시각을 3장으로 본다.",
    boardAspect: 2.6,
    positions: [
      { id: "how-sees-me", label: "상대방이 보는 나의 모습", x: 18, y: 50 },
      { id: "feeling", label: "상대방이 나에게 가지는 감정", x: 50, y: 50 },
      { id: "first-impression", label: "상대방이 나에게 처음 가진 선입견", x: 82, y: 50 },
    ],
  },
  {
    id: "monthly-fortune",
    name: "이달의 운세 배열법",
    summary: "이번 달 전체 흐름을 주 단위로 확인한다. (메이저 카드만으로도 가능)",
    boardAspect: 2.2,
    positions: [
      { id: "overview", label: "이번 달 전체 흐름", x: 46, y: 22 },
      { id: "week1", label: "1주", x: 10, y: 65 },
      { id: "week2", label: "2주", x: 28, y: 65 },
      { id: "week3", label: "3주", x: 46, y: 65 },
      { id: "week4", label: "4주", x: 64, y: 65 },
      { id: "week5", label: "5주", x: 82, y: 65, optional: true, hint: "5주가 있는 달만" },
      { id: "advice", label: "조언", x: 88, y: 22, optional: true, hint: "해석이 애매할 때만" },
    ],
  },
  {
    id: "two-choice",
    name: "양자택일 (갈림길 배열법)",
    summary: "두 선택지 A/B 중 어느 쪽이 나은지 흐름을 비교한다.",
    boardAspect: 1.5,
    positions: [
      { id: "current", label: "현재 나의 상황·마음", x: 50, y: 85 },
      { id: "a-near", label: "A 선택 시 상황·마음 (가까운 미래)", x: 25, y: 58 },
      { id: "b-near", label: "B 선택 시 상황·마음 (가까운 미래)", x: 75, y: 58 },
      { id: "a-result", label: "A를 선택했을 때의 결과", x: 15, y: 22 },
      { id: "b-result", label: "B를 선택했을 때의 결과", x: 85, y: 22 },
    ],
  },
  {
    id: "horseshoe",
    name: "말편자 배열법",
    summary: "말굽 모양으로 6개월 스팬의 흐름을 본다.",
    boardAspect: 1.9,
    positions: [
      { id: "current", label: "현재 상황", x: 12, y: 78 },
      { id: "upcoming", label: "일어날 일 (떠오르는 문제)", x: 26, y: 40 },
      { id: "core", label: "문제의 핵심", x: 50, y: 15 },
      { id: "near-future", label: "가까운 미래 (3개월)", x: 74, y: 40 },
      { id: "far-future", label: "먼 미래 (6개월)", x: 88, y: 78 },
    ],
  },
  {
    id: "separation-combination",
    name: "카드리딩 — 분리와 결합 배열",
    summary: "없애야 할 것 / 관리해야 할 것 / 이룰 것을 정리한다.",
    boardAspect: 2.4,
    positions: [
      { id: "remove", label: "내가 없애야 할 것 (분리)", x: 18, y: 55 },
      { id: "manage", label: "내가 관리해야 할 것 (결합)", x: 45, y: 55 },
      { id: "achieve", label: "성취하게 될 것 (결과)", x: 72, y: 55 },
      { id: "support", label: "보조카드", x: 92, y: 18, optional: true, hint: "해석이 애매할 때만" },
    ],
  },
  {
    id: "separation-78",
    name: "분리배열법 (78장 전체 — 응용 예)",
    summary: "메이저(원형·상징)와 마이너(구체적 행동)를 나눠서 본다.",
    boardAspect: 1.5,
    positions: [
      { id: "major-past", label: "과거 (메이저)", x: 20, y: 20, hint: "메이저 카드 권장" },
      { id: "major-present", label: "현재 (메이저)", x: 50, y: 20, hint: "메이저 카드 권장" },
      { id: "major-future", label: "미래 (메이저)", x: 80, y: 20, hint: "메이저 카드 권장" },
      { id: "minor-past", label: "과거 (마이너, 구체적 행동)", x: 20, y: 55, hint: "코트/핍 카드 권장" },
      { id: "minor-present", label: "현재 (마이너, 구체적 행동)", x: 50, y: 55, hint: "코트/핍 카드 권장" },
      { id: "minor-future", label: "미래 (마이너, 구체적 행동)", x: 80, y: 55, hint: "코트/핍 카드 권장" },
      { id: "advice", label: "조언 (전반적인 메시지)", x: 50, y: 87 },
    ],
  },
  {
    id: "new-year-fortune",
    name: "타로카드 배열법 — 신년운세",
    summary: "78장 전체를 사용해 한 해 12개월 흐름과 총평을 본다.",
    boardAspect: 1.3,
    positions: [
      { id: "spring-1", label: "봄 · 1월", x: 13, y: 10 },
      { id: "spring-2", label: "봄 · 2월", x: 33, y: 10 },
      { id: "spring-3", label: "봄 · 3월", x: 53, y: 10 },
      { id: "summer-1", label: "여름 · 4월", x: 13, y: 33 },
      { id: "summer-2", label: "여름 · 5월", x: 33, y: 33 },
      { id: "summer-3", label: "여름 · 6월", x: 53, y: 33 },
      { id: "autumn-1", label: "가을 · 7월", x: 13, y: 58 },
      { id: "autumn-2", label: "가을 · 8월", x: 33, y: 58 },
      { id: "autumn-3", label: "가을 · 9월", x: 53, y: 58 },
      { id: "winter-1", label: "겨울 · 10월", x: 13, y: 82 },
      { id: "winter-2", label: "겨울 · 11월", x: 33, y: 82 },
      { id: "winter-3", label: "겨울 · 12월", x: 53, y: 82 },
      { id: "situation", label: "해당 연도에 처하는 상황", x: 82, y: 20 },
      { id: "attitude", label: "필요한 자세 (유의점)", x: 82, y: 50 },
      { id: "outcome", label: "전반적인 결과", x: 82, y: 80 },
    ],
  },
  {
    id: "relationship-78",
    name: "관계 배열법 (78장 전체 — 말편자 응용)",
    summary: "연인·부부 등 나와 상대방 관계의 6개월 흐름을 본다.",
    boardAspect: 1.6,
    positions: [
      { id: "me", label: "나", x: 42, y: 83 },
      { id: "partner", label: "상대방", x: 58, y: 83 },
      { id: "current", label: "둘의 현재 상황", x: 13, y: 56 },
      { id: "upcoming", label: "일어날 일 (떠오르는 문제)", x: 25, y: 28 },
      { id: "core", label: "문제 핵심", x: 50, y: 11 },
      { id: "near-future", label: "가까운 미래 (3개월)", x: 75, y: 28 },
      { id: "far-future", label: "먼 미래 (6개월)", x: 87, y: 56 },
    ],
  },
  {
    id: "compatibility-heart",
    name: "나만의 배열법 만들기 — 궁합배열법",
    summary: "하트 모양으로 두 사람의 궁합과 관계를 다각도로 본다.",
    boardAspect: 1.15,
    positions: [
      { id: "start", label: "시작의 상황", x: 50, y: 12 },
      { id: "me", label: "나", x: 27, y: 26 },
      { id: "partner", label: "상대방", x: 73, y: 26 },
      { id: "my-wish", label: "내가 바라는 것", x: 10, y: 50 },
      { id: "partner-wish", label: "상대방이 바라는 것", x: 90, y: 50 },
      { id: "my-worry", label: "내 불안·걱정 (속마음)", x: 24, y: 73 },
      { id: "partner-worry", label: "상대방 불안·걱정 (속마음)", x: 76, y: 73 },
      { id: "result", label: "결과 (3~6개월 후 관계)", x: 50, y: 90 },
      { id: "advice", label: "조언", x: 50, y: 52 },
    ],
  },
  {
    id: "celtic-cross",
    name: "켈틱 크로스 배열법 (일반형 — 78장)",
    summary: "종합적인 심층 리딩을 위한 정통 10장 배열.",
    boardAspect: 1.25,
    positions: [
      { id: "present", label: "현재 상황", x: 30, y: 45 },
      { id: "challenge", label: "장애 / 도움", x: 30, y: 58, rotation: 90 },
      { id: "unconscious", label: "무의식 (모르고 있는 것)", x: 30, y: 85 },
      { id: "past", label: "과거", x: 8, y: 50 },
      { id: "conscious", label: "의식 (알고 있는 것)", x: 30, y: 15 },
      { id: "near-future", label: "가까운 미래", x: 54, y: 50 },
      { id: "self-view", label: "내가 보는 시각 (주관)", x: 82, y: 90 },
      { id: "others-view", label: "주변이 보는 시각 (객관)", x: 82, y: 63 },
      { id: "hopes-fears", label: "희망 / 두려움", x: 82, y: 36 },
      { id: "outcome", label: "결과 (최종)", x: 82, y: 9 },
    ],
  },
];

export const SPREADS_BY_ID: Record<string, SpreadTemplate> = Object.fromEntries(
  SPREADS.map((s) => [s.id, s]),
);
