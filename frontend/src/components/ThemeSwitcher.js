import { useTheme } from "../context/ThemeContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Check } from "lucide-react";

export const ThemeSwitcher = ({ open, onOpenChange }) => {
  const { theme, setTheme, themes } = useTheme();

  const handleThemeSelect = (themeId) => {
    setTheme(themeId);
    onOpenChange(false);
  };

  // Group themes by light/dark
  const darkThemes = themes.filter((t) => t.isDark);
  const lightThemes = themes.filter((t) => !t.isDark);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>
            Choose Theme
          </DialogTitle>
          <DialogDescription>
            Select a color theme for your dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Dark Themes */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Dark Themes</h4>
            <div className="grid grid-cols-3 gap-3">
              {darkThemes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleThemeSelect(t.id)}
                  className={`
                    relative p-3 rounded-xl border-2 transition-all
                    hover:scale-105 active:scale-95
                    ${theme === t.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/30'}
                  `}
                  style={{ backgroundColor: t.id.includes('blue') ? '#020617' : t.id.includes('purple') ? '#0b051d' : '#022c22' }}
                  data-testid={`theme-${t.id}`}
                >
                  <div
                    className="w-full h-8 rounded-md mb-2"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="text-xs font-medium text-white/80 block truncate">
                    {t.name}
                  </span>
                  {theme === t.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
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
                  onClick={() => handleThemeSelect(t.id)}
                  className={`
                    relative p-3 rounded-xl border-2 transition-all
                    hover:scale-105 active:scale-95
                    ${theme === t.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/30'}
                  `}
                  style={{ backgroundColor: t.id.includes('blue') ? '#f0f9ff' : t.id.includes('purple') ? '#faf5ff' : '#f0fdf4' }}
                  data-testid={`theme-${t.id}`}
                >
                  <div
                    className="w-full h-8 rounded-md mb-2"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="text-xs font-medium text-gray-700 block truncate">
                    {t.name}
                  </span>
                  {theme === t.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

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

export default ThemeSwitcher;
