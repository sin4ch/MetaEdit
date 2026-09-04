import { getRuntimeSecret } from "../../../db";
import type { Annotation, PatchOperation, Revision } from "@/types/metaedit";

const GITHUB_API = "https://api.github.com";
const DEFAULT_OWNER = "sin4ch";
const DEFAULT_REPOSITORY = "MetaEdit";
const DEFAULT_BASE_BRANCH = "main";

type GitHubFile = { content?: string; encoding?: string; sha?: string };
type GitHubRef = { object?: { sha?: string } };
type GitHubPullRequest = { html_url?: string; number?: number; head?: { sha?: string } };

export interface PublishedPullRequest {
  url: string;
  number: number;
  commitSha: string | null;
  branch: string;
}

class GitHubRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Create the source checkpoint and review evidence for an approved revision.
 * The optional source edit is intentionally conservative: only an exact
 * replace_text snapshot can be applied to a safe relative source path. Style
 * and visibility changes remain fully represented in the manifest for the
 * developer to apply without risking an unrelated source mutation.
 */
export async function createRevisionPullRequest(revision: Revision, annotation: Annotation, afterScreenshot?: string | null): Promise<PublishedPullRequest | null> {
  const token = getRuntimeSecret("GITHUB_TOKEN");
  if (!token) return null;

  const owner = getRuntimeSecret("GITHUB_OWNER") || DEFAULT_OWNER;
  const repository = getRuntimeSecret("GITHUB_REPOSITORY") || DEFAULT_REPOSITORY;
  const base = getRuntimeSecret("GITHUB_BASE_BRANCH") || DEFAULT_BASE_BRANCH;
  const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  const baseRef = await githubRequest<GitHubRef>(`${repoPath}/git/ref/heads/${encodeURIComponent(base)}`, token);
  const baseSha = baseRef.object?.sha;
  if (!baseSha) throw new Error("GitHub did not return the base branch SHA.");

  const branch = `metaedit/revision-${revision.id.slice(0, 8)}-${Date.now().toString(36)}`;
  await githubRequest(`${repoPath}/git/refs`, token, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }) });

  const patch = revision.patch;
  const sourcePath = safeSourcePath(annotation.source);
  const replacement = patch.find((operation): operation is Extract<PatchOperation, { op: "replace_text" }> => operation.op === "replace_text" && operation.selector === annotation.selector);
  if (sourcePath && replacement && annotation.textSnapshot) {
    const sourceFile = await readFile(repoPath, sourcePath, branch, token);
    if (sourceFile?.content && sourceFile.encoding === "base64" && sourceFile.sha) {
      const sourceText = decodeBase64(sourceFile.content);
      if (sourceText.includes(annotation.textSnapshot)) {
        const updated = sourceText.replace(annotation.textSnapshot, replacement.value);
        await putFile(repoPath, sourcePath, branch, token, encodeBase64(updated), sourceFile.sha, `MetaEdit: apply revision ${revision.id.slice(0, 8)}`);
      }
    }
  }

  const beforeScreenshot = revision.beforeScreenshot ?? annotation.beforeScreenshot ?? null;
  const finalAfterScreenshot = revision.afterScreenshot ?? afterScreenshot ?? null;
  const beforeScreenshotPath = beforeScreenshot ? `.metaedit/screenshots/${revision.id}-before.${screenshotExtension(beforeScreenshot)}` : null;
  const afterScreenshotPath = finalAfterScreenshot ? `.metaedit/screenshots/${revision.id}-after.${screenshotExtension(finalAfterScreenshot)}` : null;
  const manifestPath = `.metaedit/revisions/${revision.id}.json`;
  const manifest = {
    schemaVersion: 1,
    generatedBy: "MetaEdit",
    revision: {
      id: revision.id,
      version: revision.version,
      parentRevisionId: revision.parentRevisionId ?? null,
      authorId: revision.authorId,
      authorName: revision.authorName,
      instruction: revision.instruction,
      baseVersion: revision.baseVersion,
      status: revision.status,
      patch: revision.patch,
      before: revision.before,
    },
    annotation: {
      id: annotation.id,
      authorId: annotation.authorId,
      authorName: annotation.authorName,
      comment: annotation.comment,
      source: annotation.source,
      selector: annotation.selector,
      component: annotation.component,
      targetId: annotation.targetId,
      textSnapshot: annotation.textSnapshot,
      selectionType: annotation.selectionType ?? "element",
      region: annotation.region ?? null,
      highlightedElements: annotation.highlightedElements ?? [],
    },
    screenshots: {
      before: beforeScreenshotPath,
      after: afterScreenshotPath,
    },
  };
  await putFile(repoPath, manifestPath, branch, token, encodeBase64(JSON.stringify(manifest, null, 2) + "\n"), undefined, `MetaEdit: record revision ${revision.id.slice(0, 8)}`);
  if (beforeScreenshot && beforeScreenshotPath) await putDataUrl(repoPath, beforeScreenshotPath, branch, token, beforeScreenshot, `MetaEdit: add before screenshot ${revision.id.slice(0, 8)}`);
  if (finalAfterScreenshot && afterScreenshotPath) await putDataUrl(repoPath, afterScreenshotPath, branch, token, finalAfterScreenshot, `MetaEdit: add after screenshot ${revision.id.slice(0, 8)}`);

  const body = [
    "## MetaEdit revision",
    "",
    `**Author:** ${safeMarkdown(revision.authorName)}  `,
    `**Annotation:** ${safeMarkdown(annotation.comment)}  `,
    `**Target:** \`${safeMarkdown(annotation.component)} · #${safeMarkdown(annotation.targetId)}\`  `,
    `**Workspace version:** ${revision.version} (based on ${revision.baseVersion})`,
    "",
    "The preview was approved in MetaEdit. The structured patch and the cropped before/after evidence are committed with this pull request.",
    "",
    "### Evidence",
    beforeScreenshot && beforeScreenshotPath ? `- [Before screenshot](https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/blob/${encodeURIComponent(branch)}/${beforeScreenshotPath})` : "- Before screenshot was not available for this agent-created annotation.",
    finalAfterScreenshot && afterScreenshotPath ? `- [After screenshot](https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/blob/${encodeURIComponent(branch)}/${afterScreenshotPath})` : "- After screenshot was not available.",
    `- [Revision manifest](https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/blob/${encodeURIComponent(branch)}/${manifestPath})`,
  ].join("\n");
  const pull = await githubRequest<GitHubPullRequest>(`${repoPath}/pulls`, token, { method: "POST", body: JSON.stringify({ title: `MetaEdit: ${safeMarkdown(revision.instruction).slice(0, 80)}`, head: branch, base, body }) });
  const url = typeof pull.html_url === "string" ? pull.html_url : `https://github.com/${owner}/${repository}/pulls`;
  return { url, number: Number(pull.number ?? 0), commitSha: pull.head?.sha ?? null, branch };
}

