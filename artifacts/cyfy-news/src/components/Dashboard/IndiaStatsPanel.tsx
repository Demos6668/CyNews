import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/shared";
import type { DashboardStats } from "@workspace/api-client-react";

interface IndiaStatsPanelProps {
  stats: DashboardStats;
}

const SECTOR_COLORS = ["#0095AF", "#FFB74B", "#F44336", "#4CAF50", "#9C27B0", "#FF5722"];

export function IndiaStatsPanel({ stats }: IndiaStatsPanelProps) {
  const indiaStats = stats.indiaStats;
  if (!indiaStats) return null;

  const byState = (indiaStats.byState ?? [])
    .filter((r): r is { state: string; count: number } => !!r.state && typeof r.count === "number")
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const bySector = (indiaStats.bySector ?? [])
    .filter((r): r is { sector: string; count: number } => !!r.sector && typeof r.count === "number")
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  if (byState.length === 0 && bySector.length === 0) return null;

  return (
    <Card className="glass-panel">
      <div className="p-6 border-b border-white/5 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <h3 className="font-bold">India Threat Breakdown</h3>
      </div>
      <CardContent className="p-6 space-y-6">
        {byState.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">By State</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={byState} layout="vertical" margin={{ left: 8, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="state"
                  width={90}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#161B22",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: "#fff" }}
                />
                <Bar dataKey="count" fill="#0095AF" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {bySector.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">By Sector</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={bySector} layout="vertical" margin={{ left: 8, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="sector"
                  width={90}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#161B22",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                  itemStyle={{ color: "#fff" }}
                />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {bySector.map((_, i) => (
                    <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
