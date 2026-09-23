# B/1-1 · 포트폴리오

- React, Vue, jQuery, Bootstrap, Tailwind 및 다른 런타임 라이브러리를 사용하지 않습니다.
- `index.html`, `css/`, `js/`, `images/` 구조와 상대 경로를 유지합니다.
- `const`와 `let`, `addEventListener`, 외부 CSS, `defer` 스크립트를 사용합니다. 인라인 이벤트와 인라인 스타일은 금지합니다.
- 상태는 `js/app.js`의 state에 두고 이벤트 → 상태 변경 → render 함수의 흐름을 유지합니다.
- 공개 프로필은 `Zero-error123`입니다. 실제 이름, 이메일, 위치, 비공개 저장소 정보를 추가하지 않습니다.
- GitHub API 토큰을 프론트엔드에 넣지 않습니다. API 실패를 가짜 데이터로 대체하지 않습니다.
- Contact는 검증 체험용입니다. 별도 요청과 연동 없이 실제 전송을 했다고 표시하지 않습니다.
- 768px, 1024px 반응형과 키보드, 다크 모드, 모션 감소 설정을 유지합니다.
- 수정한 기능을 Chrome에서 확인하고 README의 검증 기록 및 스크린샷을 실제 결과에 맞춥니다.
- 배포 워크플로는 루트 `.github/workflows/pages.yml`입니다. 이후 과제가 추가되어도 이 과제만 배포합니다.
