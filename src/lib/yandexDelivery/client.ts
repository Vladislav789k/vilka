type YandexApiError = {
  code?: string;
  message?: string;
};

export type YandexOfferCalculateRequest = {
  items: Array<{
    size?: { length: number; width: number; height: number };
    weight?: number;
    quantity: number;
    pickup_point?: number;
    dropoff_point?: number;
  }>;
  route_points: Array<{
    id: number;
    coordinates: [number, number]; // [lon, lat]
    fullname: string;
    country?: string;
    city?: string;
    street?: string;
    building?: string;
    porch?: string;
    sfloor?: string;
    sflat?: string;
  }>;
  requirements?: {
    taxi_classes: Array<"courier" | "express" | "cargo">;
    cargo_options?: Array<"auto_courier" | "thermobag">;
    pro_courier?: boolean;
    skip_door_to_door?: boolean;
    due?: string;
    rental_duration?: number;
    cargo_loaders?: 0 | 1 | 2;
    cargo_type?: "van" | "lcv_m" | "lcv_l" | "lcv_xl";
  };
};

export type YandexOfferCalculateResponse = {
  offers: Array<{
    taxi_class: "courier" | "express" | "cargo";
    description?: string;
    // NOTE: Some accounts/contracts receive extra details (not documented in OfferCalculate),
    // but they are useful for ETA display and debugging (e.g. walking_courier).
    eta?: number; // minutes (if present)
    tariff_info?: {
      title?: string;
      tariff?: string;
      vertical?: string;
      surge_limit?: string;
      tariff_extra_info?: {
        total_route_time_seconds?: number;
        source_point_free_waiting_time_seconds?: number;
        destination_point_free_waiting_time_seconds?: number;
        source_point_waiting_price_per_minute?: string;
        destination_point_waiting_price_per_minute?: string;
      };
    };
    payload: string;
    offer_ttl: string;
    price: {
      currency: string;
      surge_ratio?: number;
      total_price: string;
      total_price_with_vat?: string;
      base_price?: string;
    };
    pickup_interval: { from: string; to: string };
    delivery_interval: { from: string; to: string };
  }>;
};

export type YandexClaimsCreateRequest = {
  // Claim kind is used by Yandex Eats to select supply type:
  // - platform_usage: assign Eats couriers
  // - delivery_service: assign Taxi drivers/couriers
  claim_kind?: "platform_usage" | "delivery_service";
  items: Array<{
    extra_id?: string;
    pickup_point: number;
    dropoff_point: number;
    title: string;
    size?: { length: number; width: number; height: number };
    weight?: number;
    cost_value?: string;
    cost_currency?: string;
    quantity: number;
    age_restricted?: boolean;
  }>;
  route_points: Array<{
    point_id: number;
    visit_order: number;
    type: "source" | "destination";
    contact: {
      name: string;
      phone: string;
      email?: string;
      phone_additional_code?: string;
    };
    address: {
      fullname: string;
      coordinates: [number, number]; // [lon, lat]
      city?: string;
      country?: string;
      comment?: string;
      porch?: string;
      sfloor?: string;
      sflat?: string;
      door_code?: string;
      door_code_extra?: string;
    };
    external_order_id?: string;
    leave_under_door?: boolean;
    meet_outside?: boolean;
    no_door_call?: boolean;
    skip_confirmation?: boolean;
  }>;
  client_requirements?: {
    taxi_class: "courier" | "express" | "cargo";
    cargo_options?: Array<"auto_courier" | "thermobag">;
    pro_courier?: boolean;
    rental_duration?: number;
    cargo_loaders?: 0 | 1 | 2;
    cargo_type?: "van" | "lcv_m" | "lcv_l" | "lcv_xl";
  };
  offer_payload?: string;
  comment?: string;
  due?: string;
};

export type YandexClaimsCreateResponse = {
  id: string;
  status: string;
  version: number;
  updated_ts?: string;
  created_ts?: string;
  eta?: number; // minutes
  pricing?: unknown;
};

const BASE_URL = "https://b2b.taxi.yandex.net";

async function yandexFetch<T>(path: string, init: RequestInit): Promise<T> {
  const token = process.env.YANDEX_DELIVERY_TOKEN;
  if (!token) {
    throw new Error("YANDEX_DELIVERY_TOKEN is not set");
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": "ru",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const isRecord = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v != null && !Array.isArray(v);
    const err: YandexApiError = isRecord(json)
      ? {
          code: typeof json.code === "string" ? json.code : undefined,
          message: typeof json.message === "string" ? json.message : undefined,
        }
      : {};

    const code = err.code ? ` (${err.code})` : "";
    const msg = err.message || `Yandex Delivery API error: HTTP ${res.status}`;
    throw new Error(`${msg}${code}`);
  }

  return (json ?? {}) as T;
}

export async function calculateOffers(
  body: YandexOfferCalculateRequest
): Promise<YandexOfferCalculateResponse> {
  return await yandexFetch<YandexOfferCalculateResponse>(
    "/b2b/cargo/integration/v2/offers/calculate",
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function createClaim(opts: {
  requestId: string;
  body: YandexClaimsCreateRequest;
}): Promise<YandexClaimsCreateResponse> {
  const { requestId, body } = opts;
  const qs = requestId ? `?request_id=${encodeURIComponent(requestId)}` : "";
  return await yandexFetch<YandexClaimsCreateResponse>(
    `/b2b/cargo/integration/v2/claims/create${qs}`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function acceptClaim(opts: {
  claimId: string;
  version: number;
}): Promise<{ id: string; status: string; version: number }> {
  const { claimId, version } = opts;
  const qs = `?claim_id=${encodeURIComponent(claimId)}`;
  return await yandexFetch<{ id: string; status: string; version: number }>(
    `/b2b/cargo/integration/v2/claims/accept${qs}`,
    { method: "POST", body: JSON.stringify({ version }) }
  );
}

export async function getClaimInfo(opts: { claimId: string }): Promise<unknown> {
  const { claimId } = opts;
  const qs = `?claim_id=${encodeURIComponent(claimId)}`;
  return await yandexFetch<unknown>(`/b2b/cargo/integration/v2/claims/info${qs}`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

