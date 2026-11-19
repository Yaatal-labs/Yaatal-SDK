import { EngineHttpClient, type FetchLike } from "./http.js";

// Bocalines, the Yaatal calling system (a FastAPI app). Separate service from Engine: its own address
// and its own API keys, sent as `X-API-Key`. Routes live under `<baseUrl>/api/v1`.
//
// Shapes mirror Bocalines (branch bocalines-test):
//   api/routes/workflow.py            GET /workflow/fetch, /fetch/{id}, /{id}/runs, /{id}/runs/{run_id}
//   api/routes/workflow_text_chat.py  POST /workflow/{id}/text-chat/sessions, .../sessions/{run_id}/messages
//   api/routes/public_agent.py        POST /public/agent/workflow/{workflow_uuid} (API-key phone call)
//   api/schemas/workflow.py           WorkflowRunResponseSchema

export interface CallsClientOptions {
  /** The Bocalines origin, e.g. "https://calls.example.com". `/api/v1` is added for you. */
  baseUrl: string;
  /** A Bocalines API key, sent as X-API-Key. Keep it server-side. */
  apiKey: string;
  fetch?: FetchLike | undefined;
}

export type AgentStatus = "active" | "archived";

/** workflow.py WorkflowListResponse. Bocalines calls an agent a "workflow". */
export interface AgentSummary {
  id: number;
  name: string;
  status: string;
  created_at: string;
  total_runs: number;
  folder_id: number | null;
  /** The id the phone-call route takes. */
  workflow_uuid: string | null;
}

/** GET /workflow/fetch/{id}. `workflow_definition` is the agent graph, secrets masked by the server. */
export interface Agent {
  id: number;
  name: string;
  status: string;
  created_at: string;
  workflow_definition: Record<string, unknown>;
  current_definition_id: number | null;
  template_context_variables: Record<string, unknown> | null;
  call_disposition_codes: unknown;
  workflow_configurations: Record<string, unknown> | null;
  version_number: number | null;
  version_status: string | null;
  workflow_uuid: string | null;
}

/** schemas/workflow.py WorkflowRunResponseSchema. The transcript is behind `transcript_url` / `transcript_public_url`. */
export interface Run {
  id: number;
  workflow_id: number;
  workflow_name?: string | null;
  version_number?: number | null;
  name: string;
  mode: string;
  created_at: string;
  is_completed: boolean;
  transcript_url: string | null;
  recording_url: string | null;
  user_recording_url?: string | null;
  bot_recording_url?: string | null;
  transcript_public_url?: string | null;
  recording_public_url?: string | null;
  user_recording_public_url?: string | null;
  bot_recording_public_url?: string | null;
  public_access_token?: string | null;
  cost_info: Record<string, unknown> | null;
  usage_info?: Record<string, unknown> | null;
  definition_id: number | null;
  initial_context?: Record<string, unknown> | null;
  gathered_context?: Record<string, unknown> | null;
  call_type: string;
  logs?: Record<string, unknown> | null;
  annotations?: Record<string, unknown> | null;
}

export interface RunList {
  runs: Run[];
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
  applied_filters?: unknown[] | null;
}

export interface ListRunsParams {
  /** Starts at 1. */
  page?: number;
  /** 1 to 100; the server default is 50. */
  limit?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  /** Server filters, e.g. [{ attribute: "dateRange", value: { from, to } }]. Allowed attributes: dateRange, dispositionCode, duration, status, tokenUsage. */
  filters?: { attribute: string; value: unknown }[];
}

export interface StartTextChatRequest {
  name?: string;
  initial_context?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  /** Client correlation id (UUID) to recover the session if the response is lost. */
  request_id?: string;
}

/** workflow_text_chat.py WorkflowRunTextSessionResponse. The conversation is in `session_data`. */
export interface TextChatSession {
  workflow_run_id: number;
  workflow_id: number;
  name: string;
  mode: string;
  state: string;
  is_completed: boolean;
  /** Pass the last seen value back as `expected_revision` to refuse a stale write (409). */
  revision: number;
  initial_context: Record<string, unknown> | null;
  gathered_context: Record<string, unknown> | null;
  annotations: Record<string, unknown> | null;
  session_data: Record<string, unknown>;
  checkpoint: Record<string, unknown>;
  created_at: string;
  updated_at: string | null;
}

