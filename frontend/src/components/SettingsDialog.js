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
import { useTheme } from "../context/ThemeContext";
import { Check, Palette, RefreshCw, Bell, Shield } from "lucide-react";

export const SettingsDialog = ({ open, onOpenChange, autoSync, onAutoSyncChange }) => {
  const { theme, setTheme, themes } = useTheme();
  const [localAutoSync, setLocalAutoSync] = useState(autoSync);

  useEffect(() => {
    setLocalAutoSync(autoSync);
  }, [autoSync]);

  const handleAutoSyncChange = (checked) => {
    setLocalAutoSync(checked);
    onAutoSyncChange(checked);
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="w-4 h-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Sync
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
