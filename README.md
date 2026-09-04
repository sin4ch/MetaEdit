# MetaEdit

MetaEdit turns a website into a shared editing workspace. Visitors see the normal page. A collaborator opens the same page through the `metaedit.` subdomain, authenticates, clicks an element, and leaves a targeted change request. A WebMCP-capable browser agent can read that request and create a constrained preview. Collaborators review it together, then the workspace owner opens a pull request from the same page.

The product idea is simple: edit software from inside the software.

## What this demo proves

MetaEdit uses the browser's WebMCP API instead of a separate chat or proxy. After authentication, the page registers tools on `document.modelContext`:

| Tool | Purpose |
| --- | --- |
| `metaedit_get_workspace` | Read the current version, collaborators, annotations, revisions, and approvals. |
| `metaedit_list_annotations` | List open, resolved, or all annotations with attribution and target snapshots. |
| `metaedit_inspect_annotation` | Read one annotation and its related revisions before changing anything. |
| `metaedit_create_annotation` | Save a comment against a stable page selector. |
| `metaedit_propose_revision` | Save a preview-only text, style, or visibility patch for an annotation. |
| `metaedit_review_revision` | Approve or reject a proposed revision. |
| `metaedit_publish_revision` | Open a GitHub pull request for an approved revision. Owner access and active approvals are required. |
| `metaedit_focus_target` | Scroll to and highlight the annotated element for the human collaborator. |

The tools call the same application API used by the UI. Every mutating request carries an idempotency key. The server validates selectors and limits edits to an allowlist of safe operations. Annotation and revision text is marked as untrusted content for agents.

Presence uses a Cloudflare Durable Object WebSocket room, with the authenticated HTTP heartbeat retained as a fallback. Cursor updates, collaborator joins, review events, and publish requests are reflected in the other collaborators' sessions.

## Run it locally

Requirements: Node.js 22.13 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dev script binds to `0.0.0.0`, so the server is reachable from the in-app browser and other devices on the local network.

To enter the editing workspace:

1. Click **Enter MetaEdit**.
2. Enter a display name.
3. Click **Use demo token**, or enter `WEBMCP`.
4. Click **Enter Workspace**.

The local demo uses a SQLite-compatible D1 binding supplied by the Cloudflare/Vinext dev runtime. The first API request creates the tables and the default `MetaEdit` workspace automatically. Local state is stored by the dev runtime and is not production data.

## Configuration

The demo workspace token is `WEBMCP` in both local development and the deployed Worker. The token is checked using its SHA-256 hash, so the plaintext token is never stored in the database or Worker configuration.

| Variable | Description |
| --- | --- |
| `METAEDIT_SESSION_TOKEN_HASH` | SHA-256 hex digest of the workspace token. The server compares it in constant time. |
| `METAEDIT_COOKIE_SECRET` | Secret used to sign the HTTP-only session cookie. |
| `GITHUB_TOKEN` | GitHub token with permission to create a branch, commit evidence, and open pull requests in the configured repository. Store it with `wrangler secret put`; never commit it. |
| `GITHUB_OWNER` | Optional repository owner; defaults to `sin4ch`. |
| `GITHUB_REPOSITORY` | Optional repository name; defaults to `MetaEdit`. |
| `GITHUB_BASE_BRANCH` | Optional pull-request base branch; defaults to `main`. |

Example hash generation:

```bash
printf 'WEBMCP' | sha256sum
```

The app reads the `DB` D1 binding from `cloudflare:workers`. `wrangler.jsonc` points the Worker at the production `metaedit-production` database; the first request bootstraps the tables and default `MetaEdit` workspace. `.openai/hosting.json` is retained for the local Sites sign-in shim. The session cookie is signed with `METAEDIT_COOKIE_SECRET`.

## Deploy to Cloudflare

The repository is configured for a Cloudflare Worker backed by D1:

