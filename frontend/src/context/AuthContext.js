import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { apiFetch, BACKEND_URL } from "../utils/api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
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
    const token = localStorage.getItem("photosync_session_token");
    if (!token) {
      setUser(null);
      return false;
    }

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
      return false;
    } catch (error) {
      console.error("Auth check error:", error);
      setUser(null);
      localStorage.removeItem("photosync_user");
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
