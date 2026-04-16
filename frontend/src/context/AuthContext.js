import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { apiFetch, BACKEND_URL } from "../utils/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Handle session_token from URL SYNCHRONOUSLY (before any effects)
    const params = new URLSearchParams(window.location.search);
    const token = params.get("session_token");
    if (token) {
      localStorage.setItem("photosync_session_token", token);
      // Clean the URL
      params.delete("session_token");
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, "", newUrl);
    }

    // Try to restore user from localStorage
    const stored = localStorage.getItem("photosync_user");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  // Update localStorage whenever user changes
  useEffect(() => {
    if (user) {
      localStorage.setItem("photosync_user", JSON.stringify(user));
    }
  }, [user]);

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/auth/me");
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        return true;
      }
      setUser(null);
      localStorage.removeItem("photosync_user");
      localStorage.removeItem("photosync_session_token");
      return false;
    } catch (error) {
      console.error("Auth check error:", error);
      setUser(null);
      localStorage.removeItem("photosync_user");
      localStorage.removeItem("photosync_session_token");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = () => {
    window.location.href = `${BACKEND_URL}/api/auth/google/login`;
  };

  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setUser(null);
    localStorage.removeItem("photosync_user");
    localStorage.removeItem("photosync_session_token");
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, checkAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
