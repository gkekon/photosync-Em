import requests
import sys
import json
from datetime import datetime, timedelta
import time
import subprocess

class WeddingPhotographyAPITester:
    def __init__(self, base_url="https://photo-sync-dashboard.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_package_id = None
        self.created_event_id = None
        
    def create_test_user_and_session(self):
        """Create test user and session in MongoDB"""
        print("\n🔧 Setting up test user and session...")
        
        # Generate unique identifiers
        timestamp = int(time.time() * 1000)
        user_id = f"test-user-{timestamp}"
        session_token = f"test_session_{timestamp}"
        email = f"test.user.{timestamp}@example.com"
        
        # Create MongoDB script
        mongo_script = f'''
use('test_database');
db.users.insertOne({{
  user_id: "{user_id}",
  email: "{email}",
  name: "Test User",
  picture: "https://via.placeholder.com/150",
  theme: "theme_blue_dark",
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: "{user_id}",
  session_token: "{session_token}",
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
print("Setup complete");
        '''
        
        try:
            result = subprocess.run(
                ["mongosh", "--eval", mongo_script],
                capture_output=True, text=True, timeout=30
            )
            
            if result.returncode == 0:
                self.session_token = session_token
                self.user_id = user_id
                print(f"✅ Test user created: {user_id}")
                print(f"✅ Session token: {session_token}")
                return True
            else:
                print(f"❌ MongoDB setup failed: {result.stderr}")
                return False
                
        except Exception as e:
            print(f"❌ Error setting up test user: {str(e)}")
            return False

    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        print("\n🧹 Cleaning up test data...")
        
        cleanup_script = '''
use('test_database');
db.users.deleteMany({email: /test\.user\./});
db.user_sessions.deleteMany({session_token: /test_session/});
db.packages.deleteMany({user_id: /test-user/});
db.events.deleteMany({user_id: /test-user/});
print("Cleanup complete");
        '''
        
        try:
            subprocess.run(["mongosh", "--eval", cleanup_script], timeout=30)
            print("✅ Test data cleaned up")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {str(e)}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.session_token:
            test_headers['Authorization'] = f'Bearer {self.session_token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout after 30 seconds")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success

    def test_auth_me(self):
        """Test /auth/me endpoint"""
        success, response = self.run_test(
            "Auth Me",
            "GET", 
            "auth/me",
            200
        )
        
        if success:
            print(f"   User: {response.get('name')} ({response.get('email')})")
        
        return success

    def test_packages_crud(self):
        """Test package CRUD operations"""
        # Create package
        package_data = {
            "name": "Premium Wedding Package",
            "description": "Complete wedding photography and videography",
            "photo_price": 1200.0,
            "video_price": 1800.0,
            "total_price": 3000.0
        }
        
        success, response = self.run_test(
            "Create Package",
            "POST",
            "packages",
            200,
            data=package_data
        )
        
        if success:
            self.created_package_id = response.get('package_id')
            print(f"   Package ID: {self.created_package_id}")
        else:
            return False
        
        # Get packages
        success, response = self.run_test(
            "Get Packages",
            "GET",
            "packages",
            200
        )
        
        if success:
            print(f"   Found {len(response)} packages")
        else:
            return False
        
        # Update package
        if self.created_package_id:
            update_data = {"total_price": 3200.0}
            success, response = self.run_test(
                "Update Package",
                "PUT",
                f"packages/{self.created_package_id}",
                200,
                data=update_data
            )
            if not success:
                return False
        
        return True

    def test_events_crud(self):
        """Test event CRUD operations"""
        # Create event
        event_data = {
            "date": "2025-08-15",
            "name": "Wedding of John & Jane Doe",
            "info": "Beautiful outdoor ceremony",
            "package_id": self.created_package_id,
            "package_name": "Premium Wedding Package",
            "deposit": True,
            "deposit_amount": 500.0,
            "location": "Garden Villa, Vienna",
            "total_offer_price": 3200.0,
            "photo_offer_price": 1200.0,
            "video_offer_price": 1800.0,
            "costs": 600.0,
            "status": "booked"
        }
        
        success, response = self.run_test(
            "Create Event",
            "POST",
            "events",
            200,
            data=event_data
        )
        
        if success:
            self.created_event_id = response.get('event_id')
            print(f"   Event ID: {self.created_event_id}")
            print(f"   Clear Income: {response.get('clear_income')}")
        else:
            return False
        
        # Get events
        success, response = self.run_test(
            "Get Events",
            "GET",
            "events",
            200
        )
        
        if success:
            print(f"   Found {len(response)} events")
        else:
            return False
        
        # Update event
        if self.created_event_id:
            update_data = {"status": "completed", "costs": 550.0}
            success, response = self.run_test(
                "Update Event",
                "PUT",
                f"events/{self.created_event_id}",
                200,
                data=update_data
            )
            if success:
                print(f"   Updated Clear Income: {response.get('clear_income')}")
            else:
                return False
        
        return True

    def test_income_summary(self):
        """Test income summary endpoint"""
        success, response = self.run_test(
            "Income Summary",
            "GET",
            "income/summary",
            200
        )
        
        if success:
            print(f"   Monthly Income: €{response.get('monthly_income', 0)}")
            print(f"   Yearly Income: €{response.get('yearly_income', 0)}")
            print(f"   Total Events: {response.get('total_events', 0)}")
            print(f"   Pending Deposits: {response.get('pending_deposits', 0)}")
        
        return success

    def test_monthly_income(self):
        """Test monthly income breakdown"""
        success, response = self.run_test(
            "Monthly Income Breakdown",
            "GET",
            "income/monthly",
            200
        )
        
        if success:
            print(f"   Year: {response.get('year')}")
            print(f"   Currency: {response.get('currency')}")
        
        return success

    def test_theme_update(self):
        """Test theme update"""
        theme_data = {"theme": "theme_green_light"}
        
        success, response = self.run_test(
            "Update Theme",
            "PUT",
            "user/theme",
            200,
            data=theme_data
        )
        
        return success

    def test_calendar_status(self):
        """Test calendar status (should work without Google OAuth)"""
        success, response = self.run_test(
            "Calendar Status",
            "GET",
            "calendar/status",
            200
        )
        
        if success:
            print(f"   Calendar Connected: {response.get('connected')}")
        
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Wedding Photography Dashboard API Tests")
        print("=" * 60)
        
        # Setup test user
        if not self.create_test_user_and_session():
            print("❌ Failed to create test user. Cannot continue.")
            return False
        
        # Core tests
        tests = [
            ("Health Check", self.test_health_check),
            ("Authentication", self.test_auth_me),
            ("Package CRUD", self.test_packages_crud),
            ("Event CRUD", self.test_events_crud),
            ("Income Summary", self.test_income_summary),
            ("Monthly Income", self.test_monthly_income),
            ("Theme Update", self.test_theme_update),
            ("Calendar Status", self.test_calendar_status),
        ]
        
        failed_tests = []
        
        for test_name, test_func in tests:
            try:
                if not test_func():
                    failed_tests.append(test_name)
            except Exception as e:
                print(f"❌ {test_name} failed with exception: {str(e)}")
                failed_tests.append(test_name)
        
        # Cleanup
        self.cleanup_test_data()
        
        # Results
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS")
        print("=" * 60)
        print(f"Tests passed: {self.tests_passed}/{self.tests_run}")
        print(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if failed_tests:
            print(f"\n❌ Failed tests: {', '.join(failed_tests)}")
        else:
            print("\n✅ All tests passed!")
        
        return len(failed_tests) == 0


def main():
    tester = WeddingPhotographyAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())