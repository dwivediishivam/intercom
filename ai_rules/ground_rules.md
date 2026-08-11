# Project Working Rules

## Repository and privacy

- Treat all source-control history, branches, pull requests, commits, documentation, and public copy as a normal software project. Do not reproduce private project background or source materials.
- Never commit, push, copy into repository documentation, or expose raw source material.
- Keep source material private and ignored by Git.
- Never commit API keys, tokens, passwords, connection strings, `.env` files, or local credential files. Use deployment-provider environment variables instead.
- Do not print or echo credentials in terminal output, logs, documentation, or commits.

## Git workflow

- Initialize and use the configured private GitHub repository for the project.
- Commit meaningful, cohesive increments with imperative commit messages.
- Commit after completed milestones or logically independent work; avoid one large final commit.
- Review `git status` and the staged diff before every commit to ensure secrets and private source material are excluded.

## AI integration and budget

- Use the user-provided OpenAI API key only on the server, never in browser code or the widget.
- Default to a cost-efficient mini/nano text model and low reasoning effort for summaries, drafts, classification, and article relevance tasks.
- Send a compact, bounded conversation excerpt and concise structured instructions; cap output length.
- Cache summaries, refresh only after meaningful new content, and use deterministic/local logic when it is sufficient.
- Track request usage and provide graceful fallback when OpenAI is unavailable, slow, or budget-limited.
- Design for a total development/demo API spend of approximately USD 5.

## Product and design boundaries

- Implement real, testable product flows rather than mock-only interfaces.
- Use managed services where they reduce delivery risk, but preserve security and tenant isolation.
- Do not create the application’s visual UI design. A separate design tool will provide UI direction later.
- System architecture, database design, API behavior, implementation, integration, accessibility, and engineering quality remain in scope.
