import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useCreateWorkspace } from "@workspace/api-client-react";
import { CheckCircle2, ChevronRight, ChevronLeft, Building2, Rss, Bell, UserPlus, Rocket } from "lucide-react";
import { Button } from "@/components/ui/shared";
import { usePageTitle } from "@/hooks/usePageTitle";
import { toast } from "sonner";
import { useSessionContext } from "@/context/SessionContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "workspace" | "sources" | "alerts" | "invite" | "done";
const STEPS: Step[] = ["workspace", "sources", "alerts", "invite", "done"];

const STEP_META: Record<Step, { title: string; subtitle: string; icon: React.ElementType }> = {
  workspace: {
    title: "Create your workspace",
    subtitle: "A workspace tracks the assets, products, and domains your team monitors.",
    icon: Building2,
  },
  sources: {
    title: "Choose your intel sources",
    subtitle: "Select the types of threat intelligence that matter to your team.",
    icon: Rss,
  },
  alerts: {
    title: "Configure alert preferences",
    subtitle: "Tell CyNews what severity levels and keywords to watch for.",
    icon: Bell,
  },
  invite: {
    title: "Invite your team",
    subtitle: "Add teammates so everyone gets the same threat picture.",
    icon: UserPlus,
  },
  done: {
    title: "You're all set!",
    subtitle: "CyNews is ready. Head to the dashboard to start monitoring.",
    icon: Rocket,
  },
};

const SOURCE_OPTIONS = [
  { id: "cve", label: "CVE / NVD", description: "National Vulnerability Database advisories" },
  { id: "certIn", label: "CERT-In", description: "Indian Computer Emergency Response Team advisories" },
  { id: "threatIntel", label: "Threat Intel", description: "URLhaus, ThreatFox, ransomware groups" },
  { id: "localNews", label: "Local News", description: "Curated India-focused cybersecurity news" },
  { id: "globalNews", label: "Global News", description: "International cybersecurity headlines" },
];

