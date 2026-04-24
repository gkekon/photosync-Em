import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Check, X, MapPin, Video, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { apiFetch } from "../utils/api";

const SortableHeader = ({ label, sortKey, currentSort, onSort, className = "", children }) => {
  const isActive = currentSort.key === sortKey;
  const icon = isActive
    ? currentSort.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
    : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40" />;

  return (
    <TableHead
      className={`text-muted-foreground font-medium cursor-pointer select-none group hover:text-foreground transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
      data-testid={`sort-${sortKey}`}
    >
      <div className="flex items-center gap-1">
        {children || label}
        {icon}
      </div>
    </TableHead>
  );
};

export const EventsTable = ({ events, packages, onEdit, formatCurrency, onRefresh }) => {
  const { currentTheme } = useTheme();
  const [sort, setSort] = useState({ key: "date", dir: "asc" });

  const handleSort = (key) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  const getPackageName = (packageId) => {
    const pkg = packages.find((p) => p.package_id === packageId);
    return pkg?.name || "-";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "booked":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "completed":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "unbooked":
      default:
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    }
  };

  const statusOrder = { completed: 0, booked: 1, unbooked: 2 };

  // Sort events
  const sortedEvents = [...events].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    switch (sort.key) {
      case "date":
        return (a.date || "").localeCompare(b.date || "") * dir;
      case "name":
        return (a.name || "").localeCompare(b.name || "") * dir;
      case "status":
        return ((statusOrder[a.status] || 2) - (statusOrder[b.status] || 2)) * dir;
      case "offer_price":
        return ((a.total_offer_price || 0) - (b.total_offer_price || 0)) * dir;
      case "income":
        return ((a.clear_income || 0) - (b.clear_income || 0)) * dir;
      case "deposit":
        return ((a.deposit ? 1 : 0) - (b.deposit ? 1 : 0)) * dir;
      default:
        return 0;
    }
  });

  // Quick toggle for video checkbox
  const handleVideoToggle = async (event, checked) => {
    try {
      await apiFetch(`/api/events/${event.event_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ has_video: checked }),
      });
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Error updating video status:", error);
    }
  };

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground" data-testid="empty-events-message">
        <p className="text-lg mb-2">No events yet</p>
        <p className="text-sm">Add your first event or sync from Google Calendar</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table data-testid="events-table">
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <SortableHeader label="Date" sortKey="date" currentSort={sort} onSort={handleSort} />
            <SortableHeader label="Name" sortKey="name" currentSort={sort} onSort={handleSort} />
            <TableHead className="text-muted-foreground font-medium text-center w-[60px]">
              <Video className="w-4 h-4 mx-auto" />
            </TableHead>
            <TableHead className="text-muted-foreground font-medium hidden md:table-cell">Package</TableHead>
            <TableHead className="text-muted-foreground font-medium hidden lg:table-cell">Location</TableHead>
            <SortableHeader label="Deposit" sortKey="deposit" currentSort={sort} onSort={handleSort} className="text-center" />
            <SortableHeader label="Offer Price" sortKey="offer_price" currentSort={sort} onSort={handleSort} className="text-right hidden sm:table-cell" />
            <SortableHeader label="Income" sortKey="income" currentSort={sort} onSort={handleSort} className="text-right" />
            <SortableHeader label="Status" sortKey="status" currentSort={sort} onSort={handleSort} className="text-center" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedEvents.map((event, index) => (
            <TableRow
              key={event.event_id}
              className="cursor-pointer border-border hover:bg-accent/50 transition-colors"
              data-testid={`event-row-${event.event_id}`}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <TableCell 
                className="font-mono text-xs text-muted-foreground whitespace-nowrap"
                onClick={() => onEdit(event)}
              >
                {event.date}
              </TableCell>
              <TableCell 
                className="font-medium text-foreground max-w-[200px] truncate"
                onClick={() => onEdit(event)}
              >
                {event.name}
              </TableCell>
              <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={event.has_video || false}
                  onCheckedChange={(checked) => handleVideoToggle(event, checked)}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  data-testid={`video-checkbox-${event.event_id}`}
                />
              </TableCell>
              <TableCell className="hidden md:table-cell" onClick={() => onEdit(event)}>
                {event.package_id || event.package_name ? (
                  <Badge variant="outline" className="font-normal">
                    {event.package_name || getPackageName(event.package_id)}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell max-w-[150px] truncate" onClick={() => onEdit(event)}>
                {event.location ? (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {event.location}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-center" onClick={() => onEdit(event)}>
                {event.deposit ? (
                  <div className="flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-400" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <X className="w-4 h-4 text-red-400" />
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums hidden sm:table-cell" onClick={() => onEdit(event)}>
                {formatCurrency(event.total_offer_price)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums font-semibold text-primary" onClick={() => onEdit(event)}>
                {formatCurrency(event.clear_income)}
              </TableCell>
              <TableCell className="text-center" onClick={() => onEdit(event)}>
                <Badge className={`${getStatusColor(event.status)} capitalize text-xs`}>
                  {event.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default EventsTable;
