import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    protocol: "WebMCP",
    transport: "document.modelContext",
    authenticated: true,
    message: "MetaEdit registers its tools directly with a WebMCP-capable browser after workspace authentication. Durable data actions are served by /api/metaedit.",
    tools: [
      "metaedit_get_workspace",
      "metaedit_list_annotations",
      "metaedit_inspect_annotation",
      "metaedit_create_annotation",
      "metaedit_propose_revision",
      "metaedit_review_revision",
      "metaedit_publish_revision",
      "metaedit_focus_target",
    ],
  });
}

export async function POST() {
  return NextResponse.json({ error: "Use the browser's registered WebMCP tools. This endpoint is discovery-only." }, { status: 405, headers: { Allow: "GET" } });
}
