export type UserRole = "visitor" | "editor" | "owner";
export type AnnotationStatus = "open" | "resolved";
export type AnnotationAgentState = "unseen" | "seen" | "in_progress" | "done";
export type RevisionStatus = "proposed" | "approved" | "published" | "rejected";
export type ApprovalDecision = "approved" | "rejected";
export type TargetSelectionType = "element" | "region";

export interface MetaEditRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface HighlightedElement {
  selector: string;
  component: string;
  instanceId: string;
  tagName: string;
  textSnapshot: string;
  styleSnapshot: Record<string, string>;
  boundingRect: MetaEditRect;
  intersectionRatio: number;
}

export interface Collaborator {
  id: string;
  displayName: string;
  role: UserRole;
  color: string;
  email?: string | null;
  lastSeenAt: string;
  cursor?: { x: number; y: number };
  activeTarget?: string;
}

export interface TargetMetadata {
  component: string;
  source: string;
  instanceId: string;
  selector: string;
  textSnapshot: string;
  styleSnapshot: Record<string, string>;
  selectionType?: TargetSelectionType;
  region?: MetaEditRect;
  highlightedElements?: HighlightedElement[];
  description?: string;
  propsSummary?: Record<string, string | number | boolean>;
  boundingRect?: MetaEditRect;
}

export interface Annotation {
  id: string;
  authorId: string;
  authorName: string;
  authorColor?: string;
  targetId: string;
  selector: string;
  component: string;
  source: string;
  textSnapshot: string;
  styleSnapshot: Record<string, string>;
  selectionType?: TargetSelectionType;
  region?: MetaEditRect | null;
  highlightedElements?: HighlightedElement[];
  agentState?: AnnotationAgentState;
  comment: string;
  status: AnnotationStatus;
  createdAt: string;
  updatedAt: string;
}

export type EditableStyleProperty = "color" | "backgroundColor" | "borderColor" | "borderRadius" | "fontSize" | "fontWeight" | "letterSpacing" | "lineHeight" | "textAlign" | "padding" | "margin" | "gap" | "width" | "maxWidth" | "minHeight" | "opacity";

export type PatchOperation =
  | { op: "replace_text"; selector: string; value: string }
  | { op: "set_style"; selector: string; property: EditableStyleProperty; value: string }
  | { op: "set_visibility"; selector: string; visible: boolean };

export interface Approval {
  id: string;
  revisionId: string;
  collaboratorId: string;
  collaboratorName: string;
  decision: ApprovalDecision;
  createdAt: string;
}

export interface Revision {
  id: string;
  annotationId?: string | null;
  authorId: string;
  authorName: string;
  authorColor?: string;
  instruction: string;
  baseVersion: number;
  version: number;
  status: RevisionStatus;
  patch: PatchOperation[];
  before: PatchOperation[];
  approvals: Approval[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface ActivityEvent {
  id: string;
  kind: string;
  actorId: string;
  actorName: string;
  entityId: string;
  message: string;
  createdAt: string;
}

export interface MetaEditSession {
  collaborator: Collaborator;
  workspaceId: string;
  workspaceName: string;
  expiresAt: string;
}

export interface WorkspaceState {
  workspace: { id: string; name: string; publishedVersion: number; latestVersion: number };
  currentCollaborator: Collaborator | null;
  collaborators: Collaborator[];
  annotations: Annotation[];
  revisions: Revision[];
  activity: ActivityEvent[];
}
