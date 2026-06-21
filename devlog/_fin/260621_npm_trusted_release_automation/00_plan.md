# npm Trusted Release Automation Plan

## Goal

Convert agbrowse release automation from local `npm publish` fallback scripts to a
GitHub Actions-only npm Trusted Publishing flow, then publish the next version.

The npm package settings are already configured:

- Package: `agbrowse`
- Trusted Publisher: GitHub Actions
- Repository: `lidge-jun/agbrowse`
- Workflow filename: `release.yml`
- Allowed action: `npm publish`
- Publishing access: two-factor authentication required and tokens disallowed

## Repo Facts

- Current branch: `dev`
- Default branch: `main`
- Current package version: `0.1.14`
- Current npm latest: `0.1.14`
- Current release workflow exists at `.github/workflows/release.yml`
- Current local scripts can still publish directly:
  - `scripts/release.sh`
  - `scripts/release-preview.sh`

## Target Behavior

Release ownership moves to GitHub Actions:

1. Local scripts prepare a release commit and dispatch GitHub Actions.
2. GitHub Actions verifies package version, runs release gates, and publishes via OIDC.
3. No local script runs `npm publish` for real.
4. Real publish requires `--publish`; dry-run is the default.
5. Release workflow creates the npm-visible version, git tag, and GitHub Release only after a successful real publish.

## File Plan

### MODIFY `.github/workflows/release.yml`

Replace tag-checkout publishing with version-driven dispatch:

- Inputs:
  - `version`: required package version, must equal `package.json`
  - `tag`: `latest` or `preview`, default `latest`
  - `dry-run`: boolean, default `true`
- Permissions:
  - `contents: write`
  - `actions: read`
  - `id-token: write`
- Concurrency:
  - `group: release`
  - `cancel-in-progress: false`
- Steps:
  - checkout `main` with `fetch-depth: 0`
  - setup Node 24 with registry URL
  - install `npm@latest`
  - `npm ci`
  - verify `package.json` version equals input `version`
  - require workflow to run from `refs/heads/main`
  - run release gates:
    - `npm audit --audit-level=high`
    - `npm run typecheck`
    - `npm test`
    - `npm run test:mcp`
    - `npm run test:source-audit`
    - `npm run test:trace-policy`
    - `npm run test:release-gates`
    - `npm run test:eval-fixtures`
    - `npm run eval:web-ai:fixtures`
    - `npm run benchmark:trajectory -- --help`
    - `npm run gate:all`
    - `git diff --check`
    - `npm pack --dry-run`
  - dry-run:
    - `npm publish --dry-run --access public --tag "$NPM_DIST_TAG"`
  - real publish:
    - `npm publish --access public --tag "$NPM_DIST_TAG"`
    - poll `npm view "agbrowse@$RELEASE_VERSION" version`
    - print `npm dist-tag ls agbrowse`
    - create `v$RELEASE_VERSION` tag on the release commit
    - create/update GitHub Release with generated commit notes

### MODIFY `scripts/release.sh`

Convert to dispatch-only release helper:

- Parse:
  - version/bump arg: empty, semver bump, or explicit semver
  - `--tag latest|preview`
  - `--publish`
  - positional `watch` to watch the latest `release.yml` run
- Require:
  - clean worktree
  - `main` branch
  - `gh` installed and authenticated
- Local preflight:
  - `npm ci`
  - `npm run typecheck`
  - `npm run test:release-gates`
  - `npm pack --dry-run >/dev/null`
- Version:
  - bump `package.json` and `package-lock.json` with `npm version --no-git-tag-version`
  - refresh structure counts with `npm run fix:counts`
  - commit `release: v<version>` if files changed
- Push:
  - `git push origin main`
- Dispatch:
  - `gh workflow run release.yml --repo lidge-jun/agbrowse --ref main -f version=<version> -f tag=<tag> -f dry-run=<true|false>`
  - capture the newest release run for the pushed commit with `gh run list --workflow release.yml --commit <sha> --json databaseId,createdAt,status,headSha`
  - watch that specific run with `gh run watch <run-id> --exit-status`

### MODIFY `scripts/release-preview.sh`

Reduce preview release to a wrapper:

- Compute next preview version from npm latest or provided base version.
- Preserve the current preview algorithm:
  - base version defaults to next patch after npm latest
  - explicit first arg overrides base version
  - `PREID` env overrides `preview`
  - `STAMP` env overrides `date +%Y%m%d%H%M%S`
- Call `scripts/release.sh <version> --tag preview`, forwarding `--publish` when provided.
- Do not run local `npm publish`.

### MODIFY `package.json`

Keep existing script names:

- `release`: `bash scripts/release.sh`
- `release:preview`: `bash scripts/release-preview.sh`

No user-facing package command change is required.

### MODIFY `package-lock.json`

Keep the release workflow's high-severity audit gate green:

- update transitive release/test tooling when `npm audit --audit-level=high`
  reports a blocking advisory
- keep `package.json` dependency ranges unchanged unless a direct dependency
  bump is required

