# Deploying a new package version

Releases for all Filigran packages are handled via the GitHub Actions workflow [**Release and Publish to NPM**](.github/workflows/release-version.yml).  
It is triggered **manually** from the GitHub Actions tab — no push or tag is required to start it.

---

The workflow publishes **the version already committed in `package.json`**. It does not bump
anything, so releasing is a two-step process: bump the version in a pull request, then run the
workflow.

---

## Step 1 — bump the version in a pull request

Edit the `version` field in the package's `package.json` as part of a normal reviewed PR,
following [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

| Change | When to use | Example |
|--------|-------------|---------|
| `patch` | Bug fixes, internal changes — **no API change** | `1.2.3` → `1.2.4` |
| `minor` | New features — **backward compatible** | `1.2.3` → `1.3.0` |
| `major` | Breaking changes — **not backward compatible** | `1.2.3` → `2.0.0` |

You can bump in the PR that makes the change, or in a small dedicated PR afterwards.

> [!IMPORTANT]
> **A minor or major `@filigran/icon` bump needs a second edit.** `@filigran/ui` declares a
> range for `@filigran/icon` in its `peerDependencies` (e.g. `^0.24.3`). A patch bump still
> satisfies it and needs nothing further; a minor or major bump means widening that range in
> `packages/filigran-ui/package.json`. Because the range is recorded in `yarn.lock`, run
> `yarn install` in the same PR or `yarn install --immutable` fails in CI. `yarn version` used
> to keep these aligned, and the release workflow no longer runs it.

> [!NOTE]
> **First release of a new package.** Set `version` to whatever you want published — the
> workflow publishes it verbatim. To ship `1.0.0` first, commit `"version": "1.0.0"`.

---

## Step 2 — run the release workflow

1. Go to **Actions → Release and Publish to NPM** in the GitHub repository.
2. Click **Run workflow**.
3. Choose the `package` input described below, then click **Run workflow**.

---

## Inputs

### `package` — which package to release

| Value | Package | Description |
|-------|---------|-------------|
| `@filigran/rich-text-editor` | `packages/filigran-rich-text-editor` | TipTap-based rich text editor with MUI toolbar |
| `@filigran/ui` | `packages/filigran-ui` | Core React component library (Radix UI + Tailwind CSS) |
| `@filigran/icon` | `packages/filigran-icon` | Icon library auto-generated from Figma SVGs |
| `@filigran/chatbot` | `packages/filigran-chatbot` | Standalone chatbot panel component |
| `all` | All of the above | Releases all four packages in a single run |

> **Tip:** Choose `all` only when you need a coordinated release of the entire design system.

---

## What the workflow does

1. Reads the version from each selected `package.json`, and checks it against the registry.
   A package whose version is already on NPM is **skipped with a warning** rather than
   failing the run, so one up-to-date package cannot block the others when releasing `all`.
   If nothing is left to release, the run fails with an explanatory message.
2. Builds each package to be released (`yarn workspace <package> run build`).
3. Publishes to **NPM** (`yarn npm publish --access public`).
4. Creates a Git tag (`<package>-vX.Y.Z`) — **after** publishing succeeds.
5. Creates a **GitHub Release** with installation instructions.

The workflow never writes to `main`. That is deliberate: the default branch requires signed
commits and pull-request review, so a workflow that pushed its own version bump could not
complete (see #383).

Tagging after publishing is also deliberate. Tagging first meant a failed publish left a tag
pointing at a version that was never released, and that stale tag then blocked re-running the
release.

---

## After the release

- The new version appears on the [NPM registry](https://www.npmjs.com/org/filigran).
- A GitHub Release is created — check the [Releases page](https://github.com/FiligranHQ/filigran-ui/releases).
