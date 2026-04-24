import { useState, useRef } from "react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, X, AlertTriangle, Loader2 } from "lucide-react";
import { apiFetch } from "../utils/api";

export const CsvImportPanel = ({ onImportComplete }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith(".csv")) {
      toast.error("Please select a CSV file");
      return;
    }
    setFile(selectedFile);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await apiFetch("/api/import/preview", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setPreview(data);
      } else {
        toast.error("Failed to parse CSV file");
        setFile(null);
      }
    } catch (error) {
      console.error("Preview error:", error);
      toast.error("Failed to parse CSV file");
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const handleImport = async (skipDuplicates = true) => {
    if (!preview) return;
    setImporting(true);

    try {
      const response = await apiFetch("/api/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: preview.events,
          skip_duplicates: skipDuplicates,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(`Imported ${result.imported} events${result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ""}`);
        setFile(null);
        setPreview(null);
        if (onImportComplete) onImportComplete();
      } else {
        toast.error("Import failed");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount || 0);
  };

  // No file selected - show drop zone
  if (!file) {
    return (
      <div className="space-y-4">
        <div
          className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          data-testid="csv-drop-zone"
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">Drop a CSV file here</p>
          <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
          <p className="text-xs text-muted-foreground/60 mt-3">
            Supports PhotoSync export format and common CSV layouts
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files[0])}
          data-testid="csv-file-input"
        />
      </div>
    );
  }

  // Loading preview
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Analyzing CSV...</span>
      </div>
    );
  }

  // Preview loaded
  if (preview) {
    const newEvents = preview.events.filter((e) => !e._is_duplicate);
    const dupEvents = preview.events.filter((e) => e._is_duplicate);
    const bookedNew = newEvents.filter((e) => e.status === "booked" || e.status === "completed");
    const unbookedNew = newEvents.filter((e) => e.status === "unbooked");

    return (
      <div className="space-y-4">
        {/* File info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{preview.total_parsed} events found</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleReset} data-testid="csv-reset-btn">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-lg bg-green-500/10 text-center">
            <p className="text-lg font-bold text-green-500" data-testid="csv-new-count">{preview.new_events}</p>
            <p className="text-xs text-muted-foreground">New</p>
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/10 text-center">
            <p className="text-lg font-bold text-yellow-500" data-testid="csv-dup-count">{preview.duplicates}</p>
            <p className="text-xs text-muted-foreground">Duplicates</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-center">
            <p className="text-lg font-bold text-blue-500">{bookedNew.length}</p>
            <p className="text-xs text-muted-foreground">Booked</p>
          </div>
        </div>

        {/* Preview list */}
        {newEvents.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2">Events to import ({newEvents.length})</h4>
              <ScrollArea className="h-48 rounded-lg border border-border">
                <div className="p-2 space-y-1">
                  {newEvents.slice(0, 50).map((evt, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/50">
                      <span className="text-muted-foreground w-20 shrink-0 tabular-nums">{evt.date}</span>
                      <span className="flex-1 truncate">{evt.name}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {evt.status}
                      </Badge>
                      {evt.total_offer_price > 0 && (
                        <span className="text-muted-foreground shrink-0 tabular-nums">
                          {formatCurrency(evt.total_offer_price)}
                        </span>
                      )}
                    </div>
                  ))}
                  {newEvents.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      ...and {newEvents.length - 50} more
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        {/* Duplicate warning */}
        {dupEvents.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium">{dupEvents.length} events already exist</p>
              <p className="text-xs text-muted-foreground">
                These will be skipped to avoid duplicates
              </p>
            </div>
          </div>
        )}

        {/* Import button */}
        <div className="flex gap-2">
          <Button
            onClick={() => handleImport(true)}
            disabled={importing || preview.new_events === 0}
            className="flex-1 gap-2"
            data-testid="csv-import-btn"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {importing ? "Importing..." : `Import ${preview.new_events} Events`}
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={importing}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default CsvImportPanel;
