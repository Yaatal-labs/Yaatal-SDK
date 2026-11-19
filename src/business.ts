import { EngineHttpClient, type FetchLike } from "./http.js";

// Business profiles on the Gloop voice Worker: one source of truth per business, read by the website and by
// the phone agents at the start of every call. Reads are public (no key). Edits are proposed and approved
// operator-side, so this module has no write calls (Yaatal-labs/gloop-lab voice-cf/worker.js `biz`).

const DEFAULT_BASE_URL = "https://glooplab-voice.ameth749.workers.dev";

export interface BusinessClientOptions {
  /** The Worker origin. Defaults to https://glooplab-voice.ameth749.workers.dev. */
  baseUrl?: string;
  fetch?: FetchLike | undefined;
}

export interface BusinessOffer {
  id: string;
  name: string;
  price?: string;
  note?: string;
  /** A price table: `columns` heads the first row's label plus values. */
  columns?: string[];
  rows?: string[][];
  active?: boolean;
}

export interface BusinessData {
  name?: string;
  assistant?: string;
  contact?: { address?: string; phone?: string; website?: string };
  hours: string[];
  notices: { text: string; until?: string }[];
  offers: BusinessOffer[];
  facts: string[];
  /** Things the team still has to confirm; an agent must not guess them. */
  unknown: string[];
}

export interface BusinessProfile {
  id: string;
  version: number;
  updated_at: string;
  data: BusinessData;
}

/** What the Bocalines pre-call fetch merges into a call. */
export interface PrecallContext {
  initial_context: { business_id: string; business_name: string; business_facts: string };
}

const BUSINESS_ID = /^[a-z][a-z0-9-]{1,40}$/;

export class BusinessClient {
  private readonly http: EngineHttpClient;

  constructor(options: BusinessClientOptions = {}) {
    this.http = new EngineHttpClient({ baseUrl: options.baseUrl ?? DEFAULT_BASE_URL, fetch: options.fetch });
  }

  /** The live profile (expired notices already removed). Private or unknown businesses answer 404. */
  profile(businessId: string): Promise<BusinessProfile> {
    return this.http.request<BusinessProfile>(this.path(businessId));
  }

  /** The profile as plain text a voice agent can read. */
  facts(businessId: string): Promise<string> {
    return this.http.request<string>(`${this.path(businessId)}/facts`);
  }

  /** The Bocalines pre-call payload: business id, name and facts. */
  precall(businessId: string): Promise<PrecallContext> {
    return this.http.request<PrecallContext>(`${this.path(businessId)}/precall`, { method: "POST" });
  }

  private path(businessId: string): string {
    if (!BUSINESS_ID.test(businessId)) throw new Error("businessId must be a lowercase slug (letters, digits, dashes).");
    return `/api/biz/${businessId}`;
  }
}

export function createBusinessClient(options: BusinessClientOptions = {}): BusinessClient {
  return new BusinessClient(options);
}
