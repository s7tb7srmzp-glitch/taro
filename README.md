# 타로 리딩 앱

수동으로 카드를 선택해 스프레드에 배치하고, AI 해석을 받을 수 있는 개인용 타로 리딩 앱입니다.
자세한 기획 배경은 [`PLAN.md`](./PLAN.md)를 참고하세요.

## 시작하기

```bash
npm install
cp .env.example .env   # ANTHROPIC_API_KEY 입력
npm run dev
```

브라우저에서 `http://localhost:5173` 로 접속합니다.

## 주요 기능

- 11개(원카드/쓰리카드 포함 12개) 스프레드 지원, 메이저/코트/핍 탭에서 카드를 직접 선택해 배치
- 천 질감 배경 위에 실제로 카드를 펼쳐놓은 듯한 스프레드 뷰
- 내담자 이름 / 질문 / 날짜(달력) 입력
- "AI 해석" 버튼으로 Claude API 연동 해석 (로컬 dev 서버가 API 키를 보관, 브라우저에는 노출되지 않음)
- 리딩 저장/불러오기 (브라우저 localStorage)
- 인쇄 (`window.print()` 기반 전용 레이아웃)

## 카드 이미지 교체

`src/data/cards.ts`의 각 카드는 `imagePath`로 `/cards/{id}.jpg` 형태의 경로를 가리킵니다.
`public/cards/` 아래에 같은 파일명으로 실제 카드 이미지를 넣으면 자동으로 그 이미지가 쓰이고,
없으면 이름/숫자 기반의 생성된 카드 얼굴이 대신 표시됩니다.

## 기술 스택

React + TypeScript + Vite. AI 호출은 별도 백엔드 없이 Vite dev 서버 미들웨어(`server/interpret.ts`)로 처리합니다.
