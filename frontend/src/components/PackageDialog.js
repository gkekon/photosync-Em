import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Separator } from "../components/ui/separator";
import { Trash2 } from "lucide-react";

export const PackageDialog = ({ open, onOpenChange, package: pkg, onSave, onDelete }) => {
  const isEdit = !!pkg?.package_id;

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    photo_price: 0,
    video_price: 0,
    total_price: 0,
  });

  useEffect(() => {
    if (pkg) {
      setFormData({
        name: pkg.name || "",
        description: pkg.description || "",
        photo_price: pkg.photo_price || 0,
        video_price: pkg.video_price || 0,
        total_price: pkg.total_price || 0,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        photo_price: 0,
        video_price: 0,
        total_price: 0,
      });
    }
  }, [pkg, open]);

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate total from photo + video prices
      if (field === "photo_price" || field === "video_price") {
        const photo = field === "photo_price" ? parseFloat(value) || 0 : parseFloat(prev.photo_price) || 0;
        const video = field === "video_price" ? parseFloat(value) || 0 : parseFloat(prev.video_price) || 0;
        updated.total_price = photo + video;
      }
      
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleDeleteClick = () => {
    if (window.confirm("Are you sure you want to delete this package?")) {
      onDelete(pkg.package_id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>
            {isEdit ? "Edit Package" : "New Package"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Update package details and pricing" : "Create a reusable pricing package"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="pkg-name">Package Name</Label>
            <Input
              id="pkg-name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g., Premium Wedding Package"
              required
              data-testid="package-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pkg-description">Description</Label>
            <Textarea
              id="pkg-description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="What's included in this package..."
              rows={2}
              data-testid="package-description-input"
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <Label className="text-base font-semibold">Pricing (EUR)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pkg-photo" className="text-sm text-muted-foreground">Photo Price</Label>
                <Input
                  id="pkg-photo"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.photo_price}
                  onChange={(e) => handleChange("photo_price", parseFloat(e.target.value) || 0)}
                  className="tabular-nums"
                  data-testid="package-photo-price-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pkg-video" className="text-sm text-muted-foreground">Video Price</Label>
                <Input
                  id="pkg-video"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.video_price}
                  onChange={(e) => handleChange("video_price", parseFloat(e.target.value) || 0)}
                  className="tabular-nums"
                  data-testid="package-video-price-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-total" className="text-sm text-muted-foreground">Total Package Price</Label>
              <Input
                id="pkg-total"
                type="number"
                step="0.01"
                min="0"
                value={formData.total_price}
                onChange={(e) => handleChange("total_price", parseFloat(e.target.value) || 0)}
                className="tabular-nums text-lg font-semibold"
                data-testid="package-total-price-input"
              />
            </div>
          </div>

          <Separator />

          <div className="flex gap-3">
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteClick}
                className="gap-2"
                data-testid="package-delete-btn"
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
            <Button type="submit" className="flex-1" data-testid="package-save-btn">
              {isEdit ? "Update" : "Create"} Package
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PackageDialog;
