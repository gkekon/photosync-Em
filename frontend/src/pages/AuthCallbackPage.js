import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../utils/api";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processToken = async () => {
      const token = searchParams.get("session_token");

      if (!token) {
        navigate("/", { replace: true });
        return;
      }

      // Save token to localStorage
      localStorage.setItem("photosync_session_token", token);

      // Verify the token works by calling /api/auth/me
      try {
        const response = await apiFetch("/api/auth/me");
        if (response.ok) {
          const userData = await response.json();
          localStorage.setItem("photosync_user", JSON.stringify(userData));
          setUser(userData);
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch (error) {
        console.error("Auth callback error:", error);
      }

      // If verification failed, clean up and go to login
      localStorage.removeItem("photosync_session_token");
      localStorage.removeItem("photosync_user");
      navigate("/?auth_error=verification_failed", { replace: true });
    };

    processToken();
  }, [searchParams, navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg">
      <div className="animate-pulse text-foreground">Signing you in...</div>
    </div>
  );
}
