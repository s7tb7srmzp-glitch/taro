# 타로 리딩 앱

수동으로 카드를 선택해 스프레드에 배치하고, AI 해석을 받을 수 있는 개인용 타로 리딩 앱입니다.
자세한 기획 배경은 [`PLAN.md`](./PLAN.md)를 참고하세요.

## 폰에 앱처럼 설치하기 (PWA)

이 앱은 GitHub Pages로 배포되어 있고, 홈 화면에 아이콘으로 설치해서 쓸 수 있습니다.

1. 배포 주소로 접속: `https://<github-사용자명>.github.io/taro/`
2. **AI 해석 설정**: 우측 상단 "설정" 버튼 → Anthropic API 키 입력 → 저장 (이 폰의 브라우저에만 저장되고, 해석 요청 시 Claude로 직접 전송됩니다. 서버에는 저장되지 않습니다)
3. **홈 화면에 추가**:
   - iPhone(Safari): 공유 버튼 → "홈 화면에 추가"
   - Android(Chrome): 메뉴(⋮) → "홈 화면에 추가" / "앱 설치"
4. 홈 화면의 아이콘을 누르면 브라우저 주소창 없이 앱처럼 바로 실행됩니다.

> 처음 배포할 때는 저장소 Settings → Pages → Build and deployment → Source를
> **GitHub Actions**로 한 번 설정해줘야 합니다. 그 이후로는 이 브랜치에 푸시할 때마다 자동 배포됩니다.

## 로컬에서 개발하기

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173/taro/` 로 접속합니다. AI 해석 키는 앱 안의 "설정" 화면에서 입력합니다 (`.env` 불필요).

## 주요 기능

- 11개(원카드/쓰리카드 포함 12개) 스프레드 지원, 메이저/코트/핍 탭에서 카드를 직접 선택해 배치
- 천 질감 배경 위에 실제로 카드를 펼쳐놓은 듯한 스프레드 뷰
- 내담자 이름 / 질문 / 날짜(달력) 입력
- "AI 해석" 버튼으로 Claude API 연동 해석 — 브라우저에서 Claude API로 직접 요청 (서버 없음, 개인 사용 전제)
- 리딩 저장/불러오기 (브라우저 localStorage)
- 인쇄 (`window.print()` 기반 전용 레이아웃)
- PWA: 홈 화면에 추가해서 앱처럼 실행 가능

## 카드 이미지

`public/cards/`에 라이더-웨이트-스미스 덱 78장 실제 이미지가 이미 들어있습니다
(`major-00.jpg` ~ `major-21.jpg`, `court-{suit}-{rank}.jpg`, `pip-{suit}-{01~10}.jpg`).
`src/data/cards.ts`의 각 카드는 이 규칙으로 `imagePath`를 가리키며, 만약 해당 경로에 파일이
없으면 이름/숫자 기반의 생성된 카드 얼굴이 대신 표시됩니다. 다른 이미지로 바꾸고 싶으면 같은
파일명 규칙으로 `public/cards/`의 파일을 교체하면 됩니다.

## 보안 참고사항

AI 해석은 브라우저에서 Anthropic API로 직접 요청합니다 (`anthropic-dangerous-direct-browser-access`
헤더 사용). API 키는 이 기기의 localStorage에만 저장되고 다른 어떤 서버로도 전송되지 않지만,
브라우저 개발자 도구의 네트워크 탭을 열면 키가 노출될 수 있습니다. 본인만 쓰는 개인용 기기에서만
사용하고, 공용 컴퓨터에는 키를 저장하지 마세요.

## 기술 스택

React + TypeScript + Vite. 별도 백엔드 없이 완전한 정적 사이트로 빌드되어 GitHub Pages에 배포됩니다.
