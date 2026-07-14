export const PRIORITY_ORDER = {
  urgent: 0,
  red: 1,
  orange: 2,
  blue: 3,
};

export const PRIORITY_META = {
  urgent: {
    label: "Urgent !",
    shortLabel: "!",
    tableClass: "bg-red-500 text-white border-red-400",
    badgeClass: "bg-red-500/20 text-red-300 border-red-500/40",
    accentClass: "border-l-red-500",
    barClass: "bg-red-500",
  },
  red: {
    label: "Red",
    shortLabel: "Red",
    tableClass: "bg-red-500/20 text-red-300 border-red-500/40",
    badgeClass: "bg-red-500/20 text-red-300 border-red-500/40",
    accentClass: "border-l-red-500",
    barClass: "bg-red-500",
  },
  orange: {
    label: "Orange",
    shortLabel: "Orange",
    tableClass: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    badgeClass: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    accentClass: "border-l-orange-500",
    barClass: "bg-orange-500",
  },
  blue: {
    label: "Blue",
    shortLabel: "Blue",
    tableClass: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    badgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    accentClass: "border-l-sky-500",
    barClass: "bg-sky-500",
  },
};

export const PAYMENT_META = {
  paid: {
    label: "Paid",
    className: "bg-green-500/20 text-green-300 border-green-500/40",
  },
  partial: {
    label: "Partial",
    className: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  },
  unpaid: {
    label: "Unpaid",
    className: "bg-red-500/20 text-red-300 border-red-500/40",
  },
};

export const normalizePriority = (priority) => {
  const value = (priority || "").toLowerCase();
  return PRIORITY_META[value] ? value : "";
};

export const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export const daysUntil = (dateString) => {
  if (!dateString) return null;
  const deadline = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(deadline.getTime())) return null;
  const diff = deadline.getTime() - getToday().getTime();
  return Math.ceil(diff / 86400000);
};

export const getAutoPriority = (dateString) => {
  const days = daysUntil(dateString);
  if (days === null) return "";
  if (days <= 3) return "urgent";
  if (days <= 7) return "red";
  if (days <= 14) return "orange";
  return "blue";
};

export const getEventPriority = (event) => {
  if (!event || event.delivered) return "blue";
  return normalizePriority(event.delivery_priority) || getAutoPriority(event.delivery_deadline) || "blue";
};

export const getPriorityMeta = (priority) => {
  return PRIORITY_META[normalizePriority(priority) || "blue"];
};

export const getDeliveryTimingLabel = (event) => {
  if (event?.delivered) return "Delivered";
  const days = daysUntil(event?.delivery_deadline);
  if (days === null) return "No deadline";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days}d left`;
};

export const getPaidAmount = (event) => {
  if (!event) return 0;
  if (event.paid_amount !== undefined && event.paid_amount !== null) {
    return Number(event.paid_amount) || 0;
  }
  if (event.deposit) {
    return Number(event.deposit_amount) || 0;
  }
  return 0;
};

export const getAmountDue = (event) => {
  const total = Number(event?.total_offer_price) || 0;
  return Math.max(total - getPaidAmount(event), 0);
};

export const getPaymentStatus = (event) => {
  const total = Number(event?.total_offer_price) || 0;
  const paid = getPaidAmount(event);
  if (total <= 0) return "unpaid";
  if (paid >= total) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
};

export const sortByDeliveryPriority = (a, b) => {
  const priorityDelta = PRIORITY_ORDER[getEventPriority(a)] - PRIORITY_ORDER[getEventPriority(b)];
  if (priorityDelta !== 0) return priorityDelta;
  const aDays = daysUntil(a.delivery_deadline);
  const bDays = daysUntil(b.delivery_deadline);
  if (aDays === null && bDays === null) return (a.date || "").localeCompare(b.date || "");
  if (aDays === null) return 1;
  if (bDays === null) return -1;
  return aDays - bDays;
};
