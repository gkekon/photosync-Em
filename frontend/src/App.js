import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
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
        localStorage.removeItem("photosync_session_token");
        navigate("/", { replace: true });
        return; // Don't set isChecking=false, prevent dashboard flash
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
