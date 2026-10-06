<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 문구 작성 규칙

- UI, 문서, 답변에는 기능과 사용에 필요한 문장만 간결하게 작성한다.
- 불필요한 미사여구, 홍보성 문구, 감성 문구, 장식용 영문, 반복 안내는 작성하지 않는다.
- 버튼·제목은 동작과 대상을 명확히 쓰고, 설명은 사용자의 판단이나 조작에 필요한 경우에만 추가한다.

# 디자인 기준

- 앞으로 모든 작업은 시작 전에 루트의 `DESIGN.md`를 읽고 해당 기준을 참고한다.
- UI를 추가하거나 수정할 때 색상, 서체, 크기, 간격, 형태, 반응형 구성을 `DESIGN.md`에 맞춘다.
- 화면 용도와 접근성에 맞게 크기를 조정하되, 임의의 디자인 체계를 추가하지 않는다.
- 디자인을 적용할 때도 위 문구 작성 규칙을 유지한다.
- 모바일 사용을 우선한다. 320~430px에서 핵심 조작과 결과를 확인하고, 터치 영역·입력 글자 크기·가상 키보드·안전 영역을 고려한다. 데스크톱도 함께 확인한다.
