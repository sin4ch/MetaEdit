# Title

MetaEdit

## One-line Summary

Edit software from inside the software with an attributed WebMCP workflow for human review.

## Problem

People usually leave the page they are reviewing, describe a change in chat, and lose the exact UI context that motivated it. The developer then has to find the element, interpret the request, and show the result somewhere else. That loop is slow and attribution gets blurry when several people are involved.

## Solution

MetaEdit adds an editing surface to the same website through the `metaedit.` subdomain. An authenticated collaborator clicks an element, sees its stable selector and style snapshot, and leaves a comment. A WebMCP-capable browser agent can read the annotation, inspect the current workspace version, and propose a constrained text, style, or visibility patch. The patch stays in preview until collaborators approve it. The workspace owner publishes the approved revision from the page.

## Why This Matters

The browser agent receives the page context at the point where the human is looking at it. The human keeps the final decision. The shared activity feed records who annotated which target, which revision was proposed, who approved it, and what version was published.

## How We Used AI

MetaEdit exposes eight WebMCP tools through `document.modelContext`. The browser agent uses `metaedit_list_annotations` and `metaedit_inspect_annotation` to gather context, then calls `metaedit_propose_revision` with a validated patch. Review and publishing remain explicit tools with server-side authorization. The application itself does not call a hosted model. It gives an external browser agent structured, safe actions to use.

## How We Used Codex

Codex helped shape the WebMCP contract, implement the D1-backed workspace API, build the inspector and activity UI, review the patch safety rules, run lint/type/build checks, and debug the local sign-in crash. The crash came from calling a non-existent `unregisterTool` method during React cleanup. The fix uses the WebMCP registration `AbortSignal`, which is the API's cleanup mechanism.

## Key Features

- Visitor mode with no editing controls.
- Token-gated MetaEdit mode with collaborator attribution.
- Stable selector, text, and computed-style snapshots for every annotation.
- WebMCP tools for reading context, creating annotations, proposing patches, reviewing, publishing, and focusing targets.
- Safe patch allowlist for text, selected CSS properties, and visibility. No HTML, scripts, or arbitrary selectors.
- Preview and published states with before/after inspection.
- Owner-only publishing after active collaborators approve.
- D1-compatible durable workspace state with idempotent mutations.
- Untrusted-content hints on tool responses that contain user-authored text.

## Architecture

The React page renders both visitor and authenticated editor modes. `GlobalInspector` collects target metadata. `WebMCPRegistry` registers the browser tools after authentication and keeps current state in refs so tool calls do not require re-registration. `/api/metaedit` validates every mutation, writes to D1, records activity, and returns the new workspace state. `PatchRuntime` applies preview or published operations in the DOM.

## Testing Instructions

```bash
npm install
npm run dev
```

Open the deployed Worker URL, click **Enter MetaEdit**, enter any display name, click **Use demo token**, and enter the workspace. The demo token is `WEBMCP`.

For a WebMCP-capable browser agent:

1. Create an annotation from the inspector.
2. Call `metaedit_list_annotations`.
3. Call `metaedit_inspect_annotation` for the selected annotation.
4. Propose a patch using the annotation selector and current workspace version.
5. Review the revision, inspect before/after, and publish it as the owner.

Automated checks used for this draft:

```bash
npm run lint
npx tsc --noEmit
npm run build
npx vinext check
```

## Public Demo Link

TODO: add the live URL. This field is intentionally blank for the current handoff.

## Public Repository Link

https://github.com/sin4ch/MetaEdit

## Demo Video

TODO: upload a public video under three minutes with audio.

Suggested sequence:

1. Show the ordinary visitor page and explain that the editor is hidden.
2. Enter MetaEdit with `WEBMCP`.
3. Click a card and save an attributed annotation.
4. Ask a WebMCP-capable browser agent to inspect it and propose a text or style patch.
5. Show the activity entry, before/after view, approval, and owner-only publish step.
6. Leave MetaEdit and show the published result in visitor mode.

## Screenshot Shot List

- Visitor mode with no editor controls.
- Authenticated MetaEdit mode with inspector, collaborator presence, and activity count.
- An annotation card showing author, comment, component, and target ID.
- Before/after revision view with approval state.
- Published revision visible after leaving MetaEdit.

## Submission Readiness Notes

- [x] README replaced with project purpose, setup, architecture, WebMCP tools, and testing instructions.
- [x] MIT license added and detected by GitHub.
- [x] Source pushed to the public `sin4ch/MetaEdit` repository.
- [x] Local sign-in tested after restarting Vinext with a reachable hostname.
- [x] WebMCP cleanup crash fixed and authenticated page re-tested with no browser errors.
- [ ] Add the live URL.
- [ ] Record and publish the demo video.
- [ ] Complete account-specific Devpost fields and submit the form.
- [ ] Verify the final public demo and repository from an incognito browser.

## Known Limitations

- The demo uses one default workspace rather than organization-level workspaces.
- The demo token is deliberately simple for hackathon testing; production installations should use a workspace-specific token.
- Patches are intentionally limited to text, an allowlisted CSS property, or visibility. The prototype does not edit arbitrary source files.
- WebMCP tool invocation must be verified in a browser build that exposes the WebMCP API to the agent.
- The Cloudflare deployment uses the provisioned `metaedit-production` D1 database and hosted session-token and cookie secrets.

## TODO Official Form Fields

Fill these in on Devpost after choosing the final live URL and testing client:

- Submitter type: TODO
- Country of residence: TODO
- App status: TODO
- Existing-app update explanation, if applicable: TODO
- Live URL: TODO
- Testing instructions and credentials: any display name / `WEBMCP` for the deployed demo
- Public code repository: https://github.com/sin4ch/MetaEdit
- Agents or clients tested with WebMCP tools: TODO, verify in WebMCP-enabled Chrome
- AI tools leveraged: Codex and the browser agent used for the WebMCP demo
- Learning level: TODO
- AI value useful in career: TODO
- Public YouTube video URL: TODO
