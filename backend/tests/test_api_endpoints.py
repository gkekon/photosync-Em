"""
Backend API Tests for Wedding Photography Dashboard
Tests: Health check, Google OAuth, CORS, Auth-protected endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://photo-sync-dashboard.preview.emergentagent.com').rstrip('/')

class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_returns_healthy(self):
        """GET /api/health returns {status: healthy}"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"


class TestGoogleOAuthLogin:
    """Google OAuth login redirect tests"""
    
    def test_google_login_redirects_to_google(self):
        """GET /api/auth/google/login returns 307 redirect to accounts.google.com"""
        response = requests.get(f"{BASE_URL}/api/auth/google/login", allow_redirects=False)
        assert response.status_code == 307
        
        # Check redirect location
        location = response.headers.get("Location", "")
        assert "accounts.google.com" in location
        
    def test_google_login_has_correct_client_id(self):
        """OAuth redirect URL contains correct client_id starting with 153601226750-"""
        response = requests.get(f"{BASE_URL}/api/auth/google/login", allow_redirects=False)
        location = response.headers.get("Location", "")
        
        # Verify client_id is in the URL
        assert "client_id=" in location
        assert "153601226750-" in location


class TestAuthMeEndpoint:
    """Auth/me endpoint tests"""
    
    def test_auth_me_without_token_returns_401(self):
        """GET /api/auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        
    def test_auth_me_with_invalid_token_returns_401(self):
        """GET /api/auth/me with invalid token returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        assert response.status_code == 401


class TestCORSHeaders:
    """CORS configuration tests"""
    
    def test_cors_returns_specific_origin(self):
        """CORS returns specific origin (not wildcard *) with credentials=true"""
        frontend_origin = "https://photo-sync-dashboard.preview.emergentagent.com"
        
        # Send OPTIONS preflight request
        response = requests.options(
            f"{BASE_URL}/api/health",
            headers={
                "Origin": frontend_origin,
                "Access-Control-Request-Method": "GET"
            }
        )
        
        # Check CORS headers
        cors_origin = response.headers.get("Access-Control-Allow-Origin", "")
        cors_credentials = response.headers.get("Access-Control-Allow-Credentials", "")
        
        # Should NOT be wildcard * when credentials are used
        assert cors_origin != "*", "CORS should not use wildcard * with credentials"
        # Should be the specific origin or empty (if not allowed)
        if cors_origin:
            assert cors_origin == frontend_origin or cors_origin in ["https://photo-sync-dashboard.preview.emergentagent.com"]
        
    def test_cors_allows_credentials(self):
        """CORS allows credentials"""
        frontend_origin = "https://photo-sync-dashboard.preview.emergentagent.com"
        
        response = requests.options(
            f"{BASE_URL}/api/auth/me",
            headers={
                "Origin": frontend_origin,
                "Access-Control-Request-Method": "GET"
            }
        )
        
        cors_credentials = response.headers.get("Access-Control-Allow-Credentials", "")
        # Credentials should be true
        assert cors_credentials.lower() == "true", f"Expected credentials=true, got {cors_credentials}"


class TestEventsEndpoint:
    """Events CRUD API tests (auth required)"""
    
    def test_get_events_without_auth_returns_401(self):
        """GET /api/events without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/events")
        assert response.status_code == 401
        
    def test_post_events_without_auth_returns_401(self):
        """POST /api/events without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/events",
            json={"date": "2025-06-15", "name": "Test Event"}
        )
        assert response.status_code == 401


class TestPackagesEndpoint:
    """Packages CRUD API tests (auth required)"""
    
    def test_get_packages_without_auth_returns_401(self):
        """GET /api/packages without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/packages")
        assert response.status_code == 401
        
    def test_post_packages_without_auth_returns_401(self):
        """POST /api/packages without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/packages",
            json={"name": "Test Package", "total_price": 1000}
        )
        assert response.status_code == 401


class TestIncomeSummaryEndpoint:
    """Income summary API tests (auth required)"""
    
    def test_income_summary_without_auth_returns_401(self):
        """GET /api/income/summary without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/income/summary")
        assert response.status_code == 401


class TestCalendarStatusEndpoint:
    """Calendar status API tests (auth required)"""
    
    def test_calendar_status_without_auth_returns_401(self):
        """GET /api/calendar/status without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/calendar/status")
        assert response.status_code == 401


class TestExportCSVEndpoint:
    """Export CSV API tests (auth required)"""
    
    def test_export_csv_without_auth_returns_401(self):
        """GET /api/export/csv without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/export/csv")
        assert response.status_code == 401


class TestRootEndpoint:
    """Root API endpoint test"""
    
    def test_root_returns_message(self):
        """GET /api/ returns API message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