const SEVERITY_OPTIONS = [
  { id: "critical", label: "Critical", color: "text-red-400" },
  { id: "high", label: "High", color: "text-orange-400" },
  { id: "medium", label: "Medium", color: "text-yellow-400" },
  { id: "low", label: "Low", color: "text-blue-400" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Onboarding() {
  usePageTitle("Welcome to CyNews");
  const [, setLocation] = useLocation();
  const { user } = useSessionContext();
  const { mutateAsync: createWorkspace } = useCreateWorkspace();

  const [stepIdx, setStepIdx] = useState(0);
  const currentStep = STEPS[stepIdx]!;

  // Step 1 — workspace
  const [wsName, setWsName] = useState("");
  const [wsDomain, setWsDomain] = useState("");
  const [wsLoading, setWsLoading] = useState(false);

  // Step 2 — sources
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(["cve", "certIn", "localNews"])
  );

  // Step 3 — alerts
  const [selectedSeverities, setSelectedSeverities] = useState<Set<string>>(
    new Set(["critical", "high"])
  );
  const [keywords, setKeywords] = useState("");

  // Step 4 — invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitesSent, setInvitesSent] = useState<string[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);

  // ── Navigation helpers ────────────────────────────────────────────────────

  function advance() {
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function back() {
    setStepIdx((i) => Math.max(i - 1, 0));
  }

  // ── Step handlers ─────────────────────────────────────────────────────────

  async function handleWorkspaceSubmit(e: FormEvent) {
    e.preventDefault();
    setWsLoading(true);
    try {
      await createWorkspace({ data: { name: wsName, domain: wsDomain } });
      advance();
    } catch {
      toast.error("Failed to create workspace. Please try again.");
    } finally {
      setWsLoading(false);
    }
  }

  function toggleSource(id: string) {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSeverity(id: string) {
    setSelectedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSendInvite(e: FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    try {
      // Stub: invite endpoint will be wired in Phase 2
      await new Promise<void>((r) => setTimeout(r, 600));
      setInvitesSent((prev) => [...prev, inviteEmail]);
      setInviteEmail("");
      toast.success(`Invite sent to ${inviteEmail}`);
    } catch {
      toast.error("Failed to send invite.");
    } finally {
      setInviteLoading(false);
    }
  }

  // ── Progress indicator ────────────────────────────────────────────────────

  const progressSteps = STEPS.slice(0, -1); // exclude "done" from progress bar

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground font-medium">
            Welcome{user?.name ? `, ${user.name}` : ""}
          </p>
          <h1 className="text-2xl font-bold">Set up CyNews</h1>
        </div>

        {/* Progress dots */}
        {currentStep !== "done" && (
          <div className="flex items-center justify-center gap-2">
            {progressSteps.map((s, i) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i < stepIdx
                    ? "w-8 bg-primary"
                    : i === stepIdx
                    ? "w-8 bg-primary/70"
                    : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>
        )}

        {/* Step card */}
        <div className="bg-card border border-border rounded-2xl p-7 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Step header */}
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10">
              {(() => {
                const Icon = STEP_META[currentStep].icon;
                return <Icon className="h-5 w-5 text-primary" />;
              })()}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{STEP_META[currentStep].title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{STEP_META[currentStep].subtitle}</p>
            </div>
          </div>

          {/* ── Step 1: Workspace ── */}
          {currentStep === "workspace" && (
            <form onSubmit={handleWorkspaceSubmit} className="space-y-3">
              <input
                type="text"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                placeholder="Workspace name (e.g. ACME Corp)"
                required
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <input
                type="text"
                value={wsDomain}
                onChange={(e) => setWsDomain(e.target.value)}
                placeholder="Primary domain (e.g. acme.com)"
                required
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex justify-end pt-1">
                <Button type="submit" disabled={wsLoading} className="gap-2">
                  {wsLoading ? "Creating…" : "Continue"}
                  {!wsLoading && <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          )}

          {/* ── Step 2: Sources ── */}
          {currentStep === "sources" && (
            <div className="space-y-4">
              <div className="space-y-2">
                {SOURCE_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSources.has(opt.id)}
                      onChange={() => toggleSource(opt.id)}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                    {selectedSources.has(opt.id) && (
                      <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0 mt-0.5" />
                    )}
                  </label>
                ))}
              </div>
              <NavButtons onBack={back} onNext={advance} />
            </div>
          )}

          {/* ── Step 3: Alert preferences ── */}
          {currentStep === "alerts" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Notify me for severity
                </p>
                <div className="flex flex-wrap gap-2">
                  {SEVERITY_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSeverity(s.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        selectedSeverities.has(s.id)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted/30"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                  Keyword watch list <span className="font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g. apache, log4j, ransomware"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated. Alerts fire when any keyword matches.</p>
              </div>
              <NavButtons onBack={back} onNext={advance} />
            </div>
          )}

          {/* ── Step 4: Invite ── */}
          {currentStep === "invite" && (
            <div className="space-y-4">
              {invitesSent.length > 0 && (
                <div className="space-y-1">
                  {invitesSent.map((e) => (
                    <div key={e} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                      {e}
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleSendInvite} className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <Button type="submit" disabled={inviteLoading || !inviteEmail}>
                  {inviteLoading ? "Sending…" : "Invite"}
                </Button>
              </form>
              <NavButtons
                onBack={back}
                onNext={advance}
                nextLabel="Skip for now"
                nextVariant="ghost"
              />
            </div>
          )}

          {/* ── Step 5: Done ── */}
          {currentStep === "done" && (
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-primary/10">
                  <CheckCircle2 className="h-10 w-10 text-primary" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Your workspace is live. CyNews is now monitoring{" "}
                <strong>{selectedSources.size} source{selectedSources.size !== 1 ? "s" : ""}</strong> and will
                alert you on <strong>{selectedSeverities.size} severity level{selectedSeverities.size !== 1 ? "s" : ""}</strong>.
              </p>
              <Button className="w-full gap-2" onClick={() => setLocation("/")}>
                Go to Dashboard
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav buttons sub-component
// ---------------------------------------------------------------------------

function NavButtons({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextVariant = "default",
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextVariant?: "default" | "ghost" | "outline";
}) {
  return (
    <div className="flex justify-between pt-1">
      <Button type="button" variant="ghost" onClick={onBack} className="gap-1">
        <ChevronLeft className="h-4 w-4" /> Back
      </Button>
      <Button type="button" variant={nextVariant} onClick={onNext} className="gap-1">
        {nextLabel} {nextVariant !== "ghost" && <ChevronRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}
