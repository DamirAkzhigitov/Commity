import { getSubscriptionResponseSchema, type GetSubscriptionResponse } from '@personal-assistant/shared';
import { normalizeApiBaseUrl } from './assistant-chat-wiring';

export class BillingApiError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(`Billing API error (${status})`);
    this.name = 'BillingApiError';
  }
}

export async function fetchBillingEntitlement(
  apiBaseUrl: string,
  accessToken: string,
): Promise<GetSubscriptionResponse> {
  const url = `${normalizeApiBaseUrl(apiBaseUrl)}/billing/entitlement`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw new BillingApiError(res.status, text);
  }
  return getSubscriptionResponseSchema.parse(json);
}
