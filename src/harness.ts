import type { EngineHttpClient } from "./http.js";
import type { JsonValue } from "./types.js";

/**
 * Lifecycle of a Harness L1 proposal. `Proposed` is the only state a human can
 * decide from; `Approved`/`Rejected` are terminal (see `decide` in the Engine
 * controller — a second decision on an already-decided proposal is a 400).
 */
export type ProposalStatus = "Proposed" | "Approved" | "Rejected";

export interface HarnessProposal {
  id: string;
  kind: string;
  tool: string | null;
  /** The opaque `ProposalChange` payload the Harness runner produced. */
  change: JsonValue | null;
  rationale: string;
  evidence_runs: number;
  status: ProposalStatus;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

export interface ListProposalsParams {
  /** Filter by status; omit for all. */
  status?: ProposalStatus | string;
}

export class HarnessClient {
  constructor(private readonly http: EngineHttpClient) {}

  list(params: ListProposalsParams = {}): Promise<HarnessProposal[]> {
    return this.http.request<HarnessProposal[]>("/api/harness/proposals", {
      query: { ...params },
    });
  }

  /** 400 if the proposal is already decided, 404 if the id is unknown. */
  approve(id: string): Promise<HarnessProposal> {
    return this.http.request<HarnessProposal>(
      `/api/harness/proposals/${encodeURIComponent(id)}/approve`,
      { method: "POST" },
    );
  }

  /** 400 if the proposal is already decided, 404 if the id is unknown. */
  reject(id: string): Promise<HarnessProposal> {
    return this.http.request<HarnessProposal>(
      `/api/harness/proposals/${encodeURIComponent(id)}/reject`,
      { method: "POST" },
    );
  }
}
