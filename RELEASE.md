# Release process

1. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`.
2. Add a changeset for any published package updates.
3. Execute `pnpm changeset version` to bump versions and generate changelogs.
4. Publish with `pnpm changeset publish` using npm credentials with provenance enabled.
5. Build and deploy docs to Cloudflare Pages.
6. Verify example circuits and Playground import/export flows.
7. Tag the release (for example, `v1.0.0`).
