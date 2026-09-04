import app from "vinext/server/app-router-entry";
import { readSession } from "@/lib/server/metaedit-auth";
import { WORKSPACE_ID } from "@/lib/server/metaedit-db";
import { PresenceRoom } from "@/lib/server/presence-room";

export { PresenceRoom };

interface MetaEditEnv extends Cloudflare.Env {
  METAEDIT_PRESENCE: DurableObjectNamespace<PresenceRoom>;
}

const worker = {
  async fetch(request: Request, env: MetaEditEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/api/metaedit/presence") {
      if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("WebSocket upgrade required.", { status: 426 });
      }
      const collaborator = await readSession(request);
      if (!collaborator) return new Response("Authenticate with MetaEdit first.", { status: 401 });
      const room = env.METAEDIT_PRESENCE.getByName(WORKSPACE_ID);
      const roomUrl = new URL(request.url);
      roomUrl.search = new URLSearchParams({
        collaboratorId: collaborator.id,
        displayName: collaborator.displayName,
        color: collaborator.color,
      }).toString();
      return room.fetch(new Request(roomUrl, request));
    }
    return app.fetch(request, env as { ASSETS?: { fetch(request: Request): Promise<Response> | Response } }, ctx);
  },
};

export default worker;
