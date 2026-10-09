import type { EngineHttpClient } from "./http.js";

// The Commerce Sheet: a seller puts a product on air and gets one link per channel; a buyer opens
// the link without signing in and checks out. Every amount is whole FCFA (XOF), an integer.
//
// Shapes mirror the Engine (Yaatal-labs/Yaatal-Engine, branch yaatal/uni-payments at fb8d70de + T6):
//   requests  crates/yaatal-api/src/controllers/commerce.rs  PutOnAirParams (L87), DeliveryQuery (L116),
//             DeliveryUpdate (L122), ContactParams (L129), CheckoutParams (L141)
//   responses crates/yaatal-api/src/views/commerce.rs        ProductCard (L10) ... DeliveryResponse (L123)
//   routes    controllers/commerce.rs `routes()` (/api/commerce, JWT) and `public_routes()` (/b, no auth)

/** views/commerce.rs:10 ProductCard. `id` is on seller views only. */
export interface CommerceProductCard {
  id?: string;
  name: string;
  description: string | null;
  price_fcfa: number;
  currency: string;
  media_url: string | null;
  variants: string[];
  remaining_stock: number;
}

/** views/commerce.rs:25 Delivery. */
export interface CommerceDelivery {
  fee_fcfa: number | null;
  note: string | null;
}

/** views/commerce.rs:32 ShareLinks. */
export interface CommerceShareLinks {
  whatsapp: string;
  telegram: string;
}

/** views/commerce.rs:39 IntentResponse: what the seller gets when a product goes on air. */
export interface CommerceIntent {
  version: string;
  intent_id: string;
  /** "active" or "closed". */
  status: string;
  created_at: string;
  live_session_id: string | null;
  product: CommerceProductCard;
  delivery: CommerceDelivery;
  public_url: string;
  livestream_url: string;
  /** One link per channel: copy, livestream, telegram, whatsapp, bobo. */
  links: Record<string, string>;
  share: CommerceShareLinks;
}

/** views/commerce.rs:55 Provider. */
export interface CommerceProvider {
  id: string;
  label: string;
}

/** views/commerce.rs:62 SheetResponse: what the buyer's sheet shows. */
export interface CommerceSheet {
  version: string;
  status: string;
  merchant_name: string;
  product: CommerceProductCard;
  delivery: CommerceDelivery;
  providers: CommerceProvider[];
  /** True while checkouts are simulated (no money moves). */
  sandbox: boolean;
}

/** views/commerce.rs:74 ReceiptResponse. */
export interface CommerceReceipt {
  version: string;
  receipt_id: string;
  /** Short reference the buyer can quote, e.g. "YTL-1A2B3C4D". */
  reference: string;
  intent_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  variant: string | null;
  total_fcfa: number;
  /** Owed on top of `total_fcfa` when the link announced a delivery fee. */
  delivery_fee_fcfa: number | null;
  currency: string;
  /** Only on the buyer's own receipt. */
  seller_whatsapp?: string;
  payment_provider: string;
  payment_provider_label: string;
  payment_status: string;
  live_session_id: string | null;
  source_channel: string;
  created_at: string;
  /** True when this answers a replayed checkout (nothing was charged again). */
  deduplicated: boolean;
  /** The online payment, on the buyer's own receipt; absent for pay on delivery. */
  payment?: CommercePayment;
}

/** views/commerce.rs PaymentView: an online payment and where the buyer approves it. */
export interface CommercePayment {
  /** "sandbox", "wave" or "pispi". */
  rail: string;
  /** Our payment reference ("YT" + 20 hex); proves the buyer on later receipt calls. */
  tx_id: string;
  /** "pending", "succeeded", "failed" or "reversed". */
  status: string;
  /** Send the buyer here to pay, while `status` is "pending" (Wave's own page for Wave). */
  launch_url?: string;
}

/** controllers/commerce.rs buyer_escrow_move: the receipt's new payment status after a buyer move. */
export interface EscrowMoveResult {
  /** "released" after confirm, "disputed" after dispute. */
  payment_status: string;
}

/** How a buyer proves a receipt is theirs: the payment reference or the checkout's idempotency key. */
export type ReceiptProof = { tx: string } | { key: string };

/** services/merchant_money.rs LedgerLine. */
export interface CommerceLedgerLine {
  /** "payment_in", "refund_out" or "payout_out". */
  kind: string;
  amount_fcfa: number;
  receipt_id: string | null;
  reference: string | null;
  created_at: string;
}

