# Deploying a new package version

Releases for all Filigran packages are handled via the GitHub Actions workflow [**Release and Publish to NPM**](.github/workflows/release-version.yml).  
It is triggered **manually** from the GitHub Actions tab — no push or tag is required to start it.

---

## How to trigger a release

1. Go to **Actions → Release and Publish to NPM** in the GitHub repository.
2. Click **Run workflow**.
3. Fill in the two inputs described below, then click **Run workflow**.

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

## What the workflow does

1. Bumps the version in the relevant `package.json` with `yarn version <type>`.
2. Commits and pushes the change (`chore: bump <package> to vX.Y.Z`).
3. Creates a Git tag (`<package>-vX.Y.Z`).
4. Builds the package (`yarn workspace <package> run build`).
5. Publishes to **NPM** (`yarn npm publish --access public`).
6. Creates a **GitHub Release** with installation instructions.

---

## After the release

- The new version appears on the [NPM registry](https://www.npmjs.com/org/filigran).
- A GitHub Release is created — check the [Releases page](https://github.com/FiligranHQ/filigran-ui/releases).
