import { useState } from "react";
import { Link } from "wouter";
import { useGetDashboardStats, useGetNews, getGetDashboardStatsQueryKey, getGetNewsQueryKey } from "@workspace/api-client-react";
import type { NewsItem } from "@workspace/api-client-react";
import { Card, CardContent, Skeleton, Badge } from "@/components/ui/shared";
import { Activity, ShieldAlert, Crosshair, CheckCircle2, AlertTriangle, Wrench } from "lucide-react";
import { LayoutDashboard } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { NewsCard, NewsDetail } from "@/components/News";
import { StatsCard, ThreatMeter, QuickActions, RefreshCountdown, FeedStatus, StatusStrip, ActivityStream, IndiaStatsPanel, SeverityTrendChart } from "@/components/Dashboard";
import { TimeframeSelector, getTimeframeLabel, PageHeader, type TimeframeValue } from "@/components/Common";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePreference } from "@/hooks/usePreferences";

export default function Dashboard() {
  const { isConnected, isRefreshing, lastUpdate, nextUpdate } = useWebSocket();
  const [autoRefresh] = usePreference("autoRefresh");
  const [refreshInterval] = usePreference("refreshInterval");
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeValue>("24h");
  const pollMs = autoRefresh ? refreshInterval * 1000 : false;
  const statsParams = { timeframe };
  const { data: stats, isLoading: statsLoading, isError: statsError } = useGetDashboardStats(statsParams, {
    query: { queryKey: getGetDashboardStatsQueryKey(statsParams), refetchInterval: pollMs },
  });
  const newsParams = { limit: 4, timeframe };
  const { data: recentNews, isLoading: newsLoading, isError: newsError } = useGetNews(newsParams, {
    query: { queryKey: getGetNewsQueryKey(newsParams), refetchInterval: pollMs },
  });
  const localStatsParams = { timeframe, scope: "local" as const };
  const { data: localStats } = useGetDashboardStats(localStatsParams, {
    query: { queryKey: getGetDashboardStatsQueryKey(localStatsParams), refetchInterval: pollMs },
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

  const pieData = [
    { name: 'Local', value: stats.localThreatsToday, color: '#0095AF' },
    { name: 'Global', value: stats.globalThreatsToday, color: '#FFB74B' }
  ];

  const timeframeLabel = getTimeframeLabel(timeframe);
  const patchesAvailable = stats.patchesAvailable ?? 0;
  const statCards = [
    { title: `Total Threats (${timeframe === "all" ? "All" : timeframeLabel})`, value: stats.totalThreatsToday, icon: Crosshair, color: "text-primary", bg: "bg-primary/10", href: undefined },
    { title: "Active Advisories", value: stats.activeAdvisories, icon: ShieldAlert, color: "text-accent", bg: "bg-accent/10", href: undefined },
    { title: "Patches Available", value: patchesAvailable, icon: Wrench, color: "text-warning", bg: "bg-warning/10", href: "/patches" },
    { title: "Critical Alerts", value: stats.criticalAlerts, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", href: undefined },
    { title: "Resolved Incidents", value: stats.resolvedIncidents, icon: CheckCircle2, color: "text-success", bg: "bg-success/10", href: undefined },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Threat Overview"
        icon={LayoutDashboard}
        description="Real-time threat intelligence landscape"
        actions={
          <>
            <RefreshCountdown nextUpdate={nextUpdate} isRefreshing={isRefreshing} />
            <FeedStatus />
            <TimeframeSelector value={timeframe} onChange={setTimeframe} />
            <QuickActions />
          </>
        }
      />

      <StatusStrip
        isConnected={isConnected}
        isRefreshing={isRefreshing}
        lastUpdate={lastUpdate}
        criticalCount={stats.criticalAlerts}
        highCount={stats.highAlerts}
        totalThreats={stats.totalThreatsToday}
      />

      {/* ThreatMeter + stats side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6 items-start">
        <ThreatMeter
          level={stats.currentThreatLevel}
          criticalAlerts={stats.criticalAlerts}
          highAlerts={stats.highAlerts}
          className="w-full"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {statCards.map((stat, i) =>
            stat.href ? (
              <Link key={i} href={stat.href} className="block hover:opacity-90 transition-opacity">
                <StatsCard
                  title={stat.title}
                  value={stat.value}
                  icon={stat.icon}
                  color={stat.color}
                  bg={stat.bg}
                />
              </Link>
            ) : (
              <StatsCard
                key={i}
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                color={stat.color}
                bg={stat.bg}
              />
            )
          )}
        </div>
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
          {localStats && <IndiaStatsPanel stats={localStats} />}
        </div>
      </div>

      <ActivityStream items={stats?.recentActivity ?? []} />

      <SeverityTrendChart />

      <NewsDetail
        item={selectedNews}
        isOpen={!!selectedNews}
        onClose={() => setSelectedNews(null)}
      />
    </div>
  );
}
