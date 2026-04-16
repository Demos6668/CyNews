import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { CreditCard, CheckCircle2, AlertCircle, Zap, Users, Building2, ChevronRight, ExternalLink } from "lucide-react";
import { Card, CardContent, Button } from "@/components/ui/shared";
import { Loader } from "@/components/Common";
import { usePageTitle } from "@/hooks/usePageTitle";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types matching GET /api/billing/status response
// ---------------------------------------------------------------------------

interface PlanLimits {
  seats: number;
  workspaces: number;
  alertRules: number;
  apiKeys: number;
  savedViews: number;
  dataRetentionDays: number;
  searchResultsMax: number;
}

interface BillingStatus {
  plan: "free" | "pro" | "team" | "enterprise";
  limits: PlanLimits;
  stripeConfigured: boolean;
}

// ---------------------------------------------------------------------------
// Plan metadata (display only)
// ---------------------------------------------------------------------------

const PLAN_META: Record<
  string,
  { label: string; color: string; badge: string; description: string }
> = {
  free: {
    label: "Free",
    color: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
    description: "For individuals and small teams exploring CyNews.",
  },
  pro: {
    label: "Pro",
    color: "text-blue-400",
    badge: "bg-blue-500/15 text-blue-400",
    description: "For security analysts who need full search, saved views, and API access.",
  },
  team: {
    label: "Team",
    color: "text-purple-400",
    badge: "bg-purple-500/15 text-purple-400",
    description: "For SOC teams with unlimited seats, advanced alert rules, and audit logs.",
  },
  enterprise: {
    label: "Enterprise",
    color: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-400",
    description: "Custom deployment, SLA, on-prem option, and dedicated support.",
  },
};

const UPGRADE_PLANS = [
  {
    tier: "pro" as const,
    price: "$29/mo",
    highlights: ["Unlimited search results", "10 workspaces", "Saved views", "API access", "10 alert rules"],
  },
  {
    tier: "team" as const,
    price: "$99/mo",
    highlights: ["Unlimited seats", "Unlimited workspaces", "Audit log", "25 alert rules", "Priority support"],
  },
];

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchBillingStatus(): Promise<BillingStatus> {
  const res = await fetch("/api/billing/status", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load billing status");
  return res.json() as Promise<BillingStatus>;
}

async function createCheckoutSession(plan: "pro" | "team"): Promise<string> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Checkout failed");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

async function createPortalSession(): Promise<string> {
  const res = await fetch("/api/billing/portal", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Portal unavailable");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BillingSettings() {
  usePageTitle("Billing");
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const checkoutResult = new URLSearchParams(searchString).get("checkout");
  const [checkoutTier, setCheckoutTier] = useState<"pro" | "team" | null>(null);

  const { data: billing, isLoading, error } = useQuery({
    queryKey: ["billing", "status"],
    queryFn: fetchBillingStatus,
    retry: 1,
  });

  const portalMutation = useMutation({
    mutationFn: createPortalSession,
    onSuccess: (url) => { window.location.href = url; },
    onError: (err: Error) => { toast.error(err.message); },
  });

  const checkoutMutation = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: (url) => { window.location.href = url; },
    onError: (err: Error) => {
      toast.error(err.message);
      setCheckoutTier(null);
    },
  });

  function handleUpgrade(tier: "pro" | "team") {
    setCheckoutTier(tier);
    checkoutMutation.mutate(tier);
  }

  // ── Loading / error states ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader size="lg" />
      </div>
    );
  }

  if (error || !billing) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-muted-foreground">Could not load billing information.</p>
        <Button variant="outline" onClick={() => setLocation("/")}>Go to Dashboard</Button>
      </div>
    );
  }

  const meta = PLAN_META[billing.plan] ?? PLAN_META.free;
  const isPaidPlan = billing.plan !== "free";

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing &amp; Plan</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and usage limits.</p>
      </div>

      {/* Checkout result banner */}
      {checkoutResult === "success" && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-green-500/30 bg-green-500/10">
          <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
          <p className="text-sm text-green-300">
            Payment successful — your plan has been upgraded. It may take a moment to reflect.
          </p>
        </div>
      )}
      {checkoutResult === "cancelled" && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-muted bg-muted/10">
          <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">Checkout was cancelled. No changes were made.</p>
        </div>
      )}

      {/* Current plan card */}
      <Card className="bg-card/50">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Current Plan</h2>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badge}`}>
            {meta.label}
          </span>
        </div>
        <CardContent className="p-6 space-y-5">
          <p className="text-sm text-muted-foreground">{meta.description}</p>

          {/* Limit summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <LimitItem icon={Users} label="Seats" value={billing.limits.seats === 999999 ? "Unlimited" : String(billing.limits.seats)} />
            <LimitItem icon={Building2} label="Workspaces" value={billing.limits.workspaces === 999999 ? "Unlimited" : String(billing.limits.workspaces)} />
            <LimitItem icon={Zap} label="Alert rules" value={billing.limits.alertRules === 0 ? "Unavailable" : String(billing.limits.alertRules)} />
          </div>

          {/* Manage billing / portal button */}
          {isPaidPlan && billing.stripeConfigured && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
            >
              {portalMutation.isPending ? (
                <Loader size="sm" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Manage Billing
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Upgrade CTAs — show only when not enterprise */}
      {billing.plan !== "enterprise" && billing.stripeConfigured && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Upgrade your plan</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {UPGRADE_PLANS.filter((p) => p.tier !== billing.plan).map((plan) => {
              const planMeta = PLAN_META[plan.tier]!;
              const isLoading = checkoutMutation.isPending && checkoutTier === plan.tier;
              return (
                <Card key={plan.tier} className="bg-card/50 hover:bg-card/80 transition-colors">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${planMeta.badge}`}>
                        {planMeta.label}
                      </span>
                      <span className="text-lg font-bold">{plan.price}</span>
                    </div>
                    <ul className="space-y-1.5">
                      {plan.highlights.map((h) => (
                        <li key={h} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                          {h}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full gap-2"
                      onClick={() => handleUpgrade(plan.tier)}
                      disabled={checkoutMutation.isPending}
                    >
                      {isLoading ? <Loader size="sm" /> : <ChevronRight className="h-4 w-4" />}
                      Upgrade to {planMeta.label}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Enterprise CTA */}
      {billing.plan !== "enterprise" && (
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-amber-300">Need Enterprise?</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                On-prem deployment, custom SLA, SSO, and dedicated support.
              </p>
            </div>
            <Button variant="outline" className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 shrink-0">
              Contact Sales
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper component
// ---------------------------------------------------------------------------

function LimitItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/20">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
