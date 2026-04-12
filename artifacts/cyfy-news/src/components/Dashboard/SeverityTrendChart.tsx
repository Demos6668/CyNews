import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/shared";
import { Skeleton } from "@/components/ui/shared";

interface TrendDay {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const apiBase = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

function useSeverityTrend() {
  return useQuery<{ days: TrendDay[] }>({
    queryKey: ["severity-trend"],
    queryFn: () => fetch(`${apiBase}/dashboard/severity-trend`).then((r) => r.json()),
    staleTime: 5 * 60_000,
  });
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

export function SeverityTrendChart() {
  const { data, isLoading } = useSeverityTrend();

  if (isLoading) return <Skeleton className="h-56 w-full" />;
  if (!data?.days.length) return null;

  const chartData = data.days.map((d) => ({ ...d, date: formatDay(d.date) }));
  const total = data.days.reduce((sum, d) => sum + d.critical + d.high + d.medium + d.low, 0);
  if (total === 0) return null;

  return (
    <Card className="glass-panel">
      <div className="p-6 border-b border-white/5 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="font-bold">Severity Trend (7 days)</h3>
      </div>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="critGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F44336" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#F44336" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="highGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFB74B" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#FFB74B" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="medGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0095AF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0095AF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
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
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />
            <Area type="monotone" dataKey="critical" stroke="#F44336" fill="url(#critGrad)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="high" stroke="#FFB74B" fill="url(#highGrad)" strokeWidth={1.5} />
            <Area type="monotone" dataKey="medium" stroke="#0095AF" fill="url(#medGrad)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
