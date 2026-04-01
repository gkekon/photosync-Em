import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

const THEMES = [
  { id: "theme-blue-dark", name: "Sapphire Night", color: "#38bdf8", isDark: true },
  { id: "theme-purple-dark", name: "Amethyst Void", color: "#c084fc", isDark: true },
  { id: "theme-green-dark", name: "Emerald Deep", color: "#34d399", isDark: true },
  { id: "theme-blue-light", name: "Cerulean Mist", color: "#0284c7", isDark: false },
  { id: "theme-purple-light", name: "Lavender Haze", color: "#9333ea", isDark: false },
  { id: "theme-green-light", name: "Sage Morning", color: "#16a34a", isDark: false },
];

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("app-theme");
    return saved || "theme-blue-dark";
  });

  useEffect(() => {
    localStorage.setItem("app-theme", theme);
    // Remove all theme classes and add current one
    document.documentElement.classList.remove(...THEMES.map(t => t.id));
    document.documentElement.classList.add(theme);
  }, [theme]);

  const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, currentTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
