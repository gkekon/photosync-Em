import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Auth callback component - handles session_id from Emergent OAuth
const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      const hash = location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (sessionIdMatch) {
        const sessionId = sessionIdMatch[1];
        try {
          const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ session_id: sessionId }),
          });

          if (response.ok) {
            const user = await response.json();
            // Store user in localStorage for persistence
            localStorage.setItem("photosync_user", JSON.stringify(user));
            navigate("/dashboard", { state: { user }, replace: true });
          } else {
            navigate("/", { replace: true });
          }
        } catch (error) {
          console.error("Auth error:", error);
          navigate("/", { replace: true });
        }
      }
    };

    processSession();
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg">
      <div className="animate-pulse text-foreground">Authenticating...</div>
    </div>
  );
};

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading, checkAuth, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // If user data was passed from AuthCallback, we're authenticated
    if (location.state?.user) {
      setUser(location.state.user);
      setIsChecking(false);
      return;
    }

    // Try to restore from localStorage first
    const storedUser = localStorage.getItem("photosync_user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (e) {
        localStorage.removeItem("photosync_user");
      }
    }

    const verify = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) {
        localStorage.removeItem("photosync_user");
        navigate("/", { replace: true });
      }
      setIsChecking(false);
    };

    verify();
  }, [location.state, checkAuth, navigate, setUser]);

  if (isChecking || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    );
  }

  return children;
};

// Main app router with synchronous session_id detection
const AppRouter = () => {
  const location = useLocation();

  // Check URL fragment synchronously during render (prevents race conditions)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
