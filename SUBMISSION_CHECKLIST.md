# WebMCP Challenge submission checklist

## Already in the repository

- [x] Public source repository: <https://github.com/sin4ch/MetaEdit>
- [x] MIT license and a complete README with the problem, solution, architecture, setup, tool catalog, and test flow.
- [x] Visitor mode hides editing controls.
- [x] `metaedit.` entry point plus the `WEBMCP` demo token.
- [x] WebMCP tools for reading annotations, inspecting targets, proposing safe patches, reviewing, publishing, and focusing the page.
- [x] Attribution, timestamps, selector/style snapshots, freeform region metadata, versioned previews, approvals, and before/after comparison.
- [x] Live collaborator cursors over a Cloudflare Durable Object WebSocket, with an HTTP heartbeat fallback.
- [x] Confirmation after approval, publish activity notification, spinner/completion state, and a pull-request link.
- [x] GitHub branch/commit/PR integration with a revision manifest and cropped before/after evidence when available.
- [x] Cloudflare Worker + D1 deployment and custom hostnames: visitor page at <https://me.sin4.ch> and editor at <https://metaedit.me.sin4.ch>.

## Verify immediately before submitting

- [ ] Open the custom URL in an incognito window and confirm the visitor page has no MetaEdit controls.
- [ ] Open <https://me.sin4.ch> to verify visitor mode, then open <https://metaedit.me.sin4.ch>, enter any display name, choose **Use demo token**, and use `WEBMCP` if needed.
- [ ] In a WebMCP-enabled Chrome/Codex browser, call `metaedit_list_annotations`, inspect one annotation, and propose a text/style patch.
- [ ] Open a second browser session and confirm both sessions see collaborator names and live cursor movement.
- [ ] Approve the revision once; confirm Publish appears after the first approval.
- [ ] Confirm the publish warning, spinner, completion tick, PR link, manifest, and before/after screenshot files in GitHub.
- [ ] Confirm leaving MetaEdit returns to visitor mode while the published preview remains visible.
- [ ] Run `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npx vinext check`.

## Devpost form and media

- [ ] Record a public demo video under three minutes with audio. Show visitor mode, token entry, annotation, the WebMCP agent call, preview, collaborators/cursors, before/after, approvals, publish warning, and the resulting PR.
- [ ] Upload the video and paste its public URL into Devpost.
- [ ] Paste the live URL and public repository URL into Devpost.
- [ ] Complete account-specific fields: submitter type, country, app status, learning level, and existing-app explanation if requested.
- [ ] State the test credential securely: any display name plus the demo token `WEBMCP`.
- [ ] Name the WebMCP-enabled browser/agent used for the demo and explain that the page registers tools on `document.modelContext`.
- [ ] Add final screenshots or the video link as required by the challenge form, then submit.

## Honest scope notes

- The demo uses one shared workspace and a deliberately simple token for the hackathon.
- Safe patches are text replacement, selected CSS properties, and visibility; they are not arbitrary code execution.
- GitHub source edits are conservative exact text replacements. Every other proposed operation remains available in the committed revision manifest for normal developer review.
