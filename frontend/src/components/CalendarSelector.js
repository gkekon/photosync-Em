import { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Calendar, ChevronDown, Check } from "lucide-react";
import { apiFetch } from "../utils/api";

export const CalendarSelector = ({ selectedCalendar, onCalendarChange }) => {
  const [sources, setSources] = useState([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [untaggedCount, setUntaggedCount] = useState(0);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const response = await apiFetch("/api/events/sources");
      if (response.ok) {
        const data = await response.json();
        setSources(data.sources);
        setTotalEvents(data.total);
        setUntaggedCount(data.untagged_count);
      }
    } catch (error) {
      console.error("Error fetching sources:", error);
    }
  };

  const currentLabel = () => {
    if (!selectedCalendar || selectedCalendar === "all") return "All Calendars";
    const source = sources.find((s) => s.id === selectedCalendar);
    return source?.name || "Unknown";
  };

  const currentCount = () => {
    if (!selectedCalendar || selectedCalendar === "all") return totalEvents;
    const source = sources.find((s) => s.id === selectedCalendar);
    return source?.count || 0;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 max-w-[220px]"
          data-testid="calendar-selector-btn"
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span className="truncate">{currentLabel()}</span>
          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 shrink-0">
            {currentCount()}
          </Badge>
          <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Filter by Calendar
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* All calendars */}
        <DropdownMenuItem
          onClick={() => onCalendarChange("all")}
          className="gap-2"
          data-testid="calendar-option-all"
        >
          <div className="flex-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>All Calendars</span>
          </div>
          <span className="text-xs text-muted-foreground">{totalEvents}</span>
          {(!selectedCalendar || selectedCalendar === "all") && (
            <Check className="w-4 h-4 text-primary" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Individual calendars */}
        {sources.map((source) => (
          <DropdownMenuItem
            key={source.id}
            onClick={() => onCalendarChange(source.id)}
            className="gap-2"
            data-testid={`calendar-option-${source.name.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    source.name === "Wedding Photography"
                      ? "#22c55e"
                      : source.name === "Personal"
                      ? "#3b82f6"
                      : "#f59e0b",
                }}
              />
              <span className="truncate">{source.name}</span>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{source.count}</span>
            {selectedCalendar === source.id && (
              <Check className="w-4 h-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}

        {/* Untagged events */}
        {untaggedCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onCalendarChange("untagged")}
              className="gap-2"
              data-testid="calendar-option-untagged"
            >
              <div className="flex-1 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0 bg-muted-foreground/30" />
                <span>Manually Added</span>
              </div>
              <span className="text-xs text-muted-foreground">{untaggedCount}</span>
              {selectedCalendar === "untagged" && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CalendarSelector;
