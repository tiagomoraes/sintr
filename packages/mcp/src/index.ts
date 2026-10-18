/**
 * The MCP surface of sintr (milestone F3). Interfaces only: nothing here
 * runs yet. They fix the contract the pack and other agents will rely on,
 * so it can be reviewed before it is built.
 *
 * Rules the server will follow:
 * - every call is made with an API token (scoped per data type, revocable,
 *   stored hashed) and runs inside that token owner's `UserScope`;
 * - a tool may only touch what its scope allows;
 * - nothing is sent to anyone from MCP without a recorded, per-report consent;
 * - tool results carry the person's words verbatim, never paraphrased.
 */
import type { ApiTokenPrincipal } from "@sintr/core/auth";
import type {
  ApiTokenScope,
  Checkin,
  CheckinInput,
  Entry,
  EntryInput,
  Insight,
  Report,
  TherapyNote,
  TherapyNoteInput,
  TherapySettings,
  UserScope,
} from "@sintr/core";

export type McpTransport = "stdio" | "http";

/** One tool: its name, what it needs, what it takes and what it returns. */
export interface McpTool<Name extends string, Input, Output> {
  readonly name: Name;
  readonly description: string;
  readonly scope: ApiTokenScope;
  /** Never called in F0. */
  handle(input: Input, context: McpCallContext): Promise<Output>;
}

/** What a tool call runs with: the authenticated principal and their scope only. */
export interface McpCallContext {
  readonly principal: ApiTokenPrincipal;
  readonly scope: UserScope;
}

/** The planned tools, mirroring the pack's flows (capture, check-in, therapy, report). */
export interface SintrTools {
  record_entry: McpTool<"record_entry", EntryInput, Entry>;
  update_entry: McpTool<"update_entry", { id: string; patch: EntryInput }, Entry>;
  list_entries: McpTool<"list_entries", { from?: string; to?: string }, Entry[]>;
  record_checkin: McpTool<"record_checkin", CheckinInput, Checkin>;
  list_checkins: McpTool<"list_checkins", { from?: string; to?: string }, Checkin[]>;
  get_therapy_context: McpTool<
    "get_therapy_context",
    Record<string, never>,
    { settings: TherapySettings; notes: TherapyNote[] }
  >;
  add_therapy_note: McpTool<"add_therapy_note", TherapyNoteInput, TherapyNote>;
  list_insights: McpTool<"list_insights", Record<string, never>, Insight[]>;
  get_report: McpTool<"get_report", { id: string }, Report | null>;
}

export type SintrToolName = keyof SintrTools;

/** Read-only resources the server will expose, addressed by URI. */
export type SintrResourceUri = "sintr://entries" | "sintr://checkins" | "sintr://therapy" | "sintr://reports";

export interface McpServerOptions {
  readonly transport: McpTransport;
  /** Resolves a bearer token to its owner; null refuses the call. */
  authenticate(token: string): Promise<ApiTokenPrincipal | null>;
  /** Opens the owner's data scope. */
  openScope(userId: string): Promise<UserScope>;
}

export interface SintrMcpServer {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export type CreateMcpServer = (options: McpServerOptions) => SintrMcpServer;
