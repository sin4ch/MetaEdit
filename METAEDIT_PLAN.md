# MetaEdit build plan

## Product statement

MetaEdit turns a live website into a collaborative development workspace.

Regular visitors use the normal site without seeing editing controls. Authorized collaborators open the same site through a `metaedit` subdomain, enter an access token, then annotate the interface and request source changes without leaving the page.

The concise pitch is:

> Edit software from inside the software.

## Hackathon story

The demo must prove that WebMCP is part of the product, not a label added to a browser annotation tool.

MetaEdit lets the page expose structured context about itself. A collaborator selects a visible target, writes an instruction, and sends the target, component context, current checkpoint, and author identity to an agent. Codex edits the shared project. The updated preview appears for everyone in the session.

The primary demo sequence is:

1. Open `example.com` and show an ordinary landing page.
2. Open `metaedit.example.com` and show the same page behind an access modal.
3. Enter a valid session token.
4. Show the floating editor controls and live collaborator cursors.
5. Select a pricing card and request a visual change.
6. Show the request, author, target, and queue state in the activity panel.
7. Apply the change and update both collaborators' browsers.
8. Open the resulting checkpoint and inspect its prompt and source diff.
9. Revert the checkpoint and show both browsers return to the new shared state.

## Scope

### Landing page

The first deliverable is a polished MetaEdit marketing page with an interactive product demonstration. It will be built as a ChatGPT Sites project.

The landing page will use only the `oa-design` skill for visual and interaction design. Its defining traits are:

- Inter Tight with a maximum weight of 500
- Ink-derived neutral colors
- One blue interface accent
- White plates on a quiet grey stage
- Squircle surfaces and pill-shaped actions
- Restrained scroll reveals and spring motion
- Plain, specific interface copy

### Product prototype

The hackathon prototype will support one demonstration site and one shared editing session. It does not need to edit arbitrary third-party websites.

### Non-goals

- A general-purpose website proxy
- Arbitrary DOM rewriting
- Concurrent source mutations
- Parallel Git branches and automatic merging
- Production-grade organization management
- A full visual page builder
- Real-time source-code editing between humans
- Support for every frontend framework

## User modes

### Visitor

- Opens the normal domain
- Sees no MetaEdit controls
- Uses the site normally
- Cannot discover privileged WebMCP tools through the client

### Reviewer

- Enters an authorized session
- Sees collaborator presence and activity
- Selects interface targets
- Creates annotations and comments
- Cannot request source changes

### Editor

- Has reviewer abilities
- Requests changes from Codex
- Inspects previews and diffs
- Reverts checkpoints

### Owner

- Has editor abilities
- Manages session access
- Stops the session
- Accepts the final state

The hackathon build may implement only editor and owner behavior while keeping the role model in the data structures.

## Entry and authentication

The same application responds differently based on the host:

```text
example.com
  -> visitor mode

metaedit.example.com
  -> access modal
  -> server verifies token
  -> short-lived session cookie
  -> MetaEdit interface
```

The URL identifies the editing surface but does not grant authority. A shared token grants access to a specific session.

Token requirements:

- Store only a server-side hash
- Use a constant-time comparison
- Return one generic error for invalid or expired access
- Rate-limit failed attempts
- Exchange a valid token for a short-lived, secure, HTTP-only cookie
- Authorize every privileged WebMCP operation on the server

The access modal asks for a display name and token. The display name supplies attribution for the hackathon demo.

## Landing-page information architecture

### Header

- MetaEdit wordmark
- Links to Product, Workflow, and WebMCP sections
- `Open the demo` primary action
- Transparent bar that morphs into the OA glass pill on scroll

### Hero

- Outcome-led headline
- One short explanation
- Primary action to enter the interactive demo
- Secondary link to the workflow section
- Large product view showing a selected component, two collaborators, the editor pill, and activity history

### Domain switch

Show the central product idea as two adjacent browser states:

```text
example.com
The site people use

metaedit.example.com
The same site, ready to change
```

### Workflow

Three concrete steps:

1. Point at the interface
2. Describe the change
3. Review the shared result

### Collaboration

Show live cursors, soft component locks, an ordered request queue, author attribution, and append-only history.

### WebMCP proof

Explain that the page provides structured component and application context. Include one concise sample payload instead of a broad tool catalogue.

### Closing action

Return to the primary action with a short line about opening an editing session.

## MetaEdit interface

### Access modal

Fields:

- Display name
- Access token

Actions:

- `Enter MetaEdit`
- `Return to the site`

The modal appears over the unchanged site so the relationship between visitor mode and editor mode is obvious.

### Floating editor pill

The default control sits at the bottom center and stays compact:

```text
[ Select ] [ Annotate ] [ Activity ]   3 online
```

After selection it expands to show the target and prompt field:

```text
PricingCard
[ Describe a change                         ] [ Request change ]
```

The interface is target-first. It should not resemble a permanent chatbot.

### Target selection

- Hover outlines eligible targets
- Click fixes the current selection
- Escape clears the selection
- The selected target receives a solid outline and small label
- Remote collaborator selections use their assigned identity color
- Element metadata remains secondary and appears only when requested

### Activity panel

The right-side panel combines prompts and checkpoints in one chronological feed.

Each item contains:

- Author
- Prompt
- Selected target
- Time
- Queue or execution status
- Resulting checkpoint
- File count when available
- `View change` and `Revert` actions

Filters:

- All
- Active
- Applied

### Presence

Each collaborator receives one stable color for their cursor, name label, selected-element outline, and avatar ring. These colors identify people only. All ordinary interface actions retain OA's single blue accent.

### Soft locks

