import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar as CalendarIcon, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useTheme } from "../context/ThemeContext";

export const EventSheet = ({ open, onOpenChange, event, packages, onSave, onDelete, formatCurrency }) => {
  const { currentTheme } = useTheme();
  const isEdit = !!event?.event_id;

  const [formData, setFormData] = useState({
    date: "",
    name: "",
    has_video: false,
    info: "",
    package_id: "",
    package_name: "",
    deposit: false,
    deposit_amount: 0,
    attached_offers: "",
    location: "",
    total_offer_price: 0,
    photo_offer_price: 0,
    video_offer_price: 0,
    costs: 0,
    status: "unbooked",
    google_calendar_event_id: "",
  });

  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    if (event) {
      setFormData({
        date: event.date || "",
        name: event.name || "",
        has_video: event.has_video || false,
        info: event.info || "",
        package_id: event.package_id || "",
        package_name: event.package_name || "",
        deposit: event.deposit || false,
        deposit_amount: event.deposit_amount || 0,
        attached_offers: event.attached_offers || "",
        location: event.location || "",
        total_offer_price: event.total_offer_price || 0,
        photo_offer_price: event.photo_offer_price || 0,
        video_offer_price: event.video_offer_price || 0,
        costs: event.costs || 0,
        status: event.status || "unbooked",
        google_calendar_event_id: event.google_calendar_event_id || "",
      });
    } else {
      setFormData({
        date: format(new Date(), "yyyy-MM-dd"),
        name: "",
        has_video: false,
        info: "",
        package_id: "",
        package_name: "",
        deposit: false,
        deposit_amount: 0,
        attached_offers: "",
        location: "",
        total_offer_price: 0,
        photo_offer_price: 0,
        video_offer_price: 0,
        costs: 0,
        status: "unbooked",
        google_calendar_event_id: "",
      });
    }
  }, [event, open]);

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate total from photo + video prices
      if (field === "photo_offer_price" || field === "video_offer_price") {
        const photo = field === "photo_offer_price" ? parseFloat(value) || 0 : parseFloat(prev.photo_offer_price) || 0;
        const video = field === "video_offer_price" ? parseFloat(value) || 0 : parseFloat(prev.video_offer_price) || 0;
        updated.total_offer_price = photo + video;
      }
      
      return updated;
    });
  };

  const handlePackageSelect = (packageId) => {
    const pkg = packages.find((p) => p.package_id === packageId);
    if (pkg) {
      setFormData((prev) => ({
        ...prev,
        package_id: packageId,
        package_name: pkg.name,
        photo_offer_price: pkg.photo_price,
        video_offer_price: pkg.video_price,
        total_offer_price: pkg.total_price,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        package_id: "",
        package_name: "",
      }));
    }
  };

  const handleDateSelect = (date) => {
    if (date) {
      setFormData((prev) => ({
        ...prev,
        date: format(date, "yyyy-MM-dd"),
      }));
      setCalendarOpen(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleDeleteClick = () => {
    if (window.confirm("Are you sure you want to delete this event?")) {
      onDelete(event.event_id);
    }
  };

  const clearIncome = (formData.total_offer_price || 0) - (formData.costs || 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={`w-full sm:max-w-lg overflow-y-auto ${currentTheme.isDark ? 'glass' : ''}`}>
        <SheetHeader>
          <SheetTitle style={{ fontFamily: 'Outfit, sans-serif' }}>
            {isEdit ? "Edit Event" : "New Event"}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? "Update event details and pricing" : "Add a new wedding or event booking"}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Date & Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="event-date-picker"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date || "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date ? parseISO(formData.date) : undefined}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange("status", value)}
              >
                <SelectTrigger data-testid="event-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unbooked">Unbooked</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Event Name</Label>
            <div className="flex items-center gap-3">
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Wedding of John & Jane"
                required
                className="flex-1"
                data-testid="event-name-input"
              />
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background">
                <Switch
                  id="has_video"
                  checked={formData.has_video}
                  onCheckedChange={(checked) => handleChange("has_video", checked)}
                  data-testid="event-has-video-switch"
                />
                <Label htmlFor="has_video" className="text-sm cursor-pointer whitespace-nowrap">Video</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleChange("location", e.target.value)}
              placeholder="Venue name or address"
              data-testid="event-location-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="info">Additional Info</Label>
            <Textarea
              id="info"
              value={formData.info}
              onChange={(e) => handleChange("info", e.target.value)}
              placeholder="Notes about the event..."
              rows={2}
              data-testid="event-info-textarea"
            />
          </div>

          <Separator />

          {/* Package Selection */}
          <div className="space-y-2">
            <Label>Package</Label>
            <Select
              value={formData.package_id || "none"}
              onValueChange={handlePackageSelect}
            >
              <SelectTrigger data-testid="event-package-select">
                <SelectValue placeholder="Select a package (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No package</SelectItem>
                {packages.map((pkg) => (
                  <SelectItem key={pkg.package_id} value={pkg.package_id}>
                    {pkg.name} - {formatCurrency(pkg.total_price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Pricing (EUR)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="photo_price" className="text-sm text-muted-foreground">Photo Price</Label>
                <Input
                  id="photo_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.photo_offer_price}
                  onChange={(e) => handleChange("photo_offer_price", parseFloat(e.target.value) || 0)}
                  className="tabular-nums"
                  data-testid="event-photo-price-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video_price" className="text-sm text-muted-foreground">Video Price</Label>
                <Input
                  id="video_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.video_offer_price}
                  onChange={(e) => handleChange("video_offer_price", parseFloat(e.target.value) || 0)}
                  className="tabular-nums"
                  data-testid="event-video-price-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_price" className="text-sm text-muted-foreground">Total Offer Price</Label>
                <Input
                  id="total_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.total_offer_price}
                  onChange={(e) => handleChange("total_offer_price", parseFloat(e.target.value) || 0)}
                  className="tabular-nums"
                  data-testid="event-total-price-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costs" className="text-sm text-muted-foreground">Costs</Label>
                <Input
                  id="costs"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costs}
                  onChange={(e) => handleChange("costs", parseFloat(e.target.value) || 0)}
                  className="tabular-nums"
                  data-testid="event-costs-input"
                />
              </div>
            </div>
          </div>

          {/* Clear Income Display */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Clear Income</span>
              <span className="text-xl font-bold tabular-nums text-primary" data-testid="event-clear-income">
                {formatCurrency(clearIncome)}
              </span>
            </div>
          </div>

          <Separator />

          {/* Deposit */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="deposit">Deposit Received</Label>
              <Switch
                id="deposit"
                checked={formData.deposit}
                onCheckedChange={(checked) => handleChange("deposit", checked)}
                data-testid="event-deposit-switch"
              />
            </div>
            {formData.deposit && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="deposit_amount" className="text-sm text-muted-foreground">Deposit Amount</Label>
                <Input
                  id="deposit_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.deposit_amount}
                  onChange={(e) => handleChange("deposit_amount", parseFloat(e.target.value) || 0)}
                  className="tabular-nums"
                  data-testid="event-deposit-amount-input"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="attached_offers">Attached Offers</Label>
            <Input
              id="attached_offers"
              value={formData.attached_offers}
              onChange={(e) => handleChange("attached_offers", e.target.value)}
              placeholder="e.g., Photo album, Drone footage..."
              data-testid="event-offers-input"
            />
          </div>

          {/* Google Calendar Event ID (read-only if exists) */}
          {formData.google_calendar_event_id && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Google Calendar Event ID</Label>
              <Input
                value={formData.google_calendar_event_id}
                disabled
                className="text-xs font-mono"
              />
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-3">
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteClick}
                className="gap-2"
                data-testid="event-delete-btn"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" data-testid="event-save-btn">
              {isEdit ? "Update" : "Create"} Event
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default EventSheet;