```bash
npm install
npx wrangler secret put METAEDIT_SESSION_TOKEN_HASH
npx wrangler secret put METAEDIT_COOKIE_SECRET
npx wrangler secret put GITHUB_TOKEN
npx @vinext/cloudflare@1.0.0-beta.3 deploy
```

When prompted for `METAEDIT_SESSION_TOKEN_HASH`, enter the SHA-256 digest of `WEBMCP` (generate it with `printf 'WEBMCP' | sha256sum`). Use a long random value for `METAEDIT_COOKIE_SECRET`. `GITHUB_TOKEN` is used only server-side to create the review branch and pull request. The deployed Worker is served from its `*.workers.dev` URL unless a custom domain is configured in Cloudflare. This deployment serves the normal visitor page at `https://me.sin4.ch` and the authenticated editor at `https://metaedit.me.sin4.ch`.

## How the app is structured

- `src/app/page.tsx` contains the visitor page and the authenticated editing surface.
- `src/components/metaedit/GlobalInspector.tsx` collects stable selectors, text, and computed-style snapshots.
- `src/components/metaedit/WebMCPRegistry.tsx` registers the page tools and unregisters them by aborting the registration signal, which follows the WebMCP API.
- `src/app/api/metaedit/route.ts` authenticates collaborators and handles annotations, revisions, reviews, GitHub-backed publishing, heartbeats, and logout.
- `src/lib/server/github.ts` creates a review branch, applies an exact text replacement when the source snapshot is safely present, commits a revision manifest and cropped evidence, and opens the pull request.
- `src/lib/metaedit-contract.ts` validates target metadata and the safe patch contract.
- `src/lib/server/metaedit-db.ts` owns the D1 schema bootstrap and workspace reads.
- `src/components/metaedit/PatchRuntime.tsx` applies previews or published patches in the page without injecting HTML or scripts.

The public page requests only published revisions. The inspector, activity panel, presence overlay, and WebMCP tools activate after authentication. The URL changes the entry surface, but the token still grants the authority.

## Test the core flow

Run the static checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
npx vinext check
```

Manual browser check:

1. Load the local page as a visitor and confirm that editing controls are absent.
2. Enter the workspace with `WEBMCP`.
3. Click a visible element and save an annotation.
4. Open **Activity** and confirm the author, comment, target, and selector are shown.
5. In a WebMCP-capable browser agent, call `metaedit_list_annotations`, inspect the annotation, and propose a patch against its `selector` and `baseVersion`.
6. Toggle the before/after view, approve the revision, and choose **Publish** as the workspace owner.
7. Confirm the warning, wait for the pull-request spinner to finish, and open the GitHub link shown on the activity entry.
8. Leave the workspace and confirm the visitor page shows only the published preview.

## Challenge submission notes

The repository is the source of truth for the demo. The written story for the submission is:

> MetaEdit lets a human point at a live interface and leave an attributed request. A browser agent reads the page's WebMCP tools, inspects the annotation and current checkpoint, and proposes a constrained revision. The result remains a shared preview until collaborators approve it. The owner publishes from the same page, so the agent can help with implementation without taking the final decision away from the people reviewing the UI.

Suggested testing credentials for the submission form are the display name `Alex Rivera` and the demo token `WEBMCP`.

The remaining submission work is external to this repository: record a public video under three minutes with audio, complete the Devpost form, and verify the public repository from an incognito window. This repository includes the source, setup instructions, WebMCP tool list, pull-request workflow, and MIT license needed for that handoff. Use the checklist in [`SUBMISSION_CHECKLIST.md`](SUBMISSION_CHECKLIST.md).

The copy, testing notes, screenshot plan, and video outline are collected in [`devpost-submission.md`](devpost-submission.md). It is a local draft and does not submit anything to Devpost.

## References

- [WebMCP specification](https://webmachinelearning.github.io/webmcp/)
- [The WebMCP Challenge](https://webmcp.devpost.com/)
- [Cloudflare's Next.js/Vinext guidance](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)

## License

MIT. See [LICENSE](LICENSE).
