# Messaging Platform

Implement the agreed requirements in project.md. Follow the repo-local lean-senior-engineering, research-plan-implement, systematic-debugging, and verification-before-completion skills when relevant. Read only selected workflows and references.

Use TypeScript, Next.js, NestJS, PostgreSQL, and BullMQ/Redis. Default development and messaging simulation must be free. Keep company/team authorization, approval, exact budget accounting, and audit evidence authoritative on the server. Do not replace them with UI-only checks or fake production integrations.

Maintain .agents/artifacts/implementation/plan.md and handoff.md at meaningful milestones. Never report the complete brief implemented while acceptance criteria remain unverified. Respect user edits. Do not deploy, send real messages, purchase credits, or use manual Codex resets. The user authorized the current tested-source upload to the private RaditteAnggoro/one-ums-portal repository; verify privacy before uploading. Future publication or deployment requires its own authorization.

Use Node.js 24+ and the pnpm version pinned in package.json. Prefer an existing installed or bundled runtime; keep machine-specific runtime paths in the ignored local handoff rather than application dependencies.

Commands (once dependencies are installed): pnpm typecheck; pnpm test; pnpm build. Development: pnpm infra:local, pnpm db:setup, pnpm dev. The embedded local PostgreSQL is a real native PostgreSQL server; normal deployments can supply DATABASE_URL. Redis/BullMQ require a real Redis service. Never describe queue tests as passed without running against it.

Keep API secrets and generated .data/.runtime files out of source control. Bind local services to loopback. Use synthetic demonstration data and separate creator/approver accounts. UI language supports Bahasa Indonesia and English through the shared catalog and saved account preference. Keep user-authored content unchanged.

The UMS design reference is docs/ui-ux-specification.md; implementation mapping is docs/ui-implementation.md. Preserve the purple shared shell, themes, real operational routes and server-side message access controls. Keep NestJS as the existing authoritative TypeScript API. The reference mentions Spring Boot as a proposed integration, not an instruction to rewrite the backend during a UI task.
