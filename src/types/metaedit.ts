export type UserRole = "visitor" | "reviewer" | "editor" | "owner";

export interface Collaborator {
  id: string;
  sessionId: string;
  displayName: string;
  role: UserRole;
  color: string;
  avatar?: string;
  lastSeenAt: string;
  cursor?: { x: number; y: number };
  activeTarget?: string;
}

export interface TargetMetadata {
  component: string;
  source: string;
  instanceId: string;
  description?: string;
  propsSummary?: Record<string, string | number | boolean>;
  boundingRect?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export type RequestStatus =
  | "draft"
  | "queued"
  | "inspecting_target"
  | "editing_source"
  | "running_checks"
  | "applied"
  | "failed"
  | "stale"
  | "conflict"
  | "reverted";

export interface ChangeRequest {
  id: string;
  sessionId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  baseVersion: number;
  target: TargetMetadata;
  instruction: string;
  queuePosition?: number;
  status: RequestStatus;
  error?: string;
  checkpointId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Checkpoint {
  id: string;
  sessionId: string;
  version: number;
  commit: string;
  parentCommit: string;
  requestId: string;
  authorId: string;
  authorName: string;
  instruction: string;
  targetComponent: string;
  filesChanged: number;
  diffSummary: string;
  diffCode?: {
    file: string;
    oldCode: string;
    newCode: string;
  }[];
  createdAt: string;
  isRevert?: boolean;
  revertedCheckpointId?: string;
}

export interface SessionState {
  id: string;
  name: string;
  repository: string;
  branch: string;
  headCommit: string;
  version: number;
  status: "active" | "locked" | "archived";
  collaborators: Collaborator[];
  requests: ChangeRequest[];
  checkpoints: Checkpoint[];
  createdAt: string;
}
