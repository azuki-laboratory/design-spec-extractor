@AGENTS.md

## Claude Code 전용
- 서브 에이전트: scout(탐색, haiku) / tester(테스트, haiku) / reviewer(리뷰, sonnet) / architect(설계, opus) — 해당 작업은 위임할 것
- 테스트·빌드 명령은 .claude/settings.json에 사전 승인됨. `npm run publish`는 deny — 사용자가 직접 실행
