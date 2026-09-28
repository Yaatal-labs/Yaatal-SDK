import { YaatalApiError, type FetchLike } from "./http.js";

// The Yaatal API: one OpenAI-compatible endpoint for every model Yaatal sells, billed per token in
// XOF (FCFA) from a prepaid balance. It is a separate service from Engine, with its own address and
// its own API keys ("yk_..."), so it has its own client. Existing OpenAI SDKs work too: point their
// base URL at `<baseUrl>/v1` and use a Yaatal API key.

export interface YaatalInferenceOptions {
  /** The Yaatal API origin, e.g. "https://api.example.com". Also read from YAATAL_API_URL. */
  baseUrl?: string;
  /** A Yaatal API key. Also read from YAATAL_API_KEY. Keep it server-side. */
  apiKey?: string;
  fetch?: FetchLike;
  env?: { YAATAL_API_URL?: string; YAATAL_API_KEY?: string };
}

export interface ModelPricing {
  /** Always "XOF", the West African CFA franc (FCFA). */
  currency: "XOF";
  /** XOF per million input tokens. */
  input_per_million: number;
  /** XOF per million output tokens. */
  output_per_million: number;
}

export interface YaatalModel {
  /** Public id, e.g. "yaatal/nemotron-3-super". */
  id: string;
  object: "model";
  owned_by: string;
  tier: string;
  pricing: ModelPricing;
  max_output_tokens: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
}

/** An OpenAI-style chat completion request. `model` is a Yaatal public id from `models()`. */
export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];
  tools?: unknown[];
  tool_choice?: unknown;
  response_format?: unknown;
  [extra: string]: unknown;
}

export interface ChatCompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatCompletion {
  id: string;
  object: "chat.completion";
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string | null;
  }[];
  usage?: ChatCompletionUsage;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  model: string;
  choices: {
    index: number;
    delta: { role?: string; content?: string | null; reasoning?: string | null; [extra: string]: unknown };
    finish_reason: string | null;
  }[];
  usage?: ChatCompletionUsage;
}

export interface LedgerEntry {
  kind: "usage" | "credit";
  /** Negative for usage, positive for a top-up. */
  amount_xof: number;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  /** True when the upstream reported no usage and tokens were estimated. */
  estimated: boolean;
  note: string | null;
  at: string;
}

export interface Balance {
  balance_xof: number;
  recent: LedgerEntry[];
}

type InferenceEnv = NonNullable<YaatalInferenceOptions["env"]>;

function runtimeEnv(): InferenceEnv {
  const runtime = globalThis as typeof globalThis & { process?: { env?: InferenceEnv } };
  return runtime.process?.env ?? {};
}

export class YaatalInferenceClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: FetchLike;

  constructor(options: YaatalInferenceOptions = {}) {
    const env = options.env ?? runtimeEnv();
    const baseUrl = options.baseUrl ?? env.YAATAL_API_URL;
    if (!baseUrl) throw new Error("Set the Yaatal API address: baseUrl or YAATAL_API_URL.");
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey ?? env.YAATAL_API_KEY;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** Models and their XOF prices. Public: no key needed. */
  async models(): Promise<YaatalModel[]> {
    const list = await this.send<{ data: YaatalModel[] }>("/v1/models", { auth: false });
    return list.data;
  }

  /** One chat completion, billed to the key's balance. */
  chat(request: ChatCompletionRequest): Promise<ChatCompletion> {
    return this.send<ChatCompletion>("/v1/chat/completions", {
      method: "POST",
      body: { ...request, stream: false },
    });
  }

  /**
   * A streamed chat completion, yielded chunk by chunk. Billed once the stream ends, from the
   * usage the final chunk reports.
   */
  async *chatStream(request: ChatCompletionRequest): AsyncGenerator<ChatCompletionChunk> {
    const response = await this.open("/v1/chat/completions", {
      method: "POST",
      body: { ...request, stream: true, stream_options: { include_usage: true } },
    });
    if (!response.body) return;
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        yield JSON.parse(data) as ChatCompletionChunk;
      }
    }
  }

  /** The key's balance in XOF and its most recent ledger entries. */
  balance(): Promise<Balance> {
    return this.send<Balance>("/v1/balance");
  }

  private async send<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
    const response = await this.open(path, init);
    return (await response.json()) as T;
  }

  private async open(path: string, init: { method?: string; body?: unknown; auth?: boolean }): Promise<Response> {
    const headers = new Headers();
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    if (init.auth !== false) {
      if (!this.apiKey) throw new Error("This call needs a Yaatal API key: apiKey or YAATAL_API_KEY.");
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }
    const requestInit: RequestInit = { method: init.method ?? "GET", headers };
    if (init.body !== undefined) requestInit.body = JSON.stringify(init.body);
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, requestInit);
    if (!response.ok) {
      const text = await response.text();
      let body: unknown = text;
      try { body = JSON.parse(text); } catch { /* plain-text error */ }
      throw new YaatalApiError(response.status, body);
    }
    return response;
  }
}

export function createYaatalInference(options: YaatalInferenceOptions = {}): YaatalInferenceClient {
  return new YaatalInferenceClient(options);
}
