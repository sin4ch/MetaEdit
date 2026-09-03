import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  publishedVersion: integer("published_version").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const collaborators = sqliteTable(
  "collaborators",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    platformUserId: text("platform_user_id"),
    displayName: text("display_name").notNull(),
    email: text("email"),
    role: text("role").notNull(),
    color: text("color").notNull(),
    sessionExpiresAt: integer("session_expires_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    cursorX: real("cursor_x"),
    cursorY: real("cursor_y"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_collaborators_workspace_seen").on(table.workspaceId, table.lastSeenAt),
    index("idx_collaborators_platform_user").on(table.platformUserId),
  ],
);

export const annotations = sqliteTable(
  "annotations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    authorId: text("author_id").notNull(),
    authorName: text("author_name").notNull(),
    targetId: text("target_id").notNull(),
    selector: text("selector").notNull(),
    component: text("component").notNull(),
    source: text("source").notNull(),
    textSnapshot: text("text_snapshot").notNull(),
    styleSnapshot: text("style_snapshot").notNull(),
    comment: text("comment").notNull(),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("idx_annotations_workspace_created").on(table.workspaceId, table.createdAt),
    index("idx_annotations_target").on(table.workspaceId, table.targetId),
  ],
);

export const revisions = sqliteTable(
  "revisions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    annotationId: text("annotation_id"),
    authorId: text("author_id").notNull(),
    authorName: text("author_name").notNull(),
    instruction: text("instruction").notNull(),
    baseVersion: integer("base_version").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    patchJson: text("patch_json").notNull(),
    beforeJson: text("before_json").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    publishedAt: integer("published_at"),
  },
  (table) => [
    uniqueIndex("idx_revisions_workspace_version").on(table.workspaceId, table.version),
    index("idx_revisions_workspace_created").on(table.workspaceId, table.createdAt),
    index("idx_revisions_annotation").on(table.annotationId),
  ],
);

export const approvals = sqliteTable(
  "approvals",
  {
    id: text("id").primaryKey(),
    revisionId: text("revision_id").notNull(),
    collaboratorId: text("collaborator_id").notNull(),
    collaboratorName: text("collaborator_name").notNull(),
    decision: text("decision").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_approvals_revision_collaborator").on(table.revisionId, table.collaboratorId),
  ],
);

export const activityEvents = sqliteTable(
  "activity_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    kind: text("kind").notNull(),
    actorId: text("actor_id").notNull(),
    actorName: text("actor_name").notNull(),
    entityId: text("entity_id").notNull(),
    message: text("message").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("idx_activity_workspace_created").on(table.workspaceId, table.createdAt)],
);

export const idempotencyRecords = sqliteTable("idempotency_records", {
  key: text("key").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  responseJson: text("response_json").notNull(),
  createdAt: integer("created_at").notNull(),
});
