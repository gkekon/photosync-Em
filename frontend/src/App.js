import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import "./App.css";

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading, checkAuth, setUser } = useAuth();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Try to restore from localStorage first
    const storedUser = localStorage.getItem("photosync_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem("photosync_user");
      }
    }

    const verify = async () => {
      const authenticated = await checkAuth();
      if (!authenticated) {
        localStorage.removeItem("photosync_user");
        navigate("/", { replace: true });
        return;
      }
      setIsChecking(false);
    };

    verify();
  }, [checkAuth, navigate, setUser]);

  if (isChecking || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="animate-pulse text-foreground">Loading...</div>
      </div>
    );
  }

  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
