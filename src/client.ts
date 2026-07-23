import { AuthClient } from "./auth.js";
import { AnalyticsClient } from "./analytics.js";
import { BoboClient } from "./bobo.js";
import { CatalogClient } from "./catalog.js";
import { DeliveryClient } from "./delivery.js";
import { LiveSessionsClient } from "./live-sessions.js";
import { getEngineApiUrl, type EngineRuntimeEnv } from "./env.js";
import { HarnessClient } from "./harness.js";
import { EngineHttpClient, type FetchLike } from "./http.js";
import { NotificationsClient } from "./notifications.js";
import { OrdersClient } from "./orders.js";
import { ProductsClient } from "./products.js";
import { SearchClient } from "./search.js";
import { SocialClient } from "./social.js";

export interface YaatalClientOptions {
  baseUrl?: string;
  token?: string;
  fetch?: FetchLike;
  headers?: HeadersInit;
  env?: EngineRuntimeEnv;
}

export class YaatalClient {
  readonly analytics: AnalyticsClient;
  readonly auth: AuthClient;
  readonly bobo: BoboClient;
  readonly catalog: CatalogClient;
  readonly delivery: DeliveryClient;
  readonly harness: HarnessClient;
  readonly liveSessions: LiveSessionsClient;
  readonly notifications: NotificationsClient;
  readonly products: ProductsClient;
  readonly orders: OrdersClient;
  readonly search: SearchClient;
  readonly social: SocialClient;

  private readonly http: EngineHttpClient;

  constructor(options: YaatalClientOptions = {}) {
    const httpOptions = {
      baseUrl: options.baseUrl ?? getEngineApiUrl(options.env),
    };

    this.http = new EngineHttpClient({
      ...httpOptions,
      ...(options.token === undefined ? {} : { token: options.token }),
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      ...(options.headers === undefined ? {} : { headers: options.headers }),
    });

    this.analytics = new AnalyticsClient(this.http);
    this.auth = new AuthClient(this.http);
    this.bobo = new BoboClient(this.http);
    this.catalog = new CatalogClient(this.http);
    this.delivery = new DeliveryClient(this.http);
    this.harness = new HarnessClient(this.http);
    this.liveSessions = new LiveSessionsClient(this.http);
    this.notifications = new NotificationsClient(this.http);
    this.products = new ProductsClient(this.http);
    this.orders = new OrdersClient(this.http);
    this.search = new SearchClient(this.http);
    this.social = new SocialClient(this.http);
  }

  setToken(token: string): void {
    this.http.setToken(token);
  }

  clearToken(): void {
    this.http.clearToken();
  }
}

export function createYaatalClient(
  options: YaatalClientOptions = {},
): YaatalClient {
  return new YaatalClient(options);
}
