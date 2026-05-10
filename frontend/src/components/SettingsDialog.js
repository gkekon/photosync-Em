import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useTheme } from "../context/ThemeContext";
import { apiFetch } from "../utils/api";
import { toast } from "sonner";
import { Check, Palette, RefreshCw, Bell, Shield, Upload } from "lucide-react";
import CsvImportPanel from "./CsvImportPanel";

export const SettingsDialog = ({ open, onOpenChange, autoSync, onAutoSyncChange, onImportComplete }) => {
  const { theme, setTheme, themes } = useTheme();
  const [localAutoSync, setLocalAutoSync] = useState(autoSync);
  const [notionSyncing, setNotionSyncing] = useState(false);
  const [calendarSources, setCalendarSources] = useState([]);
  const [untaggedCount, setUntaggedCount] = useState(0);
  const [notionCalendarId, setNotionCalendarId] = useState(() => localStorage.getItem("selectedCalendar") || "all");
  const [notionReplaceExisting, setNotionReplaceExisting] = useState(true);

  useEffect(() => {
    setLocalAutoSync(autoSync);
  }, [autoSync]);

  useEffect(() => {
    if (!open) return;

    const fetchCalendarSources = async () => {
      try {
        const response = await apiFetch("/api/events/sources");
        const result = await response.json().catch(() => null);
        if (response.ok) {
          setCalendarSources(result?.sources || []);
          setUntaggedCount(result?.untagged_count || 0);
        }
      } catch (error) {
        console.error("Failed to load calendar sources:", error);
      }
    };

    fetchCalendarSources();
  }, [open]);

  const handleAutoSyncChange = (checked) => {
    setLocalAutoSync(checked);
    onAutoSyncChange(checked);
  };

  const handleNotionSync = async () => {
    setNotionSyncing(true);
    try {
      const response = await apiFetch("/api/notion/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendar_id: notionCalendarId,
          replace_existing: notionReplaceExisting,
        }),
      });
      const result = await response.json().catch(() => null);
      if (response.ok) {
        toast.success(result?.message || "Pushed events to Notion");
      } else {
        toast.error(result?.detail || "Failed to push to Notion");
      }
    } catch (error) {
      console.error("Notion sync error:", error);
      toast.error("Failed to push to Notion");
    } finally {
      setNotionSyncing(false);
    }
  };

  const darkThemes = themes.filter((t) => t.isDark);
  const lightThemes = themes.filter((t) => !t.isDark);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>
            Settings
          </DialogTitle>
          <DialogDescription>
            Customize your dashboard appearance and preferences
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="w-4 h-4" />
              Theme
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Sync
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2" data-testid="settings-import-tab">
              <Upload className="w-4 h-4" />
              Import
            </TabsTrigger>
          </TabsList>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6 mt-4">
            {/* Dark Themes */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Dark Themes</h4>
              <div className="grid grid-cols-3 gap-3">
                {darkThemes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`
                      relative p-3 rounded-xl border-2 transition-all
                      hover:scale-105 active:scale-95
                      ${theme === t.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/30'}
                    `}
                    style={{ backgroundColor: t.id.includes('blue') ? '#020617' : t.id.includes('purple') ? '#0b051d' : '#022c22' }}
                    data-testid={`settings-theme-${t.id}`}
                  >
                    <div
                      className="w-full h-6 rounded-md mb-2"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="text-xs font-medium text-white/80 block truncate">
                      {t.name}
                    </span>
                    {theme === t.id && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Light Themes */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Light Themes</h4>
              <div className="grid grid-cols-3 gap-3">
                {lightThemes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`
                      relative p-3 rounded-xl border-2 transition-all
                      hover:scale-105 active:scale-95
                      ${theme === t.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/30'}
                    `}
                    style={{ backgroundColor: t.id.includes('blue') ? '#f0f9ff' : t.id.includes('purple') ? '#faf5ff' : '#f0fdf4' }}
                    data-testid={`settings-theme-${t.id}`}
                  >
                    <div
                      className="w-full h-6 rounded-md mb-2"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="text-xs font-medium text-gray-700 block truncate">
                      {t.name}
                    </span>
                    {theme === t.id && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Sync Tab */}
          <TabsContent value="sync" className="space-y-6 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="space-y-1">
                  <Label htmlFor="auto-sync" className="font-medium">Auto-Sync on Login</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically sync with Google Calendar when you open the app
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={localAutoSync}
                  onCheckedChange={handleAutoSyncChange}
                  data-testid="auto-sync-switch"
                />
              </div>

              <Separator />

              <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                <div className="space-y-1">
                  <Label className="font-medium">Push to Notion</Label>
                  <p className="text-xs text-muted-foreground">
                    Choose which calendar to send to the Notion bookings table
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Select value={notionCalendarId} onValueChange={setNotionCalendarId}>
                    <SelectTrigger data-testid="notion-calendar-select">
                      <SelectValue placeholder="Choose calendar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All calendars</SelectItem>
                      {calendarSources.map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.name} ({source.count})
                        </SelectItem>
                      ))}
                      {untaggedCount > 0 && (
                        <SelectItem value="untagged">Untagged events ({untaggedCount})</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleNotionSync}
                    disabled={notionSyncing}
                    data-testid="notion-sync-btn"
                  >
                    <RefreshCw className={`w-4 h-4 ${notionSyncing ? 'animate-spin' : ''}`} />
                    Push
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                  <div className="space-y-1">
                    <Label htmlFor="notion-replace-existing" className="text-xs font-medium">
                      Show only this selection in Notion
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Hides rows from other calendars; PhotoSync data stays untouched
                    </p>
                  </div>
                  <Switch
                    id="notion-replace-existing"
                    checked={notionReplaceExisting}
                    onCheckedChange={setNotionReplaceExisting}
                    data-testid="notion-replace-switch"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Sync Behavior</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• New events from Google Calendar are added as "unbooked"</li>
                  <li>• Existing events are never overwritten</li>
                  <li>• Your pricing, deposits, and notes are always preserved</li>
                  <li>• Only reads from Google Calendar (never writes to it)</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="space-y-2 mb-4">
              <h4 className="text-sm font-medium">Import Events from CSV</h4>
              <p className="text-xs text-muted-foreground">
                Upload a CSV file exported from PhotoSync or other tools.
                Duplicate events (same Google Calendar ID) are automatically detected and skipped.
              </p>
            </div>
            <CsvImportPanel onImportComplete={() => {
              onOpenChange(false);
              if (onImportComplete) onImportComplete();
            }} />
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />

        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="w-full"
        >
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
