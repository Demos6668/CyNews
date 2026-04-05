import { useState } from "react";
import { Card, CardContent, Button, Input } from "@/components/ui/shared";
import { User, Bell, Shield, Key, Sun, Moon, Monitor, RefreshCw, Clock, Rss, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";

type SettingsTab = "profile" | "notifications" | "preferences" | "api";

function ApiKeysTab() {
  const [urlhausKey, setUrlhausKey] = useState(() => localStorage.getItem("cynews-urlhaus-key") ?? "");
  const [threatfoxKey, setThreatfoxKey] = useState(() => localStorage.getItem("cynews-threatfox-key") ?? "");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem("cynews-urlhaus-key", urlhausKey);
    localStorage.setItem("cynews-threatfox-key", threatfoxKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card className="bg-card/50">
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-semibold">API Configuration</h2>
      </div>
      <CardContent className="p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">URLhaus Auth Key</label>
          <Input type="password" placeholder="Enter your URLhaus API key" value={urlhausKey} onChange={(e) => setUrlhausKey(e.target.value)} />
          <p className="text-xs text-muted-foreground">Free at https://auth.abuse.ch/</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">ThreatFox Auth Key</label>
          <Input type="password" placeholder="Enter your ThreatFox API key" value={threatfoxKey} onChange={(e) => setThreatfoxKey(e.target.value)} />
        </div>
        <div className="p-4 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>RSS Feed Endpoint:</strong>{" "}
            <code className="bg-background px-2 py-0.5 rounded text-xs">/api/news/rss</code>
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            <strong>WebSocket:</strong>{" "}
            <code className="bg-background px-2 py-0.5 rounded text-xs">ws://{"{host}"}/ws</code>
          </p>
        </div>
        <Button className="mt-4" onClick={handleSave}>
          {saved ? "Saved!" : "Save API Keys"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [autoRefresh, setAutoRefresh] = useState(() => localStorage.getItem("cyfy-auto-refresh") !== "false");
  const [desktopNotifications, setDesktopNotifications] = useState(() => localStorage.getItem("cyfy-desktop-notifications") === "true");
  const [criticalOnly, setCriticalOnly] = useState(() => localStorage.getItem("cyfy-critical-only") === "true");
  const [refreshInterval, setRefreshInterval] = useState(() => localStorage.getItem("cyfy-refresh-interval") ?? "60");
  const [profileName, setProfileName] = useState(() => localStorage.getItem("cyfy-profile-name") ?? "Lead Analyst 01");
  const [department, setDepartment] = useState(() => localStorage.getItem("cyfy-department") ?? "Global Threat Intelligence");

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "preferences" as const, label: "Preferences", icon: Shield },
    { id: "api" as const, label: "API Keys", icon: Key },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-bold font-sans tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your analyst preferences and integrations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "secondary" : "ghost"}
              className={`w-full justify-start text-left ${activeTab === tab.id ? "bg-white/5" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="mr-2 h-4 w-4" /> {tab.label}
            </Button>
          ))}
        </div>

        <div className="md:col-span-3 space-y-6">
          {activeTab === "profile" && (
            <>
              <Card className="bg-card/50">
                <div className="p-6 border-b border-border">
                  <h2 className="text-xl font-semibold">Analyst Profile</h2>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                    <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                    <Input defaultValue="analyst@soc.local" disabled />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Department</label>
                    <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
                  </div>
                  <Button className="mt-4" onClick={() => {
                    localStorage.setItem("cyfy-profile-name", profileName);
                    localStorage.setItem("cyfy-department", department);
                  }}>Save Changes</Button>
                </CardContent>
              </Card>

              <Card className="border-destructive/30 bg-destructive/5">
                <div className="p-6">
                  <h3 className="text-lg font-bold text-destructive mb-2">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground mb-4">Actions here are permanent and cannot be undone.</p>
                  <Button variant="destructive" onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                  }}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear Local Cache
                  </Button>
                </div>
              </Card>
            </>
          )}

          {activeTab === "notifications" && (
            <Card className="bg-card/50">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold">Notification Preferences</h2>
              </div>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Desktop Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive browser notifications for new threats
                    </p>
                  </div>
                  <Switch
                    checked={desktopNotifications}
                    onCheckedChange={(checked) => {
                      if (checked && "Notification" in window) {
                        Notification.requestPermission().then((perm) => {
                          const granted = perm === "granted";
                          setDesktopNotifications(granted);
                          localStorage.setItem("cyfy-desktop-notifications", String(granted));
                        });
                      } else {
                        setDesktopNotifications(checked);
                        localStorage.setItem("cyfy-desktop-notifications", String(checked));
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Critical Alerts Only</p>
                    <p className="text-sm text-muted-foreground">
                      Only notify for critical and high severity items
                    </p>
                  </div>
                  <Switch checked={criticalOnly} onCheckedChange={(v) => { setCriticalOnly(v); localStorage.setItem("cyfy-critical-only", String(v)); }} />
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "preferences" && (
            <>
              <Card className="bg-card/50">
                <div className="p-6 border-b border-border">
                  <h2 className="text-xl font-semibold">Appearance</h2>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {theme === "dark" ? (
                        <Moon className="h-5 w-5 text-muted-foreground" />
                      ) : theme === "light" ? (
                        <Sun className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Monitor className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">Theme</p>
                        <p className="text-sm text-muted-foreground">
                          Choose your preferred color scheme
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(["dark", "light", "system"] as const).map((t) => (
                        <Button
                          key={t}
                          size="sm"
                          variant={theme === t ? "default" : "outline"}
                          onClick={() => setTheme(t)}
                          className="capitalize"
                        >
                          {t}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50">
                <div className="p-6 border-b border-border">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Rss className="h-5 w-5" /> Feed Settings
                  </h2>
                </div>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Auto-Refresh Dashboard</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically refresh data on the dashboard
                        </p>
                      </div>
                    </div>
                    <Switch checked={autoRefresh} onCheckedChange={(v) => { setAutoRefresh(v); localStorage.setItem("cyfy-auto-refresh", String(v)); }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Refresh Interval</p>
                        <p className="text-sm text-muted-foreground">
                          How often to poll for new data (seconds)
                        </p>
                      </div>
                    </div>
                    <Input
                      type="number"
                      min={10}
                      max={300}
                      value={refreshInterval}
                      onChange={(e) => { setRefreshInterval(e.target.value); localStorage.setItem("cyfy-refresh-interval", e.target.value); }}
                      className="w-24 text-center"
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "api" && (
            <ApiKeysTab />
          )}
        </div>
      </div>
    </div>
  );
}
