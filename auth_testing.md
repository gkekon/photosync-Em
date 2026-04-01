# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session

```bash
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  theme: 'theme-blue-dark',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API

```bash
# Test auth endpoint
curl -X GET "https://photo-sync-dashboard.preview.emergentagent.com/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test events endpoint
curl -X GET "https://photo-sync-dashboard.preview.emergentagent.com/api/events" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

# Test packages endpoint
curl -X POST "https://photo-sync-dashboard.preview.emergentagent.com/api/packages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{"name": "Premium Package", "photo_price": 1000, "video_price": 1500, "total_price": 2500}'

# Test create event
curl -X POST "https://photo-sync-dashboard.preview.emergentagent.com/api/events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{"date": "2025-06-15", "name": "Wedding of John & Jane", "total_offer_price": 2500, "costs": 500, "status": "booked"}'
```

## Step 3: Browser Testing

```python
# Set cookie and navigate
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "photo-sync-dashboard.preview.emergentagent.com",
    "path": "/",
    "httpOnly": True,
    "secure": True,
    "sameSite": "None"
}])
await page.goto("https://photo-sync-dashboard.preview.emergentagent.com/dashboard")
```

## Quick Debug

```bash
# Check data format
mongosh --eval "
use('test_database');
db.users.find().limit(2).pretty();
db.user_sessions.find().limit(2).pretty();
"

# Clean test data
mongosh --eval "
use('test_database');
db.users.deleteMany({email: /test\.user\./});
db.user_sessions.deleteMany({session_token: /test_session/});
"
```

## Checklist

- [ ] User document has user_id field
- [ ] Session user_id matches user's user_id exactly
- [ ] All queries use `{"_id": 0}` projection
- [ ] API returns user data (not 401/404)
- [ ] Browser loads dashboard (not login page)

## Success Indicators

- ✅ /api/auth/me returns user data
- ✅ Dashboard loads without redirect
- ✅ CRUD operations work

## Failure Indicators

- ❌ "User not found" errors
- ❌ 401 Unauthorized responses
- ❌ Redirect to login page
