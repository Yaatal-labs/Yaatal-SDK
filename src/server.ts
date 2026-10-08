// Server-only entry: `import { partnerAuth, kairmelAdmin } from "@yaatal/client/server"`.
//
// Everything here holds a shared secret or an admin token. The main entry (`@yaatal/client`) never
// imports this file, so a browser or mobile bundle cannot pick it up by accident. Run it on a
// backend only.

import { getEngineApiUrl, type EngineRuntimeEnv } from "./env.js";
import { EngineHttpClient, type FetchLike } from "./http.js";
import { KairmelApiError } from "./inference.js";

// ---------------------------------------------------------------------------------------------
// WhatsApp sign-in for partner platforms (Engine: controllers/whatsapp_partner_auth.rs)
// ---------------------------------------------------------------------------------------------

export interface PartnerAuthEnv extends EngineRuntimeEnv {
  ENGINE_AUTH_SECRET?: string;
}

export interface PartnerAuthOptions {
  /** The Engine origin. Also read from YAATAL_ENGINE_API_URL. */
  baseUrl?: string;
  /** The shared secret the Engine knows as ENGINE_AUTH_SECRET. Also read from ENGINE_AUTH_SECRET. */
  secret?: string;
  fetch?: FetchLike;
  env?: PartnerAuthEnv;
}

/** whatsapp_partner_auth.rs:56 StartResponse. */
export interface PartnerAuthStart {
  /** The attempt id: poll `status` with it and submit it to `verify`. */
  id: string;
  /** Deep link to show or open; the prefilled text is `LOGIN-{id}`. */
  whatsapp_url: string;
  expires_in_seconds: number;
}

/** whatsapp_partner_auth.rs:71 StatusResponse. */
export interface PartnerAuthStatus {
  status: "pending" | "code_sent" | "expired";
}

/** whatsapp_partner_auth.rs:84 VerifyResponse: the Engine's stable user id, never a token or a number. */
export interface PartnerAuthVerified {
  pid: string;
}

export interface PartnerAuthClient {
  /** Open a sign-in attempt. */
  start(): Promise<PartnerAuthStart>;
  /** Has the code reached the user's WhatsApp yet? */
  status(id: string): Promise<PartnerAuthStatus>;
  /** Exchange the code the user read off their phone for their Engine `pid`. A wrong code is a 401. */
  verify(id: string, code: string): Promise<PartnerAuthVerified>;
}

const PARTNER_PREFIX = "/api/auth/whatsapp/partner";

export function createPartnerAuth(options: PartnerAuthOptions = {}): PartnerAuthClient {
  const env = options.env ?? runtimeEnv<PartnerAuthEnv>();
  const secret = options.secret ?? env.ENGINE_AUTH_SECRET;
  if (!secret) {
    throw new Error("partnerAuth needs the shared secret: secret or ENGINE_AUTH_SECRET.");
  }
  const http = new EngineHttpClient({
    baseUrl: options.baseUrl ?? getEngineApiUrl(env),
    fetch: options.fetch,
    headers: { "X-Engine-Auth-Secret": secret },
  });
  return {
    start: () => http.request<PartnerAuthStart>(`${PARTNER_PREFIX}/start`, { method: "POST" }),
    status: id => http.request<PartnerAuthStatus>(`${PARTNER_PREFIX}/status`, { query: { id } }),
    verify: (id, code) =>
      http.request<PartnerAuthVerified>(`${PARTNER_PREFIX}/verify`, { method: "POST", body: { id, code } }),
  };
}

/** `partnerAuth` configured from the environment (ENGINE_AUTH_SECRET, YAATAL_ENGINE_API_URL), on first use. */
export const partnerAuth: PartnerAuthClient = {
  start: () => createPartnerAuth().start(),
  status: id => createPartnerAuth().status(id),
  verify: (id, code) => createPartnerAuth().verify(id, code),
};

// ---------------------------------------------------------------------------------------------
// Kairmel admin (token gateway: apps/token-gateway/src/index.ts)
// ---------------------------------------------------------------------------------------------

const DEFAULT_KAIRMEL_URL = "https://api.kairmel.com";

export interface KairmelAdminEnv {
  KAIRMEL_API_URL?: string;
  KAIRMEL_ADMIN_TOKEN?: string;
}

export interface KairmelAdminOptions {
  /** The Kairmel API origin. Also read from KAIRMEL_API_URL; defaults to https://api.kairmel.com. */
  baseUrl?: string;
  /** The admin token, or the issuer token (which reaches only the account and key routes). Also read from KAIRMEL_ADMIN_TOKEN. */
  adminToken?: string;
  fetch?: FetchLike;
  env?: KairmelAdminEnv;
}

/** Contract C1: the account a gateway holds for an Engine user. */
export interface KairmelAccountByPid {
  id: string;
  engine_pid: string;
  /** False when the account already existed. */
  created: boolean;
  balance_xof: number;
}

/** `POST /admin/accounts/:id/keys`: the raw key is shown once. */
export interface KairmelCreatedKey {
  key_id: string;
  api_key: string;
}

export interface KairmelAdminClient {
  /** Idempotent: finds or creates the gateway account keyed by an Engine user pid (a UUID). */
  upsertAccountByPid(pid: string, options?: { name?: string }): Promise<KairmelAccountByPid>;
  /** Mint another API key on an account. The raw key is returned once. */
  createKey(accountId: string, label: string): Promise<KairmelCreatedKey>;
}

export function createKairmelAdmin(options: KairmelAdminOptions = {}): KairmelAdminClient {
  const env = options.env ?? runtimeEnv<KairmelAdminEnv>();
  const adminToken = options.adminToken ?? env.KAIRMEL_ADMIN_TOKEN;
  if (!adminToken) {
    throw new Error("kairmelAdmin needs an admin token: adminToken or KAIRMEL_ADMIN_TOKEN.");
  }
  const baseUrl = (options.baseUrl ?? env.KAIRMEL_API_URL ?? DEFAULT_KAIRMEL_URL).replace(/\/+$/, "");
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function send<T>(method: string, path: string, body: unknown): Promise<T> {
    const headers = new Headers({ Authorization: `Bearer ${adminToken}` });
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
      init.body = JSON.stringify(body);
    }
    const response = await fetchImpl(`${baseUrl}${path}`, init);
    const text = await response.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* plain-text error */ }
    if (!response.ok) throw new KairmelApiError(response.status, parsed);
    return parsed as T;
  }

  return {
    upsertAccountByPid: (pid, opts = {}) =>
      send<KairmelAccountByPid>(
        "PUT",
        `/admin/accounts/by-pid/${encodeURIComponent(pid)}`,
        opts.name === undefined ? undefined : { name: opts.name },
      ),
    createKey: (accountId, label) =>
      send<KairmelCreatedKey>("POST", `/admin/accounts/${encodeURIComponent(accountId)}/keys`, { label }),
  };
}

/** `kairmelAdmin` configured from the environment (KAIRMEL_ADMIN_TOKEN, KAIRMEL_API_URL), on first use. */
export const kairmelAdmin: KairmelAdminClient = {
  upsertAccountByPid: (pid, options) => createKairmelAdmin().upsertAccountByPid(pid, options),
  createKey: (accountId, label) => createKairmelAdmin().createKey(accountId, label),
};

export { KairmelApiError };

function runtimeEnv<T>(): T {
  const runtime = globalThis as typeof globalThis & { process?: { env?: T } };
  return runtime.process?.env ?? ({} as T);
}
