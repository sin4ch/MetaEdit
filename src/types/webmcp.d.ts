interface WebMCPToolResult { content: Array<{ type: "text"; text: string }> }
interface WebMCPTool { name: string; description: string; inputSchema: Record<string, unknown>; annotations?: Record<string, boolean>; execute: (input: Record<string, unknown>) => Promise<WebMCPToolResult> | WebMCPToolResult }
interface DocumentModelContext { registerTool(tool: WebMCPTool): void; unregisterTool(name: string): void }
interface Document { modelContext?: DocumentModelContext }
