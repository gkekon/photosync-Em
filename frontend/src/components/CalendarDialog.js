import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { Calendar, Check, Link2, Loader2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const CalendarDialog = ({ open, onOpenChange, calendarStatus, onRefresh }) => {
  const [calendars, setCalendars] = useState([]);
  const [selectedCalendar, setSelectedCalendar] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (open && calendarStatus.connected) {
      fetchCalendars();
    }
    if (calendarStatus.selected_calendar_id) {
      setSelectedCalendar(calendarStatus.selected_calendar_id);
    }
  }, [open, calendarStatus]);

  const fetchCalendars = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/calendar/list`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setCalendars(data);
      }
    } catch (error) {
      console.error("Error fetching calendars:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/oauth/calendar/login`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        // Always use top-level navigation for OAuth (avoids iframe blocking)
        // If in iframe, try to navigate top window
        try {
          if (window.top && window.top !== window.self) {
            window.top.location.href = data.authorization_url;
          } else {
            window.location.href = data.authorization_url;
          }
        } catch (e) {
          // Cross-origin iframe, open in new tab
          const newWindow = window.open(data.authorization_url, '_blank');
          if (!newWindow) {
            // Popup blocked, show manual link
            toast.info(
              <div>
                <p>Please open this link in a new tab:</p>
                <a href={data.authorization_url} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                  Connect Google Calendar
                </a>
              </div>,
              { duration: 15000 }
            );
          } else {
            toast.info("Complete authentication in the new tab, then refresh this page", { duration: 10000 });
          }
        }
      } else {
        toast.error("Failed to start calendar connection");
      }
      setConnecting(false);
    } catch (error) {
      console.error("Connect error:", error);
      toast.error("Failed to connect calendar");
      setConnecting(false);
    }
  };

  const handleSelectCalendar = async (calendarId) => {
    setSelectedCalendar(calendarId);
    try {
      const response = await fetch(`${BACKEND_URL}/api/calendar/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ calendar_id: calendarId }),
      });
      if (response.ok) {
        toast.success("Calendar selected");
        onRefresh();
      }
    } catch (error) {
      console.error("Select error:", error);
      toast.error("Failed to select calendar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            <Calendar className="w-5 h-5" />
            Google Calendar Settings
          </DialogTitle>
          <DialogDescription>
            Connect and sync your Google Calendar to import events automatically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${calendarStatus.connected ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-sm font-medium">
                {calendarStatus.connected ? "Connected" : "Not Connected"}
              </span>
            </div>
            {calendarStatus.connected ? (
              <Badge variant="outline" className="gap-1">
                <Check className="w-3 h-3" />
                Active
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={connecting}
                className="gap-2"
                data-testid="connect-calendar-btn"
              >
                {connecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                Connect
              </Button>
            )}
          </div>

          {calendarStatus.connected && (
            <>
              <Separator />

              {/* Calendar Selection */}
              <div className="space-y-2">
                <Label>Select Calendar to Sync</Label>
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Select
                    value={selectedCalendar}
                    onValueChange={handleSelectCalendar}
                  >
                    <SelectTrigger data-testid="calendar-select">
                      <SelectValue placeholder="Choose a calendar" />
                    </SelectTrigger>
                    <SelectContent>
                      {calendars.map((cal) => (
                        <SelectItem key={cal.id} value={cal.id}>
                          {cal.summary}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  Events from this calendar will be synced to your dashboard
                </p>
              </div>

              <Separator />

              {/* Info */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Syncing imports events from the past year and next year</p>
                <p>• New events are added as "unbooked" status</p>
                <p>• Existing events won't be overwritten</p>
              </div>
            </>
          )}

          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CalendarDialog;
