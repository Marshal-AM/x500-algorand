"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Wallet } from "lucide-react";
import { formatMicroUsdc, indexerBase } from "@/lib/indexer";
import {
  fetchRegistryAppId,
  submitEndpointWithWallet,
} from "@/lib/algorand-wallet";
import {
  parseUsdcToMicroUsdc,
  preflightSlug,
  preflightSubmit,
  validateContactAddress,
  validateHostname,
  validateSlugFormat,
  type SlugPreflight,
} from "@/lib/merchant-preflight";
import { appToast } from "@/lib/toast";
import { humanizeAlgorandError } from "@/lib/algorand-errors";
import { useAlgorandWallet } from "@/components/useAlgorandWallet";
import { InlineCode } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";
import { Field, FieldDescription, FieldLabel, Input } from "@/components/ui/Field";
import { DetailList, DetailRow } from "@/components/ui/DetailList";
import { StepFormLayout } from "@/components/ui/StepFormLayout";
import { StepFormNav } from "@/components/ui/StepFormNav";
import { StepFormProgress } from "@/components/ui/StepFormProgress";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const DEFAULT_PROXY =
  process.env.NEXT_PUBLIC_MARKET_PROXY_URL?.trim() ||
  "https://market-proxy-production.up.railway.app";

const STEPS = ["Wallet", "API", "Terms", "Review"] as const;

interface RegisterResult {
  ok: boolean;
  slug?: string;
  hostname?: string;
  api_price_micro_usdc?: string;
  transactionId?: string | null;
  alreadyRegistered?: boolean;
  proxyPath?: string;
  ownerAddress?: string;
  error?: string;
  warning?: string;
  slaMs?: number;
}

function slugBadgeVariant(
  status: SlugPreflight["status"],
): "success" | "warning" | "destructive" | "muted" {
  switch (status) {
    case "available":
      return "success";
    case "owned_by_you":
      return "warning";
    case "taken":
    case "reserved":
    case "invalid":
      return "destructive";
    default:
      return "muted";
  }
}

function slugBadgeLabel(status: SlugPreflight["status"]): string {
  switch (status) {
    case "available":
      return "Available";
    case "owned_by_you":
      return "Yours";
    case "taken":
      return "Taken";
    case "reserved":
      return "Reserved";
    case "invalid":
      return "Invalid";
    default:
      return "—";
  }
}

function SlugStatus({ preflight }: { preflight: SlugPreflight | null }) {
  if (!preflight) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={slugBadgeVariant(preflight.status)}>
          {slugBadgeLabel(preflight.status)}
        </Badge>
        {preflight.mode === "update" && preflight.canProceed ? (
          <span className="text-sm text-muted-foreground">Will update</span>
        ) : null}
      </div>
      <p
        className={
          preflight.canProceed
            ? "text-sm text-muted-foreground"
            : "text-sm text-destructive"
        }
      >
        {preflight.message}
      </p>
      {preflight.endpoint?.hostname && preflight.status === "owned_by_you" ? (
        <p className="text-sm text-muted-foreground">
          Current origin:{" "}
          <InlineCode>{preflight.endpoint.hostname}</InlineCode>
        </p>
      ) : null}
    </div>
  );
}

