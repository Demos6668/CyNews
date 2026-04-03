import { useState } from "react";
import { useGetDashboardStats, useGetNews, getGetDashboardStatsQueryKey, getGetNewsQueryKey } from "@workspace/api-client-react";
import type { NewsItem } from "@workspace/api-client-react";
import { Card, CardContent, Skeleton, Badge } from "@/components/ui/shared";
import { Activity, ShieldAlert, Crosshair, CheckCircle2, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatRelative } from "@/lib/utils";
import { NewsCard, NewsDetail } from "@/components/News";
import { StatsCard, ThreatMeter, QuickActions, RefreshCountdown, FeedStatus } from "@/components/Dashboard";
import { TimeframeSelector, getTimeframeLabel, type TimeframeValue } from "@/components/Common";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function Dashboard() {
  const { isConnected, isRefreshing, lastUpdate, nextUpdate } = useWebSocket();
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeValue>("24h");
  const statsParams = { timeframe };
  const { data: stats, isLoading: statsLoading, isError: statsError } = useGetDashboardStats(statsParams, {
    query: { queryKey: getGetDashboardStatsQueryKey(statsParams), refetchInterval: 60000 },
  });
  const newsParams = { limit: 3, timeframe };
  const { data: recentNews, isLoading: newsLoading, isError: newsError } = useGetNews(newsParams, {
    query: { queryKey: getGetNewsQueryKey(newsParams), refetchInterval: 60000 },
  });

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-sans">Threat Overview</h1>
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

  if (statsError || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-sans">Threat Overview</h1>
        <div className="text-center py-20 bg-card rounded-xl border border-destructive/30">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-destructive mb-2">Failed to load dashboard</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Unable to retrieve SOC metrics. Please check your connection and try again.
          </p>
        </div>
      </div>
    );
  }

  const threatLevelColor = 
    stats.currentThreatLevel === 'critical' ? '#F85149' :
    stats.currentThreatLevel === 'high' ? '#FFB74B' :
    stats.currentThreatLevel === 'medium' ? '#F0C000' : '#3FB950';

  const pieData = [
    { name: 'Local', value: stats.localThreatsToday, color: '#0095AF' },
    { name: 'Global', value: stats.globalThreatsToday, color: '#FFB74B' }
  ];

  const timeframeLabel = getTimeframeLabel(timeframe);
  const statCards = [
    { title: `Total Threats (${timeframe === "all" ? "All" : timeframeLabel})`, value: stats.totalThreatsToday, icon: Crosshair, color: "text-primary", bg: "bg-primary/10" },
    { title: "Active Advisories", value: stats.activeAdvisories, icon: ShieldAlert, color: "text-accent", bg: "bg-accent/10" },
    { title: "Critical Alerts", value: stats.criticalAlerts, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
    { title: "Resolved Incidents", value: stats.resolvedIncidents, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-sans tracking-tight">Threat Overview</h1>
          <p className="text-muted-foreground mt-1">Real-time threat intelligence landscape</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {isRefreshing && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 rounded-full">
              <Loader2 className="h-4 w-4 text-accent animate-spin" />
              <span className="text-sm text-accent">Refreshing feeds...</span>
            </div>
          )}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isConnected ? "bg-success/20" : "bg-destructive/20"}`}>
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-success animate-pulse" : "bg-destructive"}`} />
            <span className={`text-sm ${isConnected ? "text-success" : "text-destructive"}`}>
              {isConnected ? "Live" : "Disconnected"}
            </span>
          </div>
          <RefreshCountdown nextUpdate={nextUpdate} isRefreshing={isRefreshing} />
          <FeedStatus />
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">Updated: {formatRelative(lastUpdate)}</span>
          )}
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <QuickActions />
          <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-full border border-border">
            <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: threatLevelColor }} />
            <span className="text-sm font-medium uppercase tracking-wider font-mono">
              DEFCON: {stats.currentThreatLevel}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-center mb-2">
        <ThreatMeter
          level={stats.currentThreatLevel}
          criticalAlerts={stats.criticalAlerts}
          highAlerts={stats.highAlerts}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat, i) => (
          <StatsCard
            key={i}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            bg={stat.bg}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Urgent Intel
            </h2>
          </div>
          {newsError ? (
            <div className="p-8 bg-card rounded-xl border border-destructive/30 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Failed to load recent news.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {newsLoading ? (
                [1, 2].map((i) => <Skeleton key={i} className="h-48" />)
              ) : (
                (recentNews?.items ?? []).map((item) => (
                  <NewsCard
                    key={item.id}
                    item={item}
                    onClick={() => setSelectedNews(item)}
                  />
                ))
              )}
            </div>
          )}
        </div>

        <div className="space-y-6 flex flex-col items-center xl:items-stretch">
          <Card className="glass-panel flex flex-col w-full max-w-sm xl:max-w-none">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold">Threat Distribution</h3>
              <Badge variant="outline" className="font-mono text-[10px]">{timeframe === "all" ? "ALL" : timeframe.toUpperCase()}</Badge>
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
            {(stats?.recentActivity ?? []).map((activity) => (
              <div
                key={activity.id}
                role={activity.sourceUrl ? "button" : undefined}
                tabIndex={activity.sourceUrl ? 0 : undefined}
                title={activity.sourceUrl ? "Open source" : "No source link"}
                onClick={() => activity.sourceUrl && window.open(activity.sourceUrl, "_blank")}
                onKeyDown={(e) => activity.sourceUrl && (e.key === "Enter" || e.key === " ") && window.open(activity.sourceUrl!, "_blank")}
                className={`p-4 transition-colors flex items-center gap-4 ${
                  activity.sourceUrl
                    ? "cursor-pointer hover:bg-white/5"
                    : "cursor-default opacity-80"
                }`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  activity.severity === 'critical' ? 'bg-destructive shadow-[0_0_8px_hsl(var(--destructive))]' : 
                  activity.severity === 'high' ? 'bg-accent shadow-[0_0_8px_hsl(var(--accent))]' : 'bg-primary'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{activity.title}</p>
                  <p className="text-xs text-muted-foreground">{activity.type.toUpperCase()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {formatRelative(activity.timestamp)}
                  </span>
                  {activity.sourceUrl && (
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" aria-hidden />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <NewsDetail
        item={selectedNews}
        isOpen={!!selectedNews}
        onClose={() => setSelectedNews(null)}
      />
    </div>
  );
}
