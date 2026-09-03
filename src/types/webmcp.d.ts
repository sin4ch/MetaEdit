interface WebMCPToolResult { content: Array<{ type: "text"; text: string }> }
interface WebMCPExecuteOptions { signal: AbortSignal }
interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>, options: WebMCPExecuteOptions) => Promise<WebMCPToolResult> | WebMCPToolResult;
}
interface ModelContextRegisterToolOptions { signal?: AbortSignal; exposedTo?: string[] }
interface DocumentModelContext {
  registerTool(tool: WebMCPTool, options?: ModelContextRegisterToolOptions): Promise<void>;
  getTools?: () => Promise<unknown[]>;
}
interface Document { modelContext?: DocumentModelContext }