export function MerchantRegisterForm() {
  const {
    session,
    wallets,
    connect,
    disconnect,
    connecting,
    connectingId,
    ready,
    transactionSigner,
  } = useAlgorandWallet();
  const [step, setStep] = useState(0);
  const [slug, setSlug] = useState("");
  const [hostname, setHostname] = useState("");
  const [apiPriceUsdc, setApiPriceUsdc] = useState("0.01");
  const [slaSeconds, setSlaSeconds] = useState("30");
  const [contactAddress, setContactAddress] = useState("");
  const [registryAppId, setRegistryAppId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugPreflight, setSlugPreflight] = useState<SlugPreflight | null>(
    null,
  );

  useEffect(() => {
    void fetchRegistryAppId()
      .then(setRegistryAppId)
      .catch((err) => {
        appToast.error("Could not load registry", err);
      });
  }, []);

  useEffect(() => {
    if (session?.address && !contactAddress) {
      setContactAddress(session.address);
    }
  }, [session?.address, contactAddress]);

  useEffect(() => {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) {
      setSlugPreflight(null);
      setSlugChecking(false);
      return;
    }

    const formatError = validateSlugFormat(slug);
    if (formatError) {
      setSlugPreflight({
        normalizedSlug: normalized,
        mode: "register",
        canProceed: false,
        status: "invalid",
        message: formatError,
      });
      setSlugChecking(false);
      return;
    }

    let cancelled = false;
    setSlugChecking(true);

    const timer = window.setTimeout(() => {
      void preflightSlug(slug, session?.address ?? null)
        .then((check) => {
          if (!cancelled) setSlugPreflight(check);
        })
        .catch(() => {
          if (!cancelled) {
            setSlugPreflight({
              normalizedSlug: normalized,
              mode: "register",
              canProceed: false,
              status: "invalid",
              message: "Could not check slug availability.",
            });
            appToast.error(
              "Registry check failed",
              "Verify your connection and try again.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setSlugChecking(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug, session?.address]);

  async function validateStep(current: number): Promise<boolean> {
    if (current === 0) {
      if (!session?.address) {
        appToast.error(
          "Wallet required",
          "Connect Pera, Defly, or Lute to continue.",
        );
        return false;
      }
      if (!registryAppId) {
        appToast.warning("Loading registry", {
          description: "Please wait a moment.",
        });
        return false;
      }
    }
    if (current === 1) {
      const slugError = validateSlugFormat(slug);
      if (slugError) {
        appToast.error("Invalid slug", slugError);
        return false;
      }

      const host = validateHostname(hostname);
      if (host.error) {
        appToast.error("Invalid origin URL", host.error);
        return false;
      }

      const check = await preflightSlug(slug, session?.address ?? null);
      setSlugPreflight(check);
      if (!check.canProceed) {
        appToast.error("Slug unavailable", check.message);
        return false;
      }
    }
    if (current === 2) {
      const normalizedSlaMs = Math.max(1, Math.floor(Number(slaSeconds) * 1000));
      if (!Number.isFinite(normalizedSlaMs)) {
        appToast.error("Invalid SLA", "Enter a valid response time in seconds.");
        return false;
      }
      const contactError = validateContactAddress(contactAddress);
      if (contactError) {
        appToast.error("Invalid payment address", contactError);
        return false;
      }
      try {
        parseUsdcToMicroUsdc(apiPriceUsdc);
      } catch (err) {
        appToast.error("Invalid price", err);
        return false;
      }
    }
    return true;
  }

  async function handleNext() {
    const ok = await validateStep(step);
    if (!ok) return;
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    void handleSubmit();
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    if (!session?.address || !registryAppId || !transactionSigner) return;

    setLoading(true);
    setResult(null);

    try {
      const preflight = await preflightSubmit({
        slug,
        hostname,
        apiPriceUsdc,
        slaSeconds,
        contactAddress,
        walletAddress: session.address,
      });

      if (!preflight.ok || !preflight.mode) {
        appToast.error(
          "Could not submit",
          preflight.error ?? "Review your details and try again.",
        );
        return;
      }

      const { transactionId, updated } = await submitEndpointWithWallet({
        mode: preflight.mode,
        session,
        registryAppId,
        slug: preflight.normalizedSlug!,
        hostname: preflight.normalizedHost!,
        apiPriceMicroUsdc: BigInt(preflight.apiPriceMicroUsdc!),
        contactAddress: preflight.contactAddress!,
        slaLatencyMs: preflight.slaMs,
        transactionSigner,
      });

      const res = await fetch(`${indexerBase()}/api/merchants/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: preflight.normalizedSlug,
          hostname: preflight.normalizedHost,
          transactionId,
          slaMs: preflight.slaMs,
        }),
      });
      const body = (await res.json()) as RegisterResult & { error?: string };

      if (!res.ok) {
        const warning =
          body.error ?? "Indexer sync is delayed. Your on-chain update succeeded.";
        appToast.warning("Listed on-chain", warning);
        setResult({
          ok: true,
          slug: preflight.normalizedSlug,
          hostname: preflight.normalizedHost,
          api_price_micro_usdc: preflight.apiPriceMicroUsdc,
          transactionId,
          alreadyRegistered: updated,
          warning,
          slaMs: preflight.slaMs,
        });
        return;
      }

      appToast.success(
        updated ? "Endpoint updated" : "API registered",
        updated
          ? "Your listing was updated on testnet."
          : "Your API is live on the x500 registry.",
      );
      setResult({ ...body, alreadyRegistered: updated || body.alreadyRegistered });
    } catch (err) {
      appToast.error("Transaction failed", humanizeAlgorandError(err));
    } finally {
      setLoading(false);
    }
  }

  const proxyPath =
    result?.proxyPath ??
    `${DEFAULT_PROXY.replace(/\/$/, "")}/v1/${slug || "your-slug"}/`;

  const submitLabel =
    slugPreflight?.mode === "update" && slugPreflight.canProceed
      ? "Update on testnet"
      : "Register on testnet";

  if (result?.ok) {
    return (
      <div className="space-y-5">
        <Card className="gap-3 border-success/25 bg-success/5 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                {result.alreadyRegistered
                  ? "Endpoint updated"
                  : "Registration complete"}
              </p>
              <p className="text-sm text-muted-foreground">
                {result.alreadyRegistered
                  ? "Your on-chain configuration is up to date."
                  : "Agents can now discover and call your API."}
              </p>
            </div>
          </div>
        </Card>

        <Card className="gap-1 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Summary
          </p>
          <DetailList>
            <DetailRow term="Slug" value={result.slug ?? "—"} />
            <DetailRow term="Origin" value={result.hostname ?? "—"} />
            {result.api_price_micro_usdc ? (
              <DetailRow
                term="Price"
                value={`${formatMicroUsdc(result.api_price_micro_usdc)} USDC / call`}
              />
            ) : null}
            {result.transactionId ? (
              <DetailRow term="Transaction" value={result.transactionId} mono />
            ) : null}
            <DetailRow
              term="Agent URL"
              value={<InlineCode>{proxyPath}your/path</InlineCode>}
            />
          </DetailList>
        </Card>
      </div>
    );
  }

  return (
    <StepFormLayout fitParent className="space-y-5">
      <StepFormProgress steps={[...STEPS]} currentStep={step} />

      {step === 0 && (
        <div className="step-form-panel space-y-5">
          <div className="flex items-start gap-4 rounded-2xl border border-border bg-muted/20 p-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Connect your wallet
              </p>
              <p className="text-sm text-muted-foreground">
                Sign once to register or update your API on testnet.
              </p>
            </div>
          </div>

          {session ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="size-4" />
                Connected as <InlineCode>{session.address}</InlineCode>
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void disconnect()}
                className="w-full"
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="grid gap-2">
              {wallets.map((wallet) => (
                <Button
                  key={wallet.id}
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full justify-start"
                  onClick={() => void connect(wallet.id)}
                  disabled={!ready || connecting}
                >
                  {wallet.metadata.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={wallet.metadata.icon}
                      alt=""
                      className="size-5 rounded-sm"
                    />
                  ) : null}
                  {connectingId === wallet.id
                    ? "Connecting…"
                    : `Connect ${wallet.metadata.name}`}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="step-form-panel space-y-5">
          <Field>
            <FieldLabel htmlFor="slug">API slug</FieldLabel>
            <Input
              id="slug"
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-api"
              required
              maxLength={16}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={
                slugPreflight != null && !slugPreflight.canProceed
                  ? true
                  : undefined
              }
            />
            <FieldDescription>
              Short name agents use to find your API. Checked against the
              registry before you sign.
            </FieldDescription>
            {slugChecking ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <LoadingSpinner className="size-3.5" />
                Checking availability…
              </p>
            ) : (
              <SlugStatus preflight={slugPreflight} />
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="hostname">Origin URL</FieldLabel>
            <Input
              id="hostname"
              name="hostname"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="https://api.example.com"
              required
              type="url"
            />
            <FieldDescription>
              Public base URL for your server. If your tunnel URL changed, reuse
              your existing slug to update it.
            </FieldDescription>
          </Field>
        </div>
      )}

      {step === 2 && (
        <div className="step-form-panel space-y-5">
          <Field>
            <FieldLabel htmlFor="sla">Response time limit</FieldLabel>
            <Input
              id="sla"
              name="sla"
              value={slaSeconds}
              onChange={(e) => setSlaSeconds(e.target.value)}
              placeholder="30"
              required
              inputMode="numeric"
            />
            <FieldDescription>
              Calls slower than this may be treated as breaches. Use 30–60s for
              public or tunnelled servers.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="apiPrice">Price per call (USDC)</FieldLabel>
            <Input
              id="apiPrice"
              name="apiPrice"
              value={apiPriceUsdc}
              onChange={(e) => setApiPriceUsdc(e.target.value)}
              placeholder="0.01"
              required
              inputMode="decimal"
            />
            <FieldDescription>
              Charged per paid request. Insurance premium uses the platform
              default.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="contact">Payment address</FieldLabel>
            <Input
              id="contact"
              name="contact"
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              placeholder="ABCDEF...58charAlgorandAddress"
              required
              spellCheck={false}
              autoComplete="off"
            />
            <FieldDescription>
              Receives API payments. Defaults to your connected wallet.
            </FieldDescription>
          </Field>
        </div>
      )}

      {step === 3 && (
        <Card className="step-form-panel gap-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Review
          </p>
          <DetailList>
            <DetailRow
              term="Action"
              value={
                slugPreflight?.mode === "update"
                  ? "Update listing"
                  : "New registration"
              }
            />
            <DetailRow
              term="Wallet"
              value={session?.address ?? "—"}
              mono
            />
            <DetailRow term="Slug" value={slug.trim().toLowerCase() || "—"} />
            <DetailRow term="Origin" value={hostname.trim() || "—"} />
            <DetailRow term="Response limit" value={`${slaSeconds}s`} />
            <DetailRow term="Price" value={`${apiPriceUsdc} USDC`} />
            <DetailRow term="Payments to" value={contactAddress || "—"} mono />
          </DetailList>
          <p className="text-sm text-muted-foreground">
            {slugPreflight?.status === "owned_by_you"
              ? "This updates your existing listing — no duplicate registration."
              : "Confirm in your wallet to publish on testnet."}
          </p>
        </Card>
      )}

      <StepFormNav
        onBack={step > 0 ? handleBack : undefined}
        onNext={() => void handleNext()}
        nextLabel={step < STEPS.length - 1 ? "Continue" : submitLabel}
        isLastStep={step === STEPS.length - 1}
        busy={loading || (step === 1 && slugChecking)}
        nextDisabled={
          step === 1 &&
          (slugChecking ||
            (slugPreflight != null && !slugPreflight.canProceed && !!slug.trim()))
        }
      />

      {step === STEPS.length - 1 && loading ? (
        <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
          <LoadingSpinner className="size-3.5" />
          Waiting for wallet approval…
        </p>
      ) : null}
    </StepFormLayout>
  );
}
