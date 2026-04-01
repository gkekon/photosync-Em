import { createContext, useContext, useState, useCallback, useEffect } from "react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Try to restore user from localStorage on initial load
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
      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        credentials: "include",
      });
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
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setUser(null);
    localStorage.removeItem("photosync_user");
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
