import { x402Client, x402HTTPClient } from "@x402/core/client";

/**
 * Wrap fetch to handle x402 402 → pay → retry (matches @x402/core 2.12 HTTP client).
 */
export function wrapFetchWithPayment(
  fetchImpl: typeof fetch,
  client: x402Client,
): (input: string | URL | Request, init?: RequestInit) => Promise<Response> {
  const httpClient =
    client instanceof x402HTTPClient ? client : new x402HTTPClient(client);

  return async (input, init) => {
    const request = new Request(input, init);
    const clonedRequest = request.clone();
    const response = await fetchImpl(request);

    if (response.status !== 402) {
      return response;
    }

    let paymentRequired;
    try {
      const getHeader = (name: string) => response.headers.get(name);
      let body: unknown;
      try {
        const responseText = await response.text();
        if (responseText) {
          body = JSON.parse(responseText);
        }
      } catch {
        // body optional for v2 PAYMENT-REQUIRED header
      }
      paymentRequired = httpClient.getPaymentRequiredResponse(getHeader, body);
    } catch (error) {
      throw new Error(
        `Failed to parse payment requirements: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    const hookHeaders = await httpClient.handlePaymentRequired(paymentRequired);
    if (hookHeaders) {
      const hookRequest = clonedRequest.clone();
      for (const [key, value] of Object.entries(hookHeaders)) {
        hookRequest.headers.set(key, value);
      }
      const hookResponse = await fetchImpl(hookRequest);
      if (hookResponse.status !== 402) {
        return hookResponse;
      }
    }

    let paymentPayload;
    try {
      paymentPayload = await client.createPaymentPayload(paymentRequired);
    } catch (error) {
      throw new Error(
        `Failed to create payment payload: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
    if (
      clonedRequest.headers.has("PAYMENT-SIGNATURE") ||
      clonedRequest.headers.has("X-PAYMENT")
    ) {
      throw new Error("Payment already attempted");
    }

    for (const [key, value] of Object.entries(paymentHeaders)) {
      clonedRequest.headers.set(key, value);
    }
    clonedRequest.headers.set(
      "Access-Control-Expose-Headers",
      "PAYMENT-RESPONSE,X-PAYMENT-RESPONSE",
    );

    return fetchImpl(clonedRequest);
  };
}
