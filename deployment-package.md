# Deploying a new package version

Releases run in **two stages**, because `main` accepts neither unsigned commits
nor direct pushes:

1. [**Release — prepare version bump**](.github/workflows/release-prepare.yml) — triggered manually. Bumps the version and opens a pull request.
2. [**Release — publish on merge**](.github/workflows/release-publish.yml) — triggered by **merging** that pull request. Tags, builds, publishes to npm and cuts the GitHub Release.

Nothing is published until the release pull request is merged. Closing it
instead releases nothing and leaves no tag behind.

---

## How to trigger a release

1. Go to **Actions → Release — prepare version bump** in the GitHub repository.
2. Click **Run workflow**.
3. Fill in the two inputs described below, then click **Run workflow**.
4. **Review and merge the pull request it opens.** That merge is what publishes.

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

### `version_type` — how to bump the version

The workflow follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

| Option | When to use | Example (`1.2.3` → ?) |
|--------|-------------|------------------------|
| `patch` | Bug fixes, internal changes — **no API change** | `1.2.3` → `1.2.4` |
| `minor` | New features — **backward compatible** | `1.2.3` → `1.3.0` |
| `major` | Breaking changes — **not backward compatible** | `1.2.3` → `2.0.0` |

 [!WARNING]
 **First release of a new package**
 The deployment workflow **always** bumps the version using `yarn version` before publishing. It cannot publish the version defined in `package.json` as-is.
 
 If you want the first published version to be `1.0.0`:
 1. In your PR adding the package, set `"version": "0.0.0"` in its `package.json`.
 2. When triggering the manual release workflow, select **`major`** to bump the version to `1.0.0`.

---

## What the workflows do

**Stage 1 — prepare** (`release-prepare.yml`)

1. Bumps the version in the relevant `package.json` with `yarn version <type>`.
2. Commits it to a `release/<run-id>` branch and opens a pull request labelled `release`.

**Stage 2 — publish** (`release-publish.yml`, on merge of that pull request)

3. Works out which packages were released from the `package.json` files the pull request touched.
4. Creates a Git tag (`<package>-vX.Y.Z`).
5. Builds the package (`yarn workspace <package> run build`).
6. Publishes to **NPM** (`yarn npm publish --access public`).
7. Creates a **GitHub Release** with the changelog and installation instructions.
8. Closes the issues shipped by the release and updates their project status.

---

## Publishing from a local checkout

Only for the rare case where CI cannot do it. Use `release:<package>`, **not**
`publish:<package>` — the latter passes `--provenance`, which npm can only
generate inside GitHub Actions or GitLab CI and which fails locally with
`YN0091`:

```bash
yarn release:filigran-chatbot     # from the repository root
```

Two caveats. It publishes the version already in `package.json` **as-is** — it
does not bump — and it creates no tag, no GitHub Release and no provenance
attestation. Tag it by hand afterwards so the next changelog has a starting
point:

```bash
git tag "@filigran/chatbot-v<version>" <commit> && git push origin "@filigran/chatbot-v<version>"
```

---

## After the release

- The new version appears on the [NPM registry](https://www.npmjs.com/org/filigran).
- A GitHub Release is created — check the [Releases page](https://github.com/FiligranHQ/filigran-ui/releases).
