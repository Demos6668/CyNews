import { useGetDashboardStats, useGetNews } from "@workspace/api-client-react";
import { Card, CardContent, Skeleton, Badge } from "@/components/ui/shared";
import { Activity, ShieldAlert, Crosshair, CheckCircle2, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatRelative } from "@/lib/utils";
import { NewsCard } from "@/components/shared/ItemCards";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentNews, isLoading: newsLoading } = useGetNews({ limit: 3 });

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-sans">SOC Overview</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const threatLevelColor = 
    stats.currentThreatLevel === 'critical' ? '#F85149' :
    stats.currentThreatLevel === 'high' ? '#FFB74B' :
    stats.currentThreatLevel === 'medium' ? '#F0C000' : '#3FB950';

  const pieData = [
    { name: 'Local', value: stats.localThreatsToday, color: '#0095AF' },
    { name: 'Global', value: stats.globalThreatsToday, color: '#FFB74B' }
  ];

  const statCards = [
    { title: "Total Threats (24h)", value: stats.totalThreatsToday, icon: Crosshair, color: "text-primary", bg: "bg-primary/10" },
    { title: "Active Advisories", value: stats.activeAdvisories, icon: ShieldAlert, color: "text-accent", bg: "bg-accent/10" },
    { title: "Critical Alerts", value: stats.criticalAlerts, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { title: "Resolved Incidents", value: stats.resolvedIncidents, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight">SOC Overview</h1>
          <p className="text-muted-foreground mt-1">Real-time threat intelligence landscape</p>
        </div>
        <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-full border border-border">
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: threatLevelColor }} />
          <span className="text-sm font-medium uppercase tracking-wider font-mono">
            DEFCON: {stats.currentThreatLevel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="glass-panel overflow-hidden relative group">
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40 ${stat.bg.replace('/10', '')}`} />
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">{stat.title}</p>
                  <h3 className="text-3xl font-bold font-mono text-white">{stat.value}</h3>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Urgent Intel
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {newsLoading ? (
               [1,2].map(i => <Skeleton key={i} className="h-48" />)
            ) : recentNews?.items.map(item => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="glass-panel h-full flex flex-col">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold">Threat Distribution</h3>
              <Badge variant="outline" className="font-mono text-[10px]">24H</Badge>
            </div>
            <CardContent className="p-6 flex-1 flex flex-col items-center justify-center">
              <div className="h-[200px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#161B22', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                  <span className="text-3xl font-bold font-mono">{stats.totalThreatsToday}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
                </div>
              </div>
              <div className="flex gap-6 mt-4 w-full justify-center">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-sm text-muted-foreground">{d.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="glass-panel">
        <div className="p-6 border-b border-white/5">
          <h3 className="font-bold">Recent Activity Stream</h3>
        </div>
        <div className="p-0">
          <div className="divide-y divide-border/50">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-white/5 transition-colors flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  activity.severity === 'critical' ? 'bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]' : 
                  activity.severity === 'high' ? 'bg-accent shadow-[0_0_8px_hsl(var(--accent))]' : 'bg-primary'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{activity.title}</p>
                  <p className="text-xs text-muted-foreground">{activity.type.toUpperCase()}</p>
                </div>
                <div className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                  {formatRelative(activity.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