async function readFile(repoPath: string, path: string, branch: string, token: string): Promise<GitHubFile | null> {
  try {
    return await githubRequest<GitHubFile>(`${repoPath}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`, token);
  } catch (error) {
    if (error instanceof GitHubRequestError && error.status === 404) return null;
    throw error;
  }
}

async function putFile(repoPath: string, path: string, branch: string, token: string, content: string, sha: string | undefined, message: string) {
  const existing = sha ? { sha } : await readFile(repoPath, path, branch, token);
  await githubRequest(`${repoPath}/contents/${encodePath(path)}`, token, {
    method: "PUT",
    body: JSON.stringify({ message, content, branch, ...(existing?.sha ? { sha: existing.sha } : {}) }),
  });
}

async function putDataUrl(repoPath: string, path: string, branch: string, token: string, dataUrl: string, message: string) {
  const match = dataUrl.match(/^data:image\/(?:svg\+xml|png|jpeg);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) return;
  await putFile(repoPath, path, branch, token, match[1], undefined, message);
}

async function githubRequest<T = unknown>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "MetaEdit/1.0",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let value: unknown = null;
  try { value = text ? JSON.parse(text) : null; } catch { value = null; }
  if (!response.ok) {
    const message = value && typeof value === "object" && "message" in value ? String((value as { message?: unknown }).message) : `GitHub request failed (${response.status}).`;
    throw new GitHubRequestError(message, response.status);
  }
  return value as T;
}

function safeSourcePath(value: string): string | null {
  const path = value.trim();
  if (!path || path.startsWith("/") || path.includes("..") || path.length > 240 || !/^[a-zA-Z0-9._/-]+$/.test(path)) return null;
  return path;
}

function encodePath(path: string) { return path.split("/").map((part) => encodeURIComponent(part)).join("/"); }

function decodeBase64(value: string) {
  const binary = atob(value.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function screenshotExtension(value: string) {
  const match = value.match(/^data:image\/(svg\+xml|png|jpeg);base64,/);
  return match?.[1] === "svg+xml" ? "svg" : match?.[1] === "jpeg" ? "jpg" : "png";
}

function safeMarkdown(value: string) { return value.replace(/[\r\n`]/g, " ").slice(0, 400); }
