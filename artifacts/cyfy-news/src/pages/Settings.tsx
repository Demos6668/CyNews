import { Card, CardContent, Button, Input } from "@/components/ui/shared";
import { User, Bell, Shield, Key, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
      <div>
        <h1 className="text-3xl font-bold font-sans tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your SOC analyst preferences and integrations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-2">
          <Button variant="secondary" className="w-full justify-start text-left bg-white/5">
            <User className="mr-2 h-4 w-4" /> Profile
          </Button>
          <Button variant="ghost" className="w-full justify-start text-left">
            <Bell className="mr-2 h-4 w-4" /> Notifications
          </Button>
          <Button variant="ghost" className="w-full justify-start text-left">
            <Shield className="mr-2 h-4 w-4" /> Preferences
          </Button>
          <Button variant="ghost" className="w-full justify-start text-left">
            <Key className="mr-2 h-4 w-4" /> API Keys
          </Button>
        </div>

        <div className="md:col-span-3 space-y-6">
          <Card className="bg-card/50">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold">Appearance</h2>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {theme === "dark" ? (
                    <Moon className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Sun className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">Theme</p>
                    <p className="text-sm text-muted-foreground">
                      Switch between dark and light mode
                    </p>
                  </div>
                </div>
                <Switch
                  checked={theme === "light"}
                  onCheckedChange={(checked) =>
                    setTheme(checked ? "light" : "dark")
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold">Analyst Profile</h2>
            </div>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                <Input defaultValue="Lead Analyst 01" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                <Input defaultValue="analyst@cyfy.soc" disabled />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Department</label>
                <Input defaultValue="Global Threat Intelligence" />
              </div>
              <Button className="mt-4">Save Changes</Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/30 bg-destructive/5">
            <div className="p-6">
              <h3 className="text-lg font-bold text-destructive mb-2">Danger Zone</h3>
              <p className="text-sm text-muted-foreground mb-4">Actions here are permanent and cannot be undone.</p>
              <Button variant="destructive">Clear Local Cache</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