/** services/merchant_money.rs MoneyView: the seller's money, whole FCFA. */
export interface CommerceMoney {
  /** Paid by buyers, waiting on their confirmation. */
  in_escrow: number;
  /** Contested, frozen until an operator decides. */
  disputed: number;
  /** Confirmed by buyers, not yet paid out: the next payout. */
  balance: number;
  paid_out: number;
  refunded: number;
  /** "none", "pending", "verified" or "rejected". Payouts need "verified". */
  kyc_status: string;
  recent: CommerceLedgerLine[];
}

/** controllers/commerce_money.rs kyc_json. */
export interface CommerceKyc {
  status: string;
  document_ref?: string | null;
  submitted_at?: string;
  reviewed_at?: string | null;
}

/** views/commerce.rs:103 ConversionsResponse. */
export interface CommerceConversions {
  live_session_id: string | null;
  count: number;
  units: number;
  total_fcfa: number;
  by_channel: Record<string, number>;
  receipts: CommerceReceipt[];
}

/** views/commerce.rs:114 ContactView: personal data, only in the seller's own delivery list. */
export interface CommerceContactView {
  name: string;
  phone: string;
  area: string;
  note: string | null;
}

/** views/commerce.rs:123 DeliveryResponse: one pay-on-delivery order. `contact` is null once purged. */
export interface CommerceDeliveryOrder {
  receipt: CommerceReceipt;
  contact: CommerceContactView | null;
}

/** controllers/commerce.rs:87 PutOnAirParams. */
export interface PutOnAirRequest {
  product_id: string;
  live_session_id?: string;
  /** Sizes, colours...: the buyer must pick one when any are given. */
  variants?: string[];
  /** Whole FCFA, at most 50 000. */
  delivery_fee_fcfa?: number;
  /** Delivery promise, e.g. "Dakar, sous 24 h". */
  delivery_note?: string;
  /** The seller's WhatsApp number, handed to a buyer on their receipt. */
  whatsapp?: string;
  /** "product" (default) or "token_pack" (Kairmel API credit; Yaatal's own merchant only). */
  kind?: "product" | "token_pack";
}

/** controllers/commerce.rs:116 DeliveryQuery. */
export interface ListCommerceDeliveriesParams {
  live_session_id?: string;
  /** A receipt payment_status, e.g. "cod_pending". */
  status?: string;
}

/** controllers/commerce.rs:122 DeliveryUpdate: "delivered" marks it paid, "cancelled" returns the stock. */
export type CommerceDeliveryStatus = "delivered" | "cancelled";

/** controllers/commerce.rs:129 ContactParams: who to deliver to, for pay on delivery. */
export interface CommerceContact {
  name: string;
  phone: string;
  area: string;
  note?: string;
}

/** controllers/commerce.rs:141 CheckoutParams. */
export interface SheetCheckoutRequest {
  /** A `providers[].id` from the sheet, e.g. "cash_on_delivery" or "wave". */
  provider: string;
  /** 1 to 10; the Engine defaults to 1. */
  quantity?: number;
  variant?: string;
  /** copy, livestream, telegram, whatsapp or bobo; anything else is credited as "unknown". */
  source_channel?: string;
  /** 8 to 128 characters of [A-Za-z0-9_.:-]; a replay returns the same receipt. */
  idempotency_key: string;
  /** Required for cash_on_delivery, ignored otherwise. */
  contact?: CommerceContact;
}

/** The seller's side of the Commerce Sheet (`/api/commerce/*`). Needs a signed-in client. */
export class CommerceClient {
  constructor(private readonly http: EngineHttpClient) {}

  /** Put a product on air. The same product, session, price and variants keep their link. */
  putOnAir(request: PutOnAirRequest): Promise<CommerceIntent> {
    return this.http.request<CommerceIntent>("/api/commerce/intents", {
      method: "POST",
      body: request,
    });
  }

  /** Products on air, to share again. */
  listOnAir(params: { live_session_id?: string } = {}): Promise<CommerceIntent[]> {
    return this.http.request<CommerceIntent[]>("/api/commerce/intents", {
      query: { ...params },
    });
  }

  /** Take a product off air; its links stop selling (replays still get their receipt). */
  takeOffAir(intentId: string): Promise<CommerceIntent> {
    return this.http.request<CommerceIntent>(
      `/api/commerce/intents/${encodeURIComponent(intentId)}/close`,
      { method: "POST" },
    );
  }

