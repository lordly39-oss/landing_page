---
name: board-builder
description: GitHub API와 Vercel 기반 정적 게시판 홈페이지 구축 및 유지보수 스킬
---

# Board Builder Skill

본 스킬은 별도의 데이터베이스(RDB/NoSQL) 서버 없이 **GitHub API + Vercel Serverless Function**을 결합하여 무과금으로 안전하고 유지보수가 쉬운 서버리스 정적 게시판 웹사이트를 구축하는 규약 및 가이드입니다.

## 아키텍처 원리

1. **정적 호스팅 & Clean URLs**:
   - 프론트엔드는 HTML/Tailwind CSS/Vanilla JS 기반으로 Vercel에 정적 배포됩니다.
   - `vercel.json`의 `cleanUrls: true`로 `.html` 확장자 없이 깔끔한 URL 접근을 지원합니다.
2. **서버리스 설정 주입 (`/api/config.js`)**:
   - Vercel에 안전하게 등록된 `GITHUB_TOKEN` 및 `ADMIN_PASSWORD` 환경 변수를 `/api/config` 엔드포인트를 통해 프론트엔드로 안전하게 주입합니다.
3. **GitHub API 데이터 동기화 (`db.js`)**:
   - 게시글 작성, 수정, 삭제 시 GitHub REST API (`/repos/{owner}/{repo}/contents/data/posts.json`)를 호출하여 저장소 파일에 커밋/푸시를 직접 수행합니다.
4. **마크다운 렌더링**:
   - 외부 무거운 라이브러리 없이 자체 내장된 XSS-safe 마크다운 렌더러를 통해 본문을 풍부하게 표현합니다.
5. **관리자 인증**:
   - `sessionStorage` 기반의 심플한 관리자 세션 체크를 통해 허가된 사용자만 글쓰기/수정/삭제 권한을 가집니다.
