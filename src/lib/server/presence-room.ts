import { DurableObject } from "cloudflare:workers";

interface PresenceAttachment {
  collaboratorId: string;
  displayName: string;
  color: string;
  cursor: { x: number; y: number } | null;
}

interface PresenceMessage {
  type: "presence.snapshot" | "presence.joined" | "presence.left" | "cursor";
  collaborators?: PresenceAttachment[];
  collaborator?: PresenceAttachment;
  collaboratorId?: string;
}

const MAX_COORDINATE = 100000;

/**
 * One hibernatable WebSocket room for the MetaEdit workspace.
 *
 * D1 remains the durable source of truth for sessions and activity. This room
 * only carries the high-frequency cursor/presence stream so a collaborator's
 * pointer can move without waiting for the 750ms HTTP heartbeat.
 */
export class PresenceRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required.", { status: 426 });
    }

    const url = new URL(request.url);
    const collaboratorId = cleanId(url.searchParams.get("collaboratorId"));
    const displayName = cleanName(url.searchParams.get("displayName"));
    const color = cleanColor(url.searchParams.get("color"));
    if (!collaboratorId || !displayName) return new Response("Authenticated collaborator required.", { status: 401 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const attachment: PresenceAttachment = { collaboratorId, displayName, color, cursor: null };
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);

    const existing = this.getAttachments().filter((item) => item.collaboratorId !== collaboratorId);
    server.send(JSON.stringify({ type: "presence.snapshot", collaborators: existing } satisfies PresenceMessage));
    this.broadcast({ type: "presence.joined", collaborator: attachment }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;
    let payload: unknown;
    try { payload = JSON.parse(message); } catch { return; }
    if (!payload || typeof payload !== "object") return;
    const type = (payload as { type?: unknown }).type;
    if (type !== "cursor") return;

    const x = (payload as { x?: unknown }).x;
    const y = (payload as { y?: unknown }).y;
    const cursor = x === null || y === null ? null : validCursor(x, y);
    if (cursor === undefined) return;
    const attachment = this.attachmentFor(ws);
    if (!attachment) return;
    attachment.cursor = cursor;
    ws.serializeAttachment(attachment);
    this.broadcast({ type: "cursor", collaborator: attachment }, ws);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    const attachment = this.attachmentFor(ws);
    if (attachment) this.broadcast({ type: "presence.left", collaboratorId: attachment.collaboratorId }, ws);
    try { ws.close(code, reason); } catch { /* already closed */ }
  }

  async webSocketError(ws: WebSocket) {
    const attachment = this.attachmentFor(ws);
    if (attachment) this.broadcast({ type: "presence.left", collaboratorId: attachment.collaboratorId }, ws);
    try { ws.close(1011, "Presence connection failed."); } catch { /* already closed */ }
  }

  private attachmentFor(ws: WebSocket): PresenceAttachment | null {
    const value = ws.deserializeAttachment();
    if (!value || typeof value !== "object") return null;
    const item = value as Partial<PresenceAttachment>;
    if (typeof item.collaboratorId !== "string" || typeof item.displayName !== "string") return null;
    return {
      collaboratorId: item.collaboratorId,
      displayName: item.displayName,
      color: cleanColor(item.color),
      cursor: item.cursor && typeof item.cursor.x === "number" && typeof item.cursor.y === "number" ? item.cursor : null,
    };
  }

  private getAttachments(): PresenceAttachment[] {
    return this.ctx.getWebSockets().flatMap((socket) => {
      const attachment = this.attachmentFor(socket);
      return attachment ? [attachment] : [];
    });
  }

  private broadcast(message: PresenceMessage, except?: WebSocket) {
    const serialized = JSON.stringify(message);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except) continue;
      try { socket.send(serialized); } catch { /* a closing peer is harmless */ }
    }
  }
}

function cleanId(value: string | null) {
  return value && /^[a-zA-Z0-9_-]{8,160}$/.test(value) ? value : null;
}

function cleanName(value: string | null) {
  const name = value?.trim() ?? "";
  return name.length >= 2 && name.length <= 80 ? name : null;
}

function cleanColor(value: string | null | undefined) {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : "#305dde";
}

function validCursor(x: unknown, y: unknown): { x: number; y: number } | undefined {
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  if (x < -MAX_COORDINATE || x > MAX_COORDINATE || y < -MAX_COORDINATE || y > MAX_COORDINATE) return undefined;
  return { x, y };
}