If another collaborator has an active request for the selected component, MetaEdit warns the user but still allows submission:

> Maya is editing this component. Your request will run after hers.

## Request states

The interface must make every asynchronous state legible:

- Draft
- Queued
- Inspecting target
- Editing source
- Running checks
- Applied
- Failed
- Stale and regenerating
- Conflict needs review
- Reverted

Waiting states name the current work. Error states name the cause and the next available action.

## WebMCP contract

The initial tools are:

```text
inspect_target
create_annotation
list_annotations
request_change
get_change_status
list_change_history
preview_checkpoint
revert_checkpoint
get_session_state
```

`request_change` accepts:

```json
{
  "requestId": "req_123",
  "sessionId": "session_82k",
  "baseVersion": 17,
  "target": {
    "component": "PricingCard",
    "source": "src/components/PricingCard.tsx",
    "instanceId": "pricing-card-pro"
  },
  "instruction": "Make this card denser and reduce its height.",
  "author": {
    "id": "user_maya",
    "name": "Maya"
  }
}
```

Every mutating call requires an idempotency ID. Repeating an existing ID returns the existing job instead of starting another edit.

## Collaboration and concurrency

One shared session has one authoritative version.

```text
Concurrent:
  presence
  cursors
  selections
  annotations
  comments

Serialized:
  Codex source mutations
```

Rules:

1. The coordinator reserves request order when requests arrive.
2. Only one source mutation runs per session.
3. Each request records its base version.
4. A stale instruction is regenerated against the latest version.
5. A generated patch is never silently rebased.
6. Every applied change creates a new checkpoint.
7. Reverting creates another checkpoint and does not move shared history backward.
8. Clients ignore events older than the newest version they have applied.

## Data model

### Session

```text
id
name
repository
branch
headCommit
version
status
createdAt
expiresAt
```

### Collaborator

```text
id
sessionId
displayName
role
color
lastSeenAt
```

### Annotation

```text
id
sessionId
authorId
baseVersion
target
instruction
boundingBox
status
createdAt
```

### Change request

```text
id
sessionId
annotationId
authorId
baseVersion
queuePosition
status
error
createdAt
startedAt
completedAt
```

### Checkpoint

```text
id
sessionId
version
commit
parentCommit
requestId
authorId
instruction
filesChanged
createdAt
```

## Sites-first architecture

The first implementation target is ChatGPT Sites.

```text
ChatGPT Site
├── landing page and MetaEdit overlay
├── WebMCP tool registration
├── token and session endpoints
├── D1
│   ├── sessions
│   ├── collaborators
│   ├── annotations
│   ├── requests
│   └── checkpoints
└── WebSocket collaboration channel
```

Cloudflare is the fallback for coordination or agent execution if the supported Sites runtime cannot provide enough control. A Cloudflare Durable Object would map cleanly to one collaborative session, but it should not be added until a compatibility spike proves it necessary.

The coding-agent bridge remains a separate boundary:

```text
Site
  -> authorized change request
  -> session coordinator
  -> Codex workspace
  -> checks and commit
  -> checkpoint event
  -> shared preview refresh
```

## Delivery phases

### Phase 1: landing page

- Create the OA visual foundation
- Build the header, hero, product view, workflow, collaboration, WebMCP, and closing sections
- Add the interactive access modal and simulated MetaEdit mode
- Add responsive and reduced-motion behavior
- Validate the Sites production build

### Phase 2: session prototype

- Add token verification
- Add session cookies
- Add the shared session data model
- Add WebSocket presence and cursors
- Persist annotations and activity

### Phase 3: WebMCP and Codex loop

- Register the initial WebMCP tools
- Resolve selected targets to component context
- Queue source-change requests
- Run one Codex mutation at a time
- Create attributed checkpoints
- Stream status updates to collaborators

### Phase 4: review and revert

- Show checkpoint details and diffs
- Preview earlier checkpoints
- Revert a selected checkpoint by creating a new one
- Handle stale requests and visible conflicts

### Phase 5: demo hardening

- Prepare a deterministic backup edit
- Add graceful timeouts and retry states
- Test two devices in the same session
- Confirm keyboard, touch, and reduced-motion behavior
- Record the final demo video

## Landing-page acceptance criteria

- The page explains MetaEdit in the first viewport
- The normal site and `metaedit` subdomain relationship is immediately clear
- The product view shows annotation, presence, prompting, and history without narration
- The access modal can be opened and completed as a local demonstration
- Entering demo mode adds editor chrome without replacing the site
- All controls are keyboard accessible
- The page works at 390px and 1280px widths
- The page has no horizontal document scroll
- Reduced-motion users receive the same information without animation
- Copy uses sentence case and names concrete actions
- The production build passes

## Known risks

### The landing page could oversell the prototype

Mark simulated activity clearly where it is not backed by the session coordinator yet.

### WebMCP could look incidental

The demo must show structured target inspection and tool calls, not only a prompt sent over a normal HTTP endpoint.

### The collaboration layer could consume the schedule

Keep source mutations serialized and limit the first demo to one shared session.

### The subdomain behavior may differ in local development

Support a query-string demo mode locally while preserving host-based behavior for deployment.

### Agent latency could weaken the live demo

Show clear execution states and keep one deterministic prepared request as a fallback.

## Decisions recorded

- Product name: MetaEdit
- Hosting preference: ChatGPT Sites
- Infrastructure fallback: Cloudflare
- Design source: `oa-design` only
- Demo surface: one MetaEdit landing page
- Entry mechanism: `metaedit` subdomain plus token gate
- Collaboration model: concurrent presence and annotations, serialized source changes
- History model: attributed, append-only checkpoints
- Revert model: create a new checkpoint