### MODIFY `README.md`

Rewrite the maintainer release section to match the new contract:

- Releases are dispatched to GitHub Actions and published through npm Trusted Publishing/OIDC.
- Local real `npm publish` is not supported by the release scripts.
- `npm run release -- 0.1.15` performs dry-run release validation by default.
- `npm run release -- 0.1.15 --publish` performs the real publish through GitHub Actions.
- `npm run release:preview` creates a preview version and dispatches a dry-run by default.
- `npm run release:preview -- --publish` performs a real preview publish.
- Remove `AGBROWSE_PUBLISH_VIA_GITHUB`.
- Document that release commands must run on clean `main`; feature branches must merge to `main` first.

### MODIFY `structure/release_gates.md`

Update release script coverage:

- `release.yml` is Trusted Publishing/OIDC-only.
- `npm run release` is local preflight + version commit + dispatch.
- `npm run release:preview` is preview wrapper.
- Local real `npm publish` is no longer allowed.

### MODIFY `structure/str_func.md`

Run `npm run fix:counts` after script/doc changes.

### MODIFY `devlog/00_index.md`

Add this plan to the active `_plan` table during implementation. Move to `_fin`
only after release automation and next-version publish are verified.

## Verification Plan

Local gates before commit:

- `bash -n scripts/release.sh scripts/release-preview.sh`
- `npm run typecheck`
- `npm run test:release-gates`
- `npm run gate:all`
- `npm pack --dry-run --json`
- `git diff --check`

Integration branch sequencing:

1. Implement on `dev`.
2. Commit the automation changes.
3. Push `dev`.
4. Merge to `main` before running `npm run release`; the release helper must refuse non-`main`.
5. Run dry-run and real release from clean `main`.

GitHub gates after push:

- Dispatch `release.yml` dry-run for the new version from `main`.
- Watch to success.
- Dispatch `release.yml` real publish for the new version from `main`.
- Watch to success.
- Verify:
  - `npm view agbrowse@<next-version> version`
  - `npm dist-tag ls agbrowse`
  - `gh release view v<next-version> --repo lidge-jun/agbrowse`
  - `git ls-remote --tags origin v<next-version>`

## Release Version

Next latest release target: `0.1.15`.

## PABCD Evidence Contract

- P evidence: this plan file.
- A evidence: independent plan audit output.
- B evidence: changed workflow/scripts/docs plus local syntax/type/doc gates.
- C evidence: full local release gates plus pushed commit and GitHub dry-run release success.
- D evidence: real GitHub Actions publish success, npm registry smoke, git tag, GitHub Release.

## Atomicity Requirements

The workflow input contract changes from old `tag`/`npm_tag` to new
`version`/`tag`/`dry-run`, where `tag` changes meaning from git tag to npm
dist-tag. Therefore these files must ship in one commit:

- `.github/workflows/release.yml`
- `scripts/release.sh`
- `scripts/release-preview.sh`
- `README.md`
- `package-lock.json` when the release audit gate needs a transitive fix
- `structure/release_gates.md`
- `structure/str_func.md` when `npm run fix:counts` changes release script counts

Partial deployment would break either old script dispatch or new workflow input
validation.

## Workflow Post-Publish Details

The workflow must create git tags only after a successful real npm publish:

1. Configure git identity in CI:
   - `git config user.name "github-actions[bot]"`
   - `git config user.email "41898282+github-actions[bot]@users.noreply.github.com"`
2. Fetch tags from origin.
3. Refuse if `v$RELEASE_VERSION` exists and points to a different commit.
4. Create missing `v$RELEASE_VERSION` on `$GITHUB_SHA`.
5. Push `refs/tags/v$RELEASE_VERSION`.
6. Create or update GitHub Release for that tag.

## Final Closeout Evidence

Status: shipped.

Implementation commits:

- `c701b7a` converted release automation to GitHub Actions Trusted Publishing.
- `93504b5` bumped the package to `0.1.15`.
- `3eadd0d` removed the blocking Playwright browser install from release CI by
  injecting runner Chrome into browser smoke tests.

Verification evidence:

- Local gates passed: `npm run typecheck`, `npm run test:release-gates`,
  `npm run gate:all`, `actionlint .github/workflows/release.yml`,
  `git diff --check`, and `npm pack --dry-run`.
- GitHub Actions dry-run release succeeded:
  <https://github.com/lidge-jun/agbrowse/actions/runs/27892063964>.
- GitHub Actions real publish succeeded:
  <https://github.com/lidge-jun/agbrowse/actions/runs/27892124575>.
- npm registry verifies `agbrowse@0.1.15`.
- npm dist-tags verify `latest: 0.1.15`.
- GitHub Release verifies `v0.1.15` at
  <https://github.com/lidge-jun/agbrowse/releases/tag/v0.1.15>.
- Remote tag verifies `refs/tags/v0.1.15` points at
  `3eadd0df6261aacbdf89d52b63a095fea017605a`.
