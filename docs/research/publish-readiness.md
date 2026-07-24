# Publish readiness: `@dreki-gg/pi-workflows`

Researched 2026-07-24 against official npm documentation, the installed pi 0.82.0 documentation and loader source, and this repository.

## Verdict

The package source and tarball are ready for a first `0.1.0` publish after the repository fixes in this audit. All local gates pass, production dependencies have no known vulnerabilities, packed contents are complete, tests are excluded, and the packed extension loads through pi. The remaining work is one npm owner bootstrap sequence: publish the unpublished name from an authenticated session, create its matching GitHub release, configure trusted publishing, and remove the stale generated release branch.

## Repository fixes applied

- Added `homepage`, `bugs`, and Node `>=22.19.0` metadata to `package.json`.
- Removed the unused `@earendil-works/pi-ai` peer and marked every imported host-provided peer optional, preventing redundant downloads on git installs.
- Added `.gitattributes` with LF normalization; this fixes the Windows CI failure where `oxfmt --check` reported every file after CRLF checkout.
- Removed unused Bun setup from release CI and installed npm 11 explicitly before trusted publishing; npm OIDC requires npm `>=11.5.1`.
- Ordered lint before format verification in both workflows, matching the repository gate policy.

## One-time release blockers

### B1 — Bootstrap npm before OIDC

`npm view @dreki-gg/pi-workflows version` returns `E404`. npm trusted publishers are configured in an existing package's settings, so OIDC cannot authenticate this first publish. The current shell is also not authenticated (`npm whoami` returns `E401`).

After these changes reach `main`, publish `0.1.0` once from an npm-authenticated owner session. Complete a 2FA challenge only if the account or package policy requires it:

```bash
npm login
npm publish
```

Then configure the npm trusted publisher for GitHub owner `jalbarrang`, repository `pi-workflows`, workflow `release.yml`, and action `npm publish`. The public scoped package already has `publishConfig.access: "public"`; the repository URL and public visibility satisfy npm provenance requirements.

### B2 — Establish `0.1.0` as the release baseline

The release-please manifest starts at `0.1.0`, but no npm version, git tag, or GitHub release exists. The failed release run created branch `release-please--branches--main--components--pi-workflows` with a premature `0.2.0` update.

After publishing the final `main` commit, create the matching GitHub release and remove the stale generated branch:

```bash
gh release create v0.1.0 --target main --title v0.1.0 --notes "Initial release."
git push origin --delete release-please--branches--main--components--pi-workflows
```

This preserves `CHANGELOG.md` truthfully and gives release-please the baseline it expected.

## Resolved infrastructure issue

GitHub run `30121809873` created the release branch but failed with `GitHub Actions is not permitted to create or approve pull requests`. This audit enabled **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests** through the authenticated owner account while preserving read-only default workflow permissions.

## Verified clean

| Check                      | Result                                                     |
| -------------------------- | ---------------------------------------------------------- |
| `pnpm typecheck`           | pass                                                       |
| `pnpm lint`                | pass, zero warnings                                        |
| `pnpm format:check`        | pass                                                       |
| `pnpm line-count`          | pass after keeping this report under 100 lines             |
| `pnpm test`                | 95 pass, 0 fail                                            |
| `pnpm audit --prod`        | no known vulnerabilities                                   |
| `npm pack --dry-run`       | 118 files; 55.4 kB packed; all 7 `.cjs` workers; no tests  |
| Packed install and pi load | pass with host peers omitted                               |
| GitHub Actions setting     | release PR creation enabled; default permissions read-only |

## Non-blocking advisories

- The runtime intentionally pins beta dependency `effect@4.0.0-beta.101`; README and AGENTS.md document the upgrade gate.
- `pi.image` or `pi.video` could improve package-gallery presentation, but the required `pi-package` keyword is present.
- `docs/` is intentionally not packed; `README.md` has no relative links into it.

## Verification commands

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm format:check && pnpm line-count && pnpm test
pnpm audit --prod
npm pack --dry-run
npm view @dreki-gg/pi-workflows version # E404 until bootstrap publish
```

## Primary sources

- npm package metadata and peer rules: <https://docs.npmjs.com/cli/v11/configuring-npm/package-json>
- npm trusted publishers, required CLI version, GitHub OIDC, and provenance: <https://docs.npmjs.com/trusted-publishers>
- npm's unresolved first-publish documentation issue: <https://github.com/npm/documentation/issues/1926>
- pi package contract: `/Users/jalbarran/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/docs/packages.md`
- pi TypeScript loading and production dependency behavior: `/Users/jalbarran/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
- pi npm/git install and host alias behavior: installed `dist/core/package-manager.js` and `dist/core/extensions/loader.js`
- Repository evidence: `package.json`, `pnpm-lock.yaml`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `CHANGELOG.md`, and GitHub runs `30121809891` / `30121809873`.
