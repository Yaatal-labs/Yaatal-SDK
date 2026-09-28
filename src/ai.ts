import type { EngineHttpClient } from "./http.js";

export interface EngineChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface EngineChatRequest {
  /** Engine picks the tier and the model; callers cannot choose one. */
  messages: EngineChatMessage[];
}

export interface EngineChatResponse {
  content: string;
  /** Which tier of Engine's cascade answered (cheapest first). */
  tier_used: number | string;
  /** The model Engine chose. */
  model: string;
  /** Opaque id to quote when reporting a problem. */
  request_id: string;
  capability: string;
}

/**
 * Engine's own AI gateway: tiered routing, per-process budget and sensitivity rules. Requires a
 * signed-in client. For OpenAI-compatible, FCFA-metered calls with a Yaatal API key, use
 * `createYaatalInference` instead.
 */
export class AiClient {
  constructor(private readonly http: EngineHttpClient) {}

  chat(request: EngineChatRequest): Promise<EngineChatResponse> {
    return this.http.request<EngineChatResponse>("/api/ai/chat", {
      method: "POST",
      body: request,
    });
  }

  /** Same answer as `chat`, served on the non-streaming path. */
  chatSync(request: EngineChatRequest): Promise<EngineChatResponse> {
    return this.http.request<EngineChatResponse>("/api/ai/chat/sync", {
      method: "POST",
      body: request,
    });
  }
}