export interface StartPhoneCallRequest {
  /** E.164, e.g. "+14155550123". */
  phone_number: string;
  initial_context?: Record<string, unknown>;
  telephony_configuration_id?: number;
  from_phone_number_id?: number;
}

export interface StartPhoneCallOptions {
  /** Run the latest draft instead of the published agent (POST /public/agent/test/workflow/{uuid}). */
  draft?: boolean;
}

export interface PhoneCall {
  status: string;
  workflow_run_id: number;
  workflow_run_name: string;
}

const E164 = /^\+[1-9]\d{6,14}$/;

function id(value: number, what: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${what} must be a positive integer.`);
  return value;
}

export class CallsClient {
  private readonly http: EngineHttpClient;

  constructor(options: CallsClientOptions) {
    if (!options.apiKey) throw new Error("CallsClient needs a Bocalines API key.");
    this.http = new EngineHttpClient({
      baseUrl: `${options.baseUrl.replace(/\/+$/, "")}/api/v1`,
      headers: { "X-API-Key": options.apiKey },
      fetch: options.fetch,
    });
  }

  listAgents(params: { status?: AgentStatus | AgentStatus[] } = {}): Promise<AgentSummary[]> {
    const status = [params.status ?? []].flat().join(",");
    return this.http.request<AgentSummary[]>("/workflow/fetch", { query: { status: status || undefined } });
  }

  getAgent(agentId: number): Promise<Agent> {
    return this.http.request<Agent>(`/workflow/fetch/${id(agentId, "agentId")}`);
  }

  listRuns(agentId: number, params: ListRunsParams = {}): Promise<RunList> {
    const { filters, ...rest } = params;
    return this.http.request<RunList>(`/workflow/${id(agentId, "agentId")}/runs`, {
      query: { ...rest, filters: filters ? JSON.stringify(filters) : undefined },
    });
  }

  getRun(agentId: number, runId: number): Promise<Run> {
    return this.http.request<Run>(`/workflow/${id(agentId, "agentId")}/runs/${id(runId, "runId")}`);
  }

  startTextChat(agentId: number, body: StartTextChatRequest = {}): Promise<TextChatSession> {
    return this.http.request<TextChatSession>(`/workflow/${id(agentId, "agentId")}/text-chat/sessions`, {
      method: "POST",
      body,
    });
  }

  /** Sends one user turn and returns the session after the agent has answered. */
  sendTextMessage(
    agentId: number,
    runId: number,
    text: string,
    options: { expected_revision?: number } = {},
  ): Promise<TextChatSession> {
    if (!text.trim()) throw new Error("text must not be empty.");
    return this.http.request<TextChatSession>(
      `/workflow/${id(agentId, "agentId")}/text-chat/sessions/${id(runId, "runId")}/messages`,
      { method: "POST", body: { text, ...options } },
    );
  }

  /**
   * Place an outbound phone call with the agent identified by its `workflow_uuid`. This dials a real
   * number once Bocalines has telephony configured: validate the number and who asked before calling.
   */
  startPhoneCall(
    workflowUuid: string,
    body: StartPhoneCallRequest,
    options: StartPhoneCallOptions = {},
  ): Promise<PhoneCall> {
    if (!E164.test(body.phone_number)) throw new Error("phone_number must be E.164, e.g. +14155550123.");
    if (!workflowUuid) throw new Error("workflowUuid is required.");
    const path = `/public/agent/${options.draft ? "test/" : ""}workflow/${encodeURIComponent(workflowUuid)}`;
    return this.http.request<PhoneCall>(path, { method: "POST", body });
  }
}

export function createCallsClient(options: CallsClientOptions): CallsClient {
  return new CallsClient(options);
}
