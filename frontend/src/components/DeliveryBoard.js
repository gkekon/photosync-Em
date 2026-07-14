import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { useTheme } from "../context/ThemeContext";
import {
  PAYMENT_META,
  getAmountDue,
  getDeliveryTimingLabel,
  getEventPriority,
  getPaymentStatus,
  getPriorityMeta,
  sortByDeliveryPriority,
  daysUntil,
} from "../utils/delivery";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, CreditCard, FileText } from "lucide-react";

const PRIORITY_LANES = ["urgent", "red", "orange", "blue"];

export const DeliveryBoard = ({ events, onEdit, formatCurrency }) => {
  const { currentTheme } = useTheme();
  const pendingEvents = events
    .filter((event) => !event.delivered)
    .sort(sortByDeliveryPriority);

  const groupedEvents = PRIORITY_LANES.reduce((groups, priority) => {
    groups[priority] = pendingEvents.filter((event) => getEventPriority(event) === priority);
    return groups;
  }, {});

  const overdueCount = pendingEvents.filter((event) => {
    const days = daysUntil(event.delivery_deadline);
    return days !== null && days < 0;
  }).length;

  const dueThisWeekCount = pendingEvents.filter((event) => {
    const days = daysUntil(event.delivery_deadline);
    return days !== null && days >= 0 && days <= 7;
  }).length;

  const openBalance = pendingEvents.reduce((sum, event) => sum + getAmountDue(event), 0);
  const maxLaneCount = Math.max(...PRIORITY_LANES.map((priority) => groupedEvents[priority].length), 1);

  if (pendingEvents.length === 0) {
    return (
      <Card className={`${currentTheme.isDark ? "glass" : "glass-light"} border-border`}>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-400" />
          <p className="text-lg font-semibold text-foreground">All deliveries are marked done</p>
          <p className="text-sm text-muted-foreground mt-1">Open an event to add a new deadline or delivery note.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="deliveries-panel">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={`${currentTheme.isDark ? "glass" : "glass-light"} border-border`}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Overdue
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{overdueCount}</p>
          </CardContent>
        </Card>
        <Card className={`${currentTheme.isDark ? "glass" : "glass-light"} border-border`}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-orange-400" />
              Due in 7 days
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{dueThisWeekCount}</p>
          </CardContent>
        </Card>
        <Card className={`${currentTheme.isDark ? "glass" : "glass-light"} border-border`}>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-sky-400" />
              Open balance
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{formatCurrency(openBalance)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {PRIORITY_LANES.map((priority) => {
          const meta = getPriorityMeta(priority);
          const laneEvents = groupedEvents[priority];
          const lanePercent = Math.round((laneEvents.length / maxLaneCount) * 100);

          return (
            <Card key={priority} className={`${currentTheme.isDark ? "glass" : "glass-light"} border-border`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${meta.barClass}`} />
                    {meta.label}
                  </span>
                  <Badge variant="secondary">{laneEvents.length}</Badge>
                </CardTitle>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${meta.barClass}`} style={{ width: `${lanePercent}%` }} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {laneEvents.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center">No jobs here</div>
                ) : (
                  laneEvents.map((event) => {
                    const paymentStatus = getPaymentStatus(event);
                    const paymentMeta = PAYMENT_META[paymentStatus];
                    const amountDue = getAmountDue(event);

                    return (
                      <button
                        key={event.event_id}
                        type="button"
                        onClick={() => onEdit(event)}
                        className={`w-full text-left rounded-md border border-border border-l-4 ${meta.accentClass} bg-background/70 p-3 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                        data-testid={`delivery-card-${event.event_id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{event.name}</p>
                            <p className="text-xs text-muted-foreground tabular-nums mt-1">{event.date}</p>
                          </div>
                          <Badge className={`${meta.badgeClass} text-xs shrink-0`}>{meta.shortLabel}</Badge>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{getDeliveryTimingLabel(event)}</span>
                          {event.delivery_deadline && <span className="tabular-nums">({event.delivery_deadline})</span>}
                        </div>
                        {event.delivery_notes && (
                          <p className="mt-2 flex gap-2 text-xs text-muted-foreground">
                            <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{event.delivery_notes}</span>
                          </p>
                        )}
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <Badge className={`${paymentMeta.className} text-xs`}>{paymentMeta.label}</Badge>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {amountDue > 0 ? formatCurrency(amountDue) : "No balance"}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => pendingEvents[0] && onEdit(pendingEvents[0])}>
          Open next delivery
        </Button>
      </div>
    </div>
  );
};

export default DeliveryBoard;
