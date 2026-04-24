import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Camera,
  Calendar,
  Package,
  Euro,
  TrendingUp,
  AlertCircle,
  CalendarCheck,
  LogOut,
  Palette,
  Plus,
  RefreshCw,
  Settings,
  ChevronDown,
  Menu,
  X,
  BarChart3,
  Table2,
  Download,
  FileSpreadsheet,
  Save,
  Trash2,
} from "lucide-react";

import EventsTable from "../components/EventsTable";
import EventSheet from "../components/EventSheet";
import PackageDialog from "../components/PackageDialog";
import CalendarDialog from "../components/CalendarDialog";
import ThemeSwitcher from "../components/ThemeSwitcher";
import SettingsDialog from "../components/SettingsDialog";
import AnalyticsPanel from "../components/AnalyticsPanel";
import CalendarSelector from "../components/CalendarSelector";
import { apiFetch } from "../utils/api";

export default function Dashboard() {
  const { user, setUser, logout, checkAuth } = useAuth();
  const { currentTheme } = useTheme();
  const location = useLocation();

  // State
  const [events, setEvents] = useState([]);
  const [packages, setPackages] = useState([]);
  const [summary, setSummary] = useState(null);
  const [calendarStatus, setCalendarStatus] = useState({ connected: false });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("events");
  const [autoSync, setAutoSync] = useState(() => {
    return localStorage.getItem("autoSync") === "true";
  });
  const [selectedCalendar, setSelectedCalendar] = useState(() => {
    return localStorage.getItem("selectedCalendar") || "all";
  });

  // Dialogs/Sheets
  const [eventSheetOpen, setEventSheetOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [calendarDialogOpen, setCalendarDialogOpen] = useState(false);
  const [themeSwitcherOpen, setThemeSwitcherOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Handle auto-sync setting change
  const handleAutoSyncChange = (enabled) => {
    setAutoSync(enabled);
    localStorage.setItem("autoSync", enabled.toString());
    if (enabled) {
      toast.success("Auto-sync enabled");
    }
  };

  // Handle calendar filter change
  const handleCalendarChange = (calendarId) => {
    setSelectedCalendar(calendarId);
    localStorage.setItem("selectedCalendar", calendarId);
  };

  // Refetch when calendar changes
  useEffect(() => {
    fetchData();
  }, [selectedCalendar, fetchData]);

  // Create backup
  const handleBackup = async () => {
    try {
      const response = await apiFetch("/api/backup/create", { method: "POST" });
      if (response.ok) {
        const result = await response.json();
        toast.success(`Backup created: ${result.events_count} events, ${result.packages_count} packages`);
      } else {
        toast.error("Failed to create backup");
      }
    } catch (error) {
      console.error("Backup error:", error);
      toast.error("Failed to create backup");
    }
  };

  // Clear calendar events
  const handleClearCalendar = async () => {
    const calLabel = selectedCalendar === "all" ? "ALL calendars" :
      selectedCalendar === "untagged" ? "Manually Added" :
      events.length > 0 ? (events[0]?.source_calendar_name || selectedCalendar) : selectedCalendar;
    const count = events.length;

    if (!window.confirm(`Are you sure you want to delete ${count} events from "${calLabel}"?\n\nThis action cannot be undone. Consider creating a backup first.`)) {
      return;
    }

    try {
      const response = await apiFetch("/api/events/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendar_id: selectedCalendar === "all" ? "all" : selectedCalendar,
          confirm: true,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(`Deleted ${result.deleted} events`);
        fetchData();
      } else {
        toast.error("Failed to clear events");
      }
    } catch (error) {
      console.error("Clear error:", error);
      toast.error("Failed to clear events");
    }
  };

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const calParam = selectedCalendar && selectedCalendar !== "all" ? `?calendar=${selectedCalendar}` : "";
      const [eventsRes, packagesRes, summaryRes, calStatusRes] = await Promise.all([
        apiFetch(`/api/events${calParam}`),
        apiFetch("/api/packages"),
        apiFetch("/api/income/summary"),
        apiFetch("/api/calendar/status"),
      ]);

      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (packagesRes.ok) setPackages(await packagesRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (calStatusRes.ok) setCalendarStatus(await calStatusRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [selectedCalendar]);

  useEffect(() => {
    // Check for calendar connection status from URL
    const params = new URLSearchParams(location.search);
    if (params.get("calendar_connected") === "true") {
      toast.success("Google Calendar connected successfully!");
      window.history.replaceState({}, "", "/dashboard");
    }
    if (params.get("calendar_error")) {
      toast.error("Failed to connect Google Calendar");
      window.history.replaceState({}, "", "/dashboard");
    }

    // Set user from location state if available
    if (location.state?.user) {
      setUser(location.state.user);
    } else if (!user) {
      checkAuth();
    }

    fetchData();
  }, [location, setUser, user, checkAuth, fetchData]);

  // Auto-sync on load if enabled and calendar is connected
  useEffect(() => {
    const doAutoSync = async () => {
      if (autoSync && calendarStatus.connected && !syncing) {
        await syncCalendarSilent();
      }
    };
    doAutoSync();
  }, [calendarStatus.connected, autoSync]);

  // Silent sync (no toast on success, used for auto-sync)
  const syncCalendarSilent = async () => {
    try {
      const response = await apiFetch("/api/calendar/sync", {
        method: "POST",
      });
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Auto-sync error:", error);
    }
  };

  // Sync calendar events
  const syncCalendar = async () => {
    if (!calendarStatus.connected) {
      setCalendarDialogOpen(true);
      return;
    }

    setSyncing(true);
    try {
      const response = await apiFetch("/api/calendar/sync", {
        method: "POST",
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
        fetchData();
      } else {
        toast.error("Failed to sync calendar");
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Failed to sync calendar");
    } finally {
      setSyncing(false);
    }
  };

  // Event handlers
  const handleCreateEvent = () => {
    setSelectedEvent(null);
    setEventSheetOpen(true);
  };

  const handleEditEvent = (event) => {
    setSelectedEvent(event);
    setEventSheetOpen(true);
  };

  const handleCreatePackage = () => {
    setSelectedPackage(null);
    setPackageDialogOpen(true);
  };

  const handleEditPackage = (pkg) => {
    setSelectedPackage(pkg);
    setPackageDialogOpen(true);
  };

  const handleEventSave = async (eventData) => {
    try {
      const isEdit = selectedEvent?.event_id;
      const url = isEdit
        ? `/api/events/${selectedEvent.event_id}`
        : `/api/events`;

      const response = await apiFetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        toast.success(isEdit ? "Event updated" : "Event created");
        setEventSheetOpen(false);
        fetchData();
      } else {
        toast.error("Failed to save event");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save event");
    }
  };

  const handleEventDelete = async (eventId) => {
    try {
      const response = await apiFetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Event deleted");
        setEventSheetOpen(false);
        fetchData();
      } else {
        toast.error("Failed to delete event");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete event");
    }
  };

  // Export functions

  const handleExportCSV = async () => {
    try {
      const response = await apiFetch("/api/export/csv");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photosync_events_${new Date().toISOString().split('T')[0]}.csv`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
        toast.success("Events exported!");
      } else {
        toast.error("Failed to export");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export");
    }
  };

  const handleExportSummary = async () => {
    try {
      const response = await apiFetch("/api/export/summary");
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photosync_summary_${new Date().toISOString().split('T')[0]}.csv`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }, 100);
        toast.success("Summary exported!");
      } else {
        toast.error("Failed to export");
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export");
    }
  };

  const handlePackageSave = async (packageData) => {
    try {
      const isEdit = selectedPackage?.package_id;
      const url = isEdit
        ? `/api/packages/${selectedPackage.package_id}`
        : `/api/packages`;

      const response = await apiFetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packageData),
      });

      if (response.ok) {
        toast.success(isEdit ? "Package updated" : "Package created");
        setPackageDialogOpen(false);
        fetchData();
      } else {
        toast.error("Failed to save package");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save package");
    }
  };

  const handlePackageDelete = async (packageId) => {
    try {
      const response = await apiFetch(`/api/packages/${packageId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Package deleted");
        setPackageDialogOpen(false);
        fetchData();
      } else {
        toast.error("Failed to delete package");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete package");
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="animate-pulse text-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className={`sticky top-0 z-50 ${currentTheme.isDark ? 'glass' : 'glass-light'} border-b border-border`}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground hidden sm:block" style={{ fontFamily: 'Outfit, sans-serif' }}>
              PhotoSync
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-3">
            <CalendarSelector
              selectedCalendar={selectedCalendar}
              onCalendarChange={handleCalendarChange}
            />

            <Button
              data-testid="sync-calendar-btn"
              variant="outline"
              size="sm"
              onClick={syncCalendar}
              disabled={syncing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {calendarStatus.connected ? "Sync" : "Connect"}
            </Button>

            <Button
              data-testid="add-event-btn"
              size="sm"
              onClick={handleCreateEvent}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </Button>

            <Button
              data-testid="settings-btn"
              variant="ghost"
              size="icon"
              onClick={() => setSettingsDialogOpen(true)}
            >
              <Settings className="w-5 h-5" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2" data-testid="user-menu-btn">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.picture} />
                    <AvatarFallback>{user?.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-4 h-4 hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{user?.name}</span>
                    <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSettingsDialogOpen(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCalendarDialogOpen(true)}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Calendar Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCreatePackage}>
                  <Package className="w-4 h-4 mr-2" />
                  Manage Packages
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportCSV}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export Events (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportSummary}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Summary (CSV)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleBackup} data-testid="backup-btn">
                  <Save className="w-4 h-4 mr-2" />
                  Create Backup
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClearCalendar} className="text-yellow-500" data-testid="clear-calendar-btn">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear {selectedCalendar === "all" ? "All Events" : "This Calendar"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className={`md:hidden border-t border-border ${currentTheme.isDark ? 'glass' : 'glass-light'} p-4 space-y-3 animate-fade-in`}>
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <Avatar className="w-10 h-10">
                <AvatarImage src={user?.picture} />
                <AvatarFallback>{user?.name?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <CalendarSelector
              selectedCalendar={selectedCalendar}
              onCalendarChange={handleCalendarChange}
            />
            <Button variant="outline" className="w-full justify-start gap-2" onClick={syncCalendar}>
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {calendarStatus.connected ? "Sync Calendar" : "Connect Calendar"}
            </Button>
            <Button className="w-full justify-start gap-2" onClick={handleCreateEvent}>
              <Plus className="w-4 h-4" />
              Add Event
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={handleBackup}>
              <Save className="w-4 h-4" />
              Create Backup
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={handleCreatePackage}>
              <Package className="w-4 h-4" />
              Manage Packages
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setThemeSwitcherOpen(true)}>
              <Palette className="w-4 h-4" />
              Change Theme
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 text-destructive" onClick={logout}>
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="stats-cards">
          {/* Yearly Income */}
          <Card className={`${currentTheme.isDark ? 'glass' : 'glass-light'} border-border`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Yearly Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-foreground" data-testid="yearly-income">
                {formatCurrency(summary?.yearly_income)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary?.booked_events || 0} booked events
              </p>
            </CardContent>
          </Card>

          {/* Monthly Income */}
          <Card className={`${currentTheme.isDark ? 'glass' : 'glass-light'} border-border`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Euro className="w-4 h-4" />
                Monthly Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-foreground" data-testid="monthly-income">
                {formatCurrency(summary?.monthly_income)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This month
              </p>
            </CardContent>
          </Card>

          {/* Pending Deposits */}
          <Card className={`${currentTheme.isDark ? 'glass' : 'glass-light'} border-border`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Pending Deposits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-foreground" data-testid="pending-deposits">
                {summary?.pending_deposits || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Events without deposit
              </p>
            </CardContent>
          </Card>

          {/* Next Event */}
          <Card className={`${currentTheme.isDark ? 'glass' : 'glass-light'} border-border`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CalendarCheck className="w-4 h-4" />
                Next Event
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary?.next_event ? (
                <>
                  <p className="text-lg font-bold text-foreground truncate" data-testid="next-event-name">
                    {summary.next_event.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                    {summary.next_event.date}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground" data-testid="no-upcoming-events">No upcoming events</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Packages Row */}
        {packages.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Packages:</span>
            {packages.map((pkg) => (
              <Badge
                key={pkg.package_id}
                variant="outline"
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleEditPackage(pkg)}
                data-testid={`package-badge-${pkg.package_id}`}
              >
                {pkg.name} • {formatCurrency(pkg.total_price)}
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCreatePackage}
              className="h-6 text-xs"
              data-testid="add-package-btn"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="events" className="gap-2" data-testid="events-tab">
              <Table2 className="w-4 h-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2" data-testid="analytics-tab">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Events Tab */}
          <TabsContent value="events" className="mt-4">
            <Card className={`${currentTheme.isDark ? 'glass' : 'glass-light'} border-border`}>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-lg font-semibold" style={{ fontFamily: 'Outfit, sans-serif' }}>
                  Events & Bookings
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" data-testid="total-events-badge">
                    {events.length} events
                  </Badge>
                  {summary?.unbooked_events > 0 && (
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                      {summary.unbooked_events} unbooked
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <EventsTable
                    events={events}
                    packages={packages}
                    onEdit={handleEditEvent}
                    formatCurrency={formatCurrency}
                    onRefresh={fetchData}
                  />
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-4">
            <AnalyticsPanel isOpen={activeTab === "analytics"} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Event Sheet */}
      <EventSheet
        open={eventSheetOpen}
        onOpenChange={setEventSheetOpen}
        event={selectedEvent}
        packages={packages}
        onSave={handleEventSave}
        onDelete={handleEventDelete}
        formatCurrency={formatCurrency}
      />

      {/* Package Dialog */}
      <PackageDialog
        open={packageDialogOpen}
        onOpenChange={setPackageDialogOpen}
        package={selectedPackage}
        onSave={handlePackageSave}
        onDelete={handlePackageDelete}
      />

      {/* Calendar Dialog */}
      <CalendarDialog
        open={calendarDialogOpen}
        onOpenChange={setCalendarDialogOpen}
        calendarStatus={calendarStatus}
        onRefresh={fetchData}
      />

      {/* Theme Switcher */}
      <ThemeSwitcher
        open={themeSwitcherOpen}
        onOpenChange={setThemeSwitcherOpen}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        autoSync={autoSync}
        onAutoSyncChange={handleAutoSyncChange}
        onImportComplete={fetchData}
      />
    </div>
  );
}