  /** Sales credited to the seller, for one live with `live_session_id`. Receipts carry no buyer data. */
  conversions(params: { live_session_id?: string } = {}): Promise<CommerceConversions> {
    return this.http.request<CommerceConversions>("/api/commerce/conversions", {
      query: { ...params },
    });
  }

  /** Pay-on-delivery orders, with whom to deliver to. */
  deliveries(params: ListCommerceDeliveriesParams = {}): Promise<CommerceDeliveryOrder[]> {
    return this.http.request<CommerceDeliveryOrder[]>("/api/commerce/deliveries", {
      query: { ...params },
    });
  }

  /** Where the seller's money stands: escrow, balance, paid out, refunds, recent ledger. */
  money(): Promise<CommerceMoney> {
    return this.http.request<CommerceMoney>("/api/commerce/money");
  }

  /** The seller's identity check, which payouts need. */
  kyc(): Promise<CommerceKyc> {
    return this.http.request<CommerceKyc>("/api/commerce/kyc");
  }

  /** Submit a reference to an identity document (e.g. its number), never the document itself. */
  submitKyc(documentRef: string): Promise<CommerceKyc> {
    return this.http.request<CommerceKyc>("/api/commerce/kyc", {
      method: "POST",
      body: { document_ref: documentRef },
    });
  }

  /**
   * Buy a token pack (Kairmel API credit) as the signed-in user: the credit lands on their own
   * Kairmel account. Answers like `sheet.checkout`; send the buyer to `payment.launch_url`.
   */
  buyTokenPack(token: string, request: SheetCheckoutRequest): Promise<CommerceReceipt> {
    return this.http.request<CommerceReceipt>(
      `/api/commerce/token-packs/${encodeURIComponent(token)}/checkout`,
      { method: "POST", body: request },
    );
  }

  /** Mark a pay-on-delivery order delivered or cancelled. `receiptId` is the receipt's `receipt_id`. */
  updateDelivery(
    receiptId: string,
    update: { status: CommerceDeliveryStatus },
  ): Promise<CommerceDeliveryOrder> {
    return this.http.request<CommerceDeliveryOrder>(
      `/api/commerce/deliveries/${encodeURIComponent(receiptId)}`,
      { method: "PATCH", body: update },
    );
  }
}

/** The buyer's side (`/b/{token}`): the link's token is the capability, so these never send a bearer token. */
export class SheetClient {
  constructor(private readonly http: EngineHttpClient) {}

  /** What the sheet behind a link shows. 404 `intent_not_found` for an unknown token. */
  get(token: string): Promise<CommerceSheet> {
    return this.http.request<CommerceSheet>(`/b/${encodeURIComponent(token)}/sheet`, {
      auth: false,
    });
  }

  /**
   * Explicit, idempotent checkout. Replaying an `idempotency_key` returns the receipt with
   * `deduplicated: true`. For an online payment, send the buyer to `payment.launch_url`.
   */
  checkout(token: string, request: SheetCheckoutRequest): Promise<CommerceReceipt> {
    return this.http.request<CommerceReceipt>(`/b/${encodeURIComponent(token)}/checkout`, {
      method: "POST",
      auth: false,
      body: request,
    });
  }

  /** The buyer's receipt, read back (e.g. on return from Wave, which also settles a late payment). */
  receipt(token: string, receiptId: string, proof: ReceiptProof): Promise<CommerceReceipt> {
    return this.http.request<CommerceReceipt>(
      `/b/${encodeURIComponent(token)}/receipts/${encodeURIComponent(receiptId)}`,
      { auth: false, query: { ...proof } },
    );
  }

  /** The buyer has the goods: the money is the seller's. 409 `escrow_not_held` otherwise. */
  confirm(token: string, receiptId: string, proof: ReceiptProof): Promise<EscrowMoveResult> {
    return this.http.request<EscrowMoveResult>(
      `/b/${encodeURIComponent(token)}/receipts/${encodeURIComponent(receiptId)}/confirm`,
      { method: "POST", auth: false, query: { ...proof }, body: {} },
    );
  }

  /** Contest a paid order while its money is held (1 to 280 characters); an operator decides. */
  dispute(
    token: string,
    receiptId: string,
    proof: ReceiptProof,
    reason: string,
  ): Promise<EscrowMoveResult> {
    return this.http.request<EscrowMoveResult>(
      `/b/${encodeURIComponent(token)}/receipts/${encodeURIComponent(receiptId)}/dispute`,
      { method: "POST", auth: false, query: { ...proof }, body: { reason } },
    );
  }
}
