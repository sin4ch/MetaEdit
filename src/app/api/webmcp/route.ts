import { NextResponse } from "next/server";

// Sample in-memory state for WebMCP protocol demonstration
const sessionState = {
  id: "session_hackathon_82k",
  name: "MetaEdit Hackathon Session",
  repository: "OpenLabs-so/metaedit-demo",
  branch: "main",
  headCommit: "9f4a12b",
  version: 18,
  status: "active",
  collaborators: [
    {
      id: "user_maya",
      sessionId: "session_hackathon_82k",
      displayName: "Maya Chen",
      role: "editor",
      color: "#8b5cf6",
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: "user_alex",
      sessionId: "session_hackathon_82k",
      displayName: "Alex Rivera",
      role: "owner",
      color: "#305dde",
      lastSeenAt: new Date().toISOString(),
    }
  ],
  annotations: [],
  requests: [],
  checkpoints: [
    {
      id: "cp_init_17",
      sessionId: "session_hackathon_82k",
      version: 17,
      commit: "8b23ce1",
      parentCommit: "7a19ff0",
      requestId: "req_init",
      authorId: "user_maya",
      authorName: "Maya Chen",
      instruction: "Add squircle surface container and Inter Tight font tokens",
      targetComponent: "PricingCard",
      filesChanged: 2,
      diffSummary: "Updated PricingCard.tsx with OA squircle styling",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    }
  ]
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "get_session_state";

  switch (action) {
    case "get_session_state":
      return NextResponse.json({
        tools: [
          "inspect_target",
          "create_annotation",
          "list_annotations",
          "request_change",
          "get_change_status",
          "list_change_history",
          "preview_checkpoint",
          "revert_checkpoint",
          "get_session_state"
        ],
        session: sessionState,
      });

    case "list_change_history":
      return NextResponse.json({
        checkpoints: sessionState.checkpoints,
      });

    case "inspect_target": {
      const targetId = searchParams.get("targetId") || "pricing-card-pro";
      return NextResponse.json({
        targetId,
        component: "PricingCard",
        source: "src/components/PricingCard.tsx",
        instanceId: targetId,
        propsSummary: {
          tier: "Pro",
          price: "$29",
          highlighted: true,
        },
        boundingBox: { top: 120, left: 450, width: 340, height: 420 },
      });
    }

    default:
      return NextResponse.json({ status: "ok", action });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action = "request_change", payload } = body;

    if (action === "request_change") {
      const { requestId, baseVersion, target, instruction, author } = payload || {};
      const newVersion = sessionState.version + 1;
      sessionState.version = newVersion;

      const newCheckpoint = {
        id: `cp_${Date.now()}`,
        sessionId: sessionState.id,
        version: newVersion,
        commit: Math.random().toString(16).substring(2, 9),
        parentCommit: sessionState.headCommit,
        requestId: requestId || `req_${Date.now()}`,
        authorId: author?.id || "user_editor",
        authorName: author?.name || "Collaborator",
        instruction: instruction || "Update target layout",
        targetComponent: target?.component || "Component",
        filesChanged: 1,
        diffSummary: `Modified ${target?.source || "component file"}`,
        createdAt: new Date().toISOString(),
      };

      sessionState.headCommit = newCheckpoint.commit;
      sessionState.checkpoints.unshift(newCheckpoint);

      return NextResponse.json({
        status: "success",
        requestId: newCheckpoint.requestId,
        version: newVersion,
        checkpoint: newCheckpoint,
      });
    }

    if (action === "revert_checkpoint") {
      const { checkpointId } = payload || {};
      const newVersion = sessionState.version + 1;
      sessionState.version = newVersion;

      const revertCheckpoint = {
        id: `cp_rev_${Date.now()}`,
        sessionId: sessionState.id,
        version: newVersion,
        commit: Math.random().toString(16).substring(2, 9),
        parentCommit: sessionState.headCommit,
        requestId: `req_rev_${Date.now()}`,
        authorId: "user_alex",
        authorName: "Alex Rivera",
        instruction: `Reverted checkpoint ${checkpointId}`,
        targetComponent: "Session",
        filesChanged: 1,
        diffSummary: `Reverted changes from ${checkpointId}`,
        createdAt: new Date().toISOString(),
        isRevert: true,
      };

      sessionState.headCommit = revertCheckpoint.commit;
      sessionState.checkpoints.unshift(revertCheckpoint);

      return NextResponse.json({
        status: "success",
        checkpoint: revertCheckpoint,
        version: newVersion,
      });
    }

    return NextResponse.json({ error: "Unknown WebMCP action" }, { status: 400 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
