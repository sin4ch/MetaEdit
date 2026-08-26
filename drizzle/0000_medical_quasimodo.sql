CREATE TABLE `activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`entity_id` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activity_workspace_created` ON `activity_events` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`target_id` text NOT NULL,
	`selector` text NOT NULL,
	`component` text NOT NULL,
	`source` text NOT NULL,
	`text_snapshot` text NOT NULL,
	`style_snapshot` text NOT NULL,
	`comment` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_annotations_workspace_created` ON `annotations` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_annotations_target` ON `annotations` (`workspace_id`,`target_id`);--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`collaborator_id` text NOT NULL,
	`collaborator_name` text NOT NULL,
	`decision` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_approvals_revision_collaborator` ON `approvals` (`revision_id`,`collaborator_id`);--> statement-breakpoint
CREATE TABLE `collaborators` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`platform_user_id` text,
	`display_name` text NOT NULL,
	`email` text,
	`role` text NOT NULL,
	`color` text NOT NULL,
	`session_expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_collaborators_workspace_seen` ON `collaborators` (`workspace_id`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `idx_collaborators_platform_user` ON `collaborators` (`platform_user_id`);--> statement-breakpoint
CREATE TABLE `idempotency_records` (
	`key` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`annotation_id` text,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`instruction` text NOT NULL,
	`base_version` integer NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`patch_json` text NOT NULL,
	`before_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`published_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_revisions_workspace_version` ON `revisions` (`workspace_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_revisions_workspace_created` ON `revisions` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_revisions_annotation` ON `revisions` (`annotation_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`published_version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
