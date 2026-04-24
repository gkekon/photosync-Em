from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File
from fastapi.responses import RedirectResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import csv
import io
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request as GoogleRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Google Calendar OAuth settings
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
# FRONTEND_URL can be set in .env for production, defaults to preview URL
FRONTEND_URL = os.environ.get('FRONTEND_URL', os.environ.get('REACT_APP_BACKEND_URL', 'https://photo-sync-dashboard.preview.emergentagent.com').replace('/api', '').rstrip('/'))
BACKEND_URL_ENV = os.environ.get('BACKEND_URL', '').strip().strip('=')

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ======================== MODELS ========================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    theme: str = "theme_blue_dark"
    google_calendar_tokens: Optional[dict] = None
    selected_calendar_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Package(BaseModel):
    model_config = ConfigDict(extra="ignore")
    package_id: str = Field(default_factory=lambda: f"pkg_{uuid.uuid4().hex[:12]}")
    user_id: str
    name: str
    description: Optional[str] = None
    photo_price: float = 0
    video_price: float = 0
    total_price: float = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PackageCreate(BaseModel):
    name: str
    description: Optional[str] = None
    photo_price: float = 0
    video_price: float = 0
    total_price: float = 0

class PackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    photo_price: Optional[float] = None
    video_price: Optional[float] = None
    total_price: Optional[float] = None

class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    event_id: str = Field(default_factory=lambda: f"evt_{uuid.uuid4().hex[:12]}")
    user_id: str
    google_calendar_event_id: Optional[str] = None
    source_calendar: Optional[str] = None  # Google Calendar ID this event came from
    source_calendar_name: Optional[str] = None  # Human-readable calendar name
    date: str
    name: str
    has_video: bool = False  # Quick checkbox for video service
    info: Optional[str] = None
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    deposit: bool = False
    deposit_amount: float = 0
    attached_offers: Optional[str] = None
    location: Optional[str] = None
    total_offer_price: float = 0
    photo_offer_price: float = 0
    video_offer_price: float = 0
    costs: float = 0
    clear_income: float = 0
    status: str = "booked"  # booked, unbooked, completed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EventCreate(BaseModel):
    google_calendar_event_id: Optional[str] = None
    date: str
    name: str
    has_video: bool = False
    info: Optional[str] = None
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    deposit: bool = False
    deposit_amount: float = 0
    attached_offers: Optional[str] = None
    location: Optional[str] = None
    total_offer_price: float = 0
    photo_offer_price: float = 0
    video_offer_price: float = 0
    costs: float = 0
    status: str = "booked"

class EventUpdate(BaseModel):
    date: Optional[str] = None
    name: Optional[str] = None
    has_video: Optional[bool] = None
    info: Optional[str] = None
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    deposit: Optional[bool] = None
    deposit_amount: Optional[float] = None
    attached_offers: Optional[str] = None
    location: Optional[str] = None
    total_offer_price: Optional[float] = None
    photo_offer_price: Optional[float] = None
    video_offer_price: Optional[float] = None
    costs: Optional[float] = None
    status: Optional[str] = None

class ThemeUpdate(BaseModel):
    theme: str

# ======================== AUTH HELPERS ========================

async def get_current_user(request: Request) -> User:
    """Get current user from session token (cookie or header)"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

# ======================== GOOGLE AUTH ROUTES ========================

def get_backend_url(request: Request) -> str:
    """Get the external backend URL from env or request headers"""
    if BACKEND_URL_ENV:
        return BACKEND_URL_ENV.rstrip('/')
    proto = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("host", "")
    if host:
        return f"{proto}://{host}"
    return str(request.base_url).rstrip('/')

@api_router.get("/auth/google/login")
async def auth_google_login(request: Request):
    """Redirect to Google OAuth consent screen for login"""
    backend_url = get_backend_url(request)
    redirect_uri = f"{backend_url}/api/auth/google/callback"

    scopes = "openid email profile"
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope={scopes}&"
        f"access_type=offline&"
        f"prompt=select_account"
    )
    return RedirectResponse(url=auth_url)

@api_router.get("/auth/google/callback")
async def auth_google_callback(request: Request, code: str = None, error: str = None):
    """Handle Google OAuth callback for login"""
    if error:
        logger.error(f"Google OAuth error: {error}")
        return RedirectResponse(url=f"{FRONTEND_URL}/?auth_error={error}")

    if not code:
        return RedirectResponse(url=f"{FRONTEND_URL}/?auth_error=no_code")

    backend_url = get_backend_url(request)
    redirect_uri = f"{backend_url}/api/auth/google/callback"

    try:
        # Exchange code for tokens
        async with httpx.AsyncClient() as http_client:
            token_resp = await http_client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code"
                }
            )

            if token_resp.status_code != 200:
                logger.error(f"Login token exchange failed: {token_resp.text}")
                return RedirectResponse(url=f"{FRONTEND_URL}/?auth_error=token_failed")

            tokens = token_resp.json()

        # Get user info from Google
        async with httpx.AsyncClient() as http_client:
            userinfo_resp = await http_client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"}
            )

            if userinfo_resp.status_code != 200:
                logger.error(f"User info failed: {userinfo_resp.text}")
                return RedirectResponse(url=f"{FRONTEND_URL}/?auth_error=userinfo_failed")

            google_user = userinfo_resp.json()

        # Create or update user
        email = google_user.get("email")
        name = google_user.get("name", email)
        picture = google_user.get("picture")

        existing_user = await db.users.find_one({"email": email}, {"_id": 0})

        if existing_user:
            user_id = existing_user["user_id"]
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"name": name, "picture": picture}}
            )
        else:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            new_user = User(
                user_id=user_id,
                email=email,
                name=name,
                picture=picture
            )
            await db.users.insert_one(new_user.model_dump())

        # Create session
        session_token = f"st_{uuid.uuid4().hex}"
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)

        await db.user_sessions.delete_many({"user_id": user_id})
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        # Redirect to frontend auth callback with session token
        redirect_url = f"{FRONTEND_URL}/auth/callback?session_token={session_token}"
        redirect_response = RedirectResponse(url=redirect_url)
        redirect_response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7*24*60*60
        )

        return redirect_response
    except Exception as e:
        logger.error(f"Auth callback exception: {e}")
        return RedirectResponse(url=f"{FRONTEND_URL}/?auth_error=server_error")

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current user data"""
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and clear session"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ======================== GOOGLE CALENDAR OAUTH ========================

@api_router.get("/oauth/calendar/login")
async def calendar_oauth_login(request: Request, user: User = Depends(get_current_user)):
    """Initiate Google Calendar OAuth flow"""
    backend_url = get_backend_url(request)
    redirect_uri = f"{backend_url}/api/oauth/calendar/callback"
    
    scopes = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar"
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope={scopes}&"
        f"access_type=offline&"
        f"prompt=consent&"
        f"state={user.user_id}"
    )
    return {"authorization_url": auth_url}

@api_router.get("/oauth/calendar/callback")
async def calendar_oauth_callback(code: str, state: str, request: Request):
    """Handle Google Calendar OAuth callback"""
    backend_url = get_backend_url(request)
    redirect_uri = f"{backend_url}/api/oauth/calendar/callback"
    
    async with httpx.AsyncClient() as http_client:
        token_resp = await http_client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code"
            }
        )
        
        if token_resp.status_code != 200:
            logger.error(f"Token exchange failed: {token_resp.text}")
            return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?calendar_error=token_exchange_failed")
        
        tokens = token_resp.json()
    
    user_id = state
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"google_calendar_tokens": tokens}}
    )
    
    return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?calendar_connected=true")

@api_router.get("/calendar/status")
async def calendar_status(user: User = Depends(get_current_user)):
    """Check if Google Calendar is connected"""
    return {
        "connected": user.google_calendar_tokens is not None,
        "selected_calendar_id": user.selected_calendar_id
    }

@api_router.get("/calendar/list")
async def list_calendars(user: User = Depends(get_current_user)):
    """List user's Google Calendars"""
    if not user.google_calendar_tokens:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    
    creds = await get_google_creds(user)
    service = build('calendar', 'v3', credentials=creds)
    
    calendars_result = service.calendarList().list().execute()
    calendars = calendars_result.get('items', [])
    
    return [{"id": c["id"], "summary": c.get("summary", "Unnamed")} for c in calendars]

@api_router.post("/calendar/select")
async def select_calendar(request: Request, user: User = Depends(get_current_user)):
    """Select a calendar to sync with"""
    body = await request.json()
    calendar_id = body.get("calendar_id")
    
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"selected_calendar_id": calendar_id}}
    )
    return {"message": "Calendar selected", "calendar_id": calendar_id}

@api_router.get("/calendar/events")
async def get_calendar_events(user: User = Depends(get_current_user)):
    """Get events from selected Google Calendar"""
    if not user.google_calendar_tokens:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    
    calendar_id = user.selected_calendar_id or "primary"
    
    creds = await get_google_creds(user)
    service = build('calendar', 'v3', credentials=creds)
    
    now = datetime.now(timezone.utc)
    time_min = (now - timedelta(days=365)).isoformat()
    time_max = (now + timedelta(days=365)).isoformat()
    
    events_result = service.events().list(
        calendarId=calendar_id,
        timeMin=time_min,
        timeMax=time_max,
        maxResults=250,
        singleEvents=True,
        orderBy='startTime'
    ).execute()
    
    events = events_result.get('items', [])
    
    return [{
        "id": e["id"],
        "summary": e.get("summary", "Unnamed Event"),
        "start": e.get("start", {}).get("dateTime") or e.get("start", {}).get("date"),
        "end": e.get("end", {}).get("dateTime") or e.get("end", {}).get("date"),
        "location": e.get("location"),
        "description": e.get("description")
    } for e in events]

@api_router.post("/calendar/sync")
async def sync_calendar_events(user: User = Depends(get_current_user)):
    """Sync Google Calendar events to local events"""
    if not user.google_calendar_tokens:
        raise HTTPException(status_code=400, detail="Google Calendar not connected")
    
    calendar_id = user.selected_calendar_id or "primary"
    
    creds = await get_google_creds(user)
    service = build('calendar', 'v3', credentials=creds)
    
    # Get calendar name
    try:
        cal_info = service.calendars().get(calendarId=calendar_id).execute()
        calendar_name = cal_info.get("summary", calendar_id)
    except Exception:
        calendar_name = calendar_id
    
    now = datetime.now(timezone.utc)
    time_min = (now - timedelta(days=365)).isoformat()
    time_max = (now + timedelta(days=365)).isoformat()
    
    events_result = service.events().list(
        calendarId=calendar_id,
        timeMin=time_min,
        timeMax=time_max,
        maxResults=250,
        singleEvents=True,
        orderBy='startTime'
    ).execute()
    
    google_events = events_result.get('items', [])
    synced_count = 0
    updated_count = 0
    
    for ge in google_events:
        existing = await db.events.find_one({
            "user_id": user.user_id,
            "google_calendar_event_id": ge["id"]
        }, {"_id": 0})
        
        if not existing:
            # New event - add it
            start = ge.get("start", {}).get("dateTime") or ge.get("start", {}).get("date")
            if start:
                date_str = start[:10]
                
                new_event = Event(
                    user_id=user.user_id,
                    google_calendar_event_id=ge["id"],
                    source_calendar=calendar_id,
                    source_calendar_name=calendar_name,
                    date=date_str,
                    name=ge.get("summary", "Unnamed Event"),
                    info=ge.get("description"),
                    location=ge.get("location"),
                    status="unbooked"
                )
                await db.events.insert_one(new_event.model_dump())
                synced_count += 1
        else:
            # Tag source calendar if missing
            if not existing.get("source_calendar"):
                await db.events.update_one(
                    {"event_id": existing["event_id"]},
                    {"$set": {"source_calendar": calendar_id, "source_calendar_name": calendar_name}}
                )
            
            # Existing event - check for changes in Google Calendar
            start = ge.get("start", {}).get("dateTime") or ge.get("start", {}).get("date")
            date_str = start[:10] if start else existing.get("date")
            
            google_name = ge.get("summary", "Unnamed Event")
            google_location = ge.get("location")
            google_description = ge.get("description")
            
            # Only update basic calendar fields (not your business data)
            updates = {}
            if date_str and date_str != existing.get("date"):
                updates["date"] = date_str
            if google_name != existing.get("name"):
                updates["name"] = google_name
            if google_location != existing.get("location"):
                updates["location"] = google_location
            # Update info/description only if it was empty in our app
            if google_description and not existing.get("info"):
                updates["info"] = google_description
            
            if updates:
                updates["updated_at"] = datetime.now(timezone.utc).isoformat()
                await db.events.update_one(
                    {"event_id": existing["event_id"]},
                    {"$set": updates}
                )
                updated_count += 1
    
    return {"message": f"Synced {synced_count} new events, updated {updated_count} existing events"}

async def get_google_creds(user: User) -> Credentials:
    """Get or refresh Google credentials"""
    tokens = user.google_calendar_tokens
    
    if not tokens or not tokens.get('refresh_token'):
        raise HTTPException(status_code=400, detail="Google Calendar not connected. Please reconnect.")
    
    creds = Credentials(
        token=tokens.get('access_token'),
        refresh_token=tokens.get('refresh_token'),
        token_uri='https://oauth2.googleapis.com/token',
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET
    )
    
    # Always try to refresh if we have a refresh token
    try:
        if creds.expired or not creds.valid:
            creds.refresh(GoogleRequest())
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$set": {"google_calendar_tokens.access_token": creds.token}}
            )
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        # Clear invalid tokens so user can reconnect
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {"google_calendar_tokens": None}}
        )
        raise HTTPException(status_code=400, detail="Google Calendar session expired. Please reconnect your calendar.")
    
    return creds

# ======================== THEME ROUTES ========================

@api_router.put("/user/theme")
async def update_theme(data: ThemeUpdate, user: User = Depends(get_current_user)):
    """Update user theme preference"""
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"theme": data.theme}}
    )
    return {"message": "Theme updated", "theme": data.theme}

# ======================== PACKAGE ROUTES ========================

@api_router.get("/packages", response_model=List[Package])
async def get_packages(user: User = Depends(get_current_user)):
    """Get all packages for user"""
    packages = await db.packages.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    return packages

@api_router.post("/packages", response_model=Package)
async def create_package(data: PackageCreate, user: User = Depends(get_current_user)):
    """Create a new package"""
    package = Package(user_id=user.user_id, **data.model_dump())
    await db.packages.insert_one(package.model_dump())
    return package

@api_router.put("/packages/{package_id}", response_model=Package)
async def update_package(package_id: str, data: PackageUpdate, user: User = Depends(get_current_user)):
    """Update a package"""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    await db.packages.update_one(
        {"package_id": package_id, "user_id": user.user_id},
        {"$set": update_data}
    )
    
    package = await db.packages.find_one({"package_id": package_id}, {"_id": 0})
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    return package

@api_router.delete("/packages/{package_id}")
async def delete_package(package_id: str, user: User = Depends(get_current_user)):
    """Delete a package"""
    result = await db.packages.delete_one({"package_id": package_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    return {"message": "Package deleted"}

# ======================== EVENT ROUTES ========================

@api_router.get("/events", response_model=List[Event])
async def get_events(request: Request, user: User = Depends(get_current_user)):
    """Get all events for user, optionally filtered by source calendar"""
    calendar = request.query_params.get("calendar")
    query = {"user_id": user.user_id}
    if calendar and calendar != "all":
        if calendar == "untagged":
            query["source_calendar"] = None
        else:
            query["source_calendar"] = calendar
    events = await db.events.find(query, {"_id": 0}).to_list(500)
    return events

@api_router.post("/events", response_model=Event)
async def create_event(data: EventCreate, user: User = Depends(get_current_user)):
    """Create a new event"""
    clear_income = data.total_offer_price - data.costs
    event = Event(
        user_id=user.user_id,
        clear_income=clear_income,
        **data.model_dump()
    )
    await db.events.insert_one(event.model_dump())
    return event

@api_router.put("/events/{event_id}", response_model=Event)
async def update_event(event_id: str, data: EventUpdate, user: User = Depends(get_current_user)):
    """Update an event"""
    existing = await db.events.find_one({"event_id": event_id, "user_id": user.user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Event not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    # Recalculate clear_income if prices or costs changed
    total = update_data.get("total_offer_price", existing.get("total_offer_price", 0))
    costs = update_data.get("costs", existing.get("costs", 0))
    update_data["clear_income"] = total - costs
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.events.update_one(
        {"event_id": event_id, "user_id": user.user_id},
        {"$set": update_data}
    )
    
    event = await db.events.find_one({"event_id": event_id}, {"_id": 0})
    return event

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, user: User = Depends(get_current_user)):
    """Delete an event"""
    result = await db.events.delete_one({"event_id": event_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event deleted"}

# ======================== CALENDAR SOURCE & CLEAR ROUTES ========================

@api_router.get("/events/sources")
async def get_event_sources(user: User = Depends(get_current_user)):
    """Get unique source calendars from events"""
    events = await db.events.find({"user_id": user.user_id}, {"_id": 0, "source_calendar": 1, "source_calendar_name": 1}).to_list(1000)
    
    sources = {}
    untagged = 0
    for e in events:
        cal = e.get("source_calendar")
        if cal:
            if cal not in sources:
                sources[cal] = {"id": cal, "name": e.get("source_calendar_name") or cal, "count": 0}
            sources[cal]["count"] += 1
        else:
            untagged += 1
    
    result = list(sources.values())
    result.sort(key=lambda x: -x["count"])
    return {"sources": result, "untagged_count": untagged, "total": len(events)}

@api_router.post("/events/clear")
async def clear_events(request: Request, user: User = Depends(get_current_user)):
    """Clear events by source calendar or all"""
    body = await request.json()
    calendar_id = body.get("calendar_id")  # None = clear all
    confirm = body.get("confirm", False)
    
    if not confirm:
        raise HTTPException(status_code=400, detail="Confirmation required")
    
    query = {"user_id": user.user_id}
    if calendar_id and calendar_id != "all":
        if calendar_id == "untagged":
            query["source_calendar"] = None
        else:
            query["source_calendar"] = calendar_id
    
    result = await db.events.delete_many(query)
    return {"deleted": result.deleted_count}

# ======================== BACKUP ROUTES ========================

@api_router.post("/backup/create")
async def create_backup(user: User = Depends(get_current_user)):
    """Create a backup snapshot of all events and packages"""
    events = await db.events.find({"user_id": user.user_id}, {"_id": 0}).to_list(1000)
    packages = await db.packages.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    
    backup_id = f"bak_{uuid.uuid4().hex[:12]}"
    backup = {
        "backup_id": backup_id,
        "user_id": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "events_count": len(events),
        "packages_count": len(packages),
        "events": events,
        "packages": packages,
    }
    await db.backups.insert_one(backup)
    
    return {
        "backup_id": backup_id,
        "events_count": len(events),
        "packages_count": len(packages),
        "created_at": backup["created_at"]
    }

@api_router.get("/backup/list")
async def list_backups(user: User = Depends(get_current_user)):
    """List all backups for user"""
    backups = await db.backups.find(
        {"user_id": user.user_id},
        {"_id": 0, "events": 0, "packages": 0}
    ).sort("created_at", -1).to_list(20)
    return backups

@api_router.get("/backup/download/{backup_id}")
async def download_backup(backup_id: str, request: Request):
    """Download a backup as JSON"""
    user = await get_user_from_token_or_cookie(request)
    backup = await db.backups.find_one(
        {"backup_id": backup_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    
    import json as json_mod
    content = json_mod.dumps(backup, indent=2, default=str)
    return StreamingResponse(
        io.BytesIO(content.encode('utf-8')),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=photosync_backup_{backup_id}.json"
        }
    )

@api_router.post("/backup/restore/{backup_id}")
async def restore_backup(backup_id: str, user: User = Depends(get_current_user)):
    """Restore events and packages from a backup"""
    backup = await db.backups.find_one(
        {"backup_id": backup_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")
    
    # Clear existing data
    await db.events.delete_many({"user_id": user.user_id})
    await db.packages.delete_many({"user_id": user.user_id})
    
    # Restore
    events = backup.get("events", [])
    packages = backup.get("packages", [])
    
    if events:
        await db.events.insert_many(events)
    if packages:
        await db.packages.insert_many(packages)
    
    return {"restored_events": len(events), "restored_packages": len(packages)}

@api_router.post("/events/tag-calendars")
async def tag_event_calendars(request: Request, user: User = Depends(get_current_user)):
    """Tag events with their source calendar based on provided mapping"""
    body = await request.json()
    mappings = body.get("mappings", {})  # {google_calendar_event_id: {source_calendar, source_calendar_name}}
    
    tagged = 0
    for gcal_id, cal_info in mappings.items():
        result = await db.events.update_many(
            {"user_id": user.user_id, "google_calendar_event_id": gcal_id, "source_calendar": None},
            {"$set": {"source_calendar": cal_info["source_calendar"], "source_calendar_name": cal_info["source_calendar_name"]}}
        )
        tagged += result.modified_count
    
    return {"tagged": tagged}

# ======================== EXPORT ROUTES ========================

async def get_user_from_token_or_cookie(request: Request) -> User:
    """Get user from query token or cookie - for export downloads"""
    # Try query parameter first (for direct download links)
    token = request.query_params.get("token")
    if not token:
        # Fall back to cookie
        token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

@api_router.get("/export/csv")
async def export_events_csv(request: Request):
    """Export all events to CSV for Apple Numbers/Excel"""
    user = await get_user_from_token_or_cookie(request)
    events = await db.events.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    
    # Sort by date
    events.sort(key=lambda x: x.get("date", ""))
    
    # Create CSV in memory
    output = io.StringIO()
    
    # CSV headers matching your fields
    fieldnames = [
        "Date", "Name", "Has Video", "Info", "Package", "Location",
        "Deposit", "Deposit Amount (EUR)", "Attached Offers",
        "Photo Price (EUR)", "Video Price (EUR)", "Offer Price (EUR)",
        "Costs (EUR)", "Clear Income (EUR)", "Status", "Google Calendar ID"
    ]
    
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    for event in events:
        writer.writerow({
            "Date": event.get("date", ""),
            "Name": event.get("name", ""),
            "Has Video": "Yes" if event.get("has_video") else "No",
            "Info": event.get("info", ""),
            "Package": event.get("package_name", ""),
            "Location": event.get("location", ""),
            "Deposit": "Yes" if event.get("deposit") else "No",
            "Deposit Amount (EUR)": event.get("deposit_amount", 0),
            "Attached Offers": event.get("attached_offers", ""),
            "Photo Price (EUR)": event.get("photo_offer_price", 0),
            "Video Price (EUR)": event.get("video_offer_price", 0),
            "Offer Price (EUR)": event.get("total_offer_price", 0),
            "Costs (EUR)": event.get("costs", 0),
            "Clear Income (EUR)": event.get("clear_income", 0),
            "Status": event.get("status", ""),
            "Google Calendar ID": event.get("google_calendar_event_id", "")
        })
    
    # Get CSV content
    csv_content = output.getvalue()
    output.close()
    
    # Return as downloadable file
    return StreamingResponse(
        io.BytesIO(csv_content.encode('utf-8-sig')),  # utf-8-sig for Excel/Numbers compatibility
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=photosync_events_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )

@api_router.get("/export/summary")
async def export_summary_csv(request: Request):
    """Export monthly income summary to CSV"""
    user = await get_user_from_token_or_cookie(request)
    events = await db.events.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    
    # Calculate monthly totals
    monthly_data = {}
    for event in events:
        if event.get("status") not in ["booked", "completed"]:
            continue
        try:
            event_date = datetime.strptime(event["date"], "%Y-%m-%d")
            key = f"{event_date.year}-{event_date.month:02d}"
            if key not in monthly_data:
                monthly_data[key] = {"revenue": 0, "costs": 0, "income": 0, "events": 0}
            monthly_data[key]["revenue"] += event.get("total_offer_price", 0)
            monthly_data[key]["costs"] += event.get("costs", 0)
            monthly_data[key]["income"] += event.get("clear_income", 0)
            monthly_data[key]["events"] += 1
        except (ValueError, KeyError):
            pass
    
    # Create CSV
    output = io.StringIO()
    fieldnames = ["Month", "Events", "Revenue (EUR)", "Costs (EUR)", "Clear Income (EUR)"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    
    for month in sorted(monthly_data.keys()):
        data = monthly_data[month]
        writer.writerow({
            "Month": month,
            "Events": data["events"],
            "Revenue (EUR)": data["revenue"],
            "Costs (EUR)": data["costs"],
            "Clear Income (EUR)": data["income"]
        })
    
    csv_content = output.getvalue()
    output.close()
    
    return StreamingResponse(
        io.BytesIO(csv_content.encode('utf-8-sig')),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=photosync_summary_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )

# ======================== IMPORT ROUTES ========================

# Column mappings for different CSV formats
COLUMN_MAPS = {
    # PhotoSync export format
    "Date": "date", "Name": "name", "Has Video": "has_video",
    "Info": "info", "Package": "package_name", "Location": "location",
    "Deposit": "deposit", "Deposit Amount (EUR)": "deposit_amount",
    "Attached Offers": "attached_offers",
    "Photo Price (EUR)": "photo_offer_price", "Video Price (EUR)": "video_offer_price",
    "Offer Price (EUR)": "total_offer_price", "Costs (EUR)": "costs",
    "Clear Income (EUR)": "clear_income", "Status": "status",
    "Google Calendar ID": "google_calendar_event_id",
    # ChatGPT export format
    "Video": "has_video", "Photo Price": "photo_offer_price",
    "Video Price": "video_offer_price", "Offer Price": "total_offer_price",
    "Costs": "costs", "Clear Income": "clear_income",
    "Deposit Amount": "deposit_amount", "Offers": "attached_offers",
    "Calendar ID": "google_calendar_event_id",
}

def parse_bool(val):
    if isinstance(val, bool):
        return val
    return str(val).strip().lower() in ("yes", "true", "1")

def parse_float(val):
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0

@api_router.post("/import/preview")
async def preview_import(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Preview CSV import - parse file and return events without saving"""
    content = await file.read()
    text = content.decode("utf-8-sig")
    
    reader = csv.DictReader(io.StringIO(text))
    events = []
    seen_cal_ids = set()
    
    # Get existing calendar IDs for duplicate detection
    existing_events = await db.events.find(
        {"user_id": user.user_id, "google_calendar_event_id": {"$ne": None}},
        {"_id": 0, "google_calendar_event_id": 1}
    ).to_list(1000)
    existing_cal_ids = {e["google_calendar_event_id"] for e in existing_events}
    
    for row in reader:
        event = {}
        for csv_col, val in row.items():
            csv_col = csv_col.strip()
            field = COLUMN_MAPS.get(csv_col)
            if field and val is not None:
                event[field] = val.strip()
        
        if not event.get("date") or not event.get("name"):
            continue
        
        # Parse types
        event["has_video"] = parse_bool(event.get("has_video", False))
        event["deposit"] = parse_bool(event.get("deposit", False))
        event["photo_offer_price"] = parse_float(event.get("photo_offer_price", 0))
        event["video_offer_price"] = parse_float(event.get("video_offer_price", 0))
        event["total_offer_price"] = parse_float(event.get("total_offer_price", 0))
        event["costs"] = parse_float(event.get("costs", 0))
        event["clear_income"] = parse_float(event.get("clear_income", 0))
        event["deposit_amount"] = parse_float(event.get("deposit_amount", 0))
        event["status"] = event.get("status", "unbooked").lower()
        
        # Set None for empty strings
        for key in ("info", "package_name", "location", "attached_offers", "google_calendar_event_id"):
            if not event.get(key):
                event[key] = None
        
        # Deduplicate within the CSV by calendar ID
        cal_id = event.get("google_calendar_event_id")
        if cal_id:
            if cal_id.startswith("demo"):
                event["google_calendar_event_id"] = None
            elif cal_id in seen_cal_ids:
                continue
            else:
                seen_cal_ids.add(cal_id)
        
        # Mark duplicates with existing DB events
        is_duplicate = cal_id and cal_id in existing_cal_ids
        event["_is_duplicate"] = is_duplicate
        events.append(event)
    
    new_count = len([e for e in events if not e.get("_is_duplicate")])
    dup_count = len([e for e in events if e.get("_is_duplicate")])
    
    return {
        "total_parsed": len(events),
        "new_events": new_count,
        "duplicates": dup_count,
        "events": events
    }

@api_router.post("/import/execute")
async def execute_import(request: Request, user: User = Depends(get_current_user)):
    """Import events from preview data"""
    body = await request.json()
    events = body.get("events", [])
    skip_duplicates = body.get("skip_duplicates", True)
    
    imported = 0
    skipped = 0
    
    for evt_data in events:
        # Skip duplicates if requested
        if skip_duplicates and evt_data.get("_is_duplicate"):
            skipped += 1
            continue
        
        # Remove internal fields
        evt_data.pop("_is_duplicate", None)
        
        # Calculate clear_income if not set
        if not evt_data.get("clear_income"):
            evt_data["clear_income"] = evt_data.get("total_offer_price", 0) - evt_data.get("costs", 0)
        
        event = Event(
            user_id=user.user_id,
            **{k: v for k, v in evt_data.items() if k in Event.model_fields}
        )
        await db.events.insert_one(event.model_dump())
        imported += 1
    
    return {"imported": imported, "skipped": skipped}

# ======================== INCOME ROUTES ========================

@api_router.get("/income/summary")
async def get_income_summary(user: User = Depends(get_current_user)):
    """Get income summary (monthly, yearly, total) - only counts booked/completed events"""
    events = await db.events.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    
    now = datetime.now(timezone.utc)
    current_year = now.year
    current_month = now.month
    
    yearly_income = 0
    monthly_income = 0
    total_income = 0
    pending_deposits = 0
    upcoming_events = []
    
    for event in events:
        status = event.get("status", "unbooked")
        clear_income = event.get("clear_income", 0)
        
        # Only count income for booked or completed events (NOT unbooked)
        if status in ["booked", "completed"]:
            total_income += clear_income
            
            try:
                event_date = datetime.strptime(event["date"], "%Y-%m-%d")
                if event_date.year == current_year:
                    yearly_income += clear_income
                    if event_date.month == current_month:
                        monthly_income += clear_income
            except (ValueError, KeyError):
                pass
        
        try:
            event_date = datetime.strptime(event["date"], "%Y-%m-%d")
            # Compare date part only for upcoming events
            event_date_aware = event_date.replace(tzinfo=timezone.utc)
            if event_date_aware.date() >= now.date() and status == "booked":
                upcoming_events.append({
                    "date": event["date"],
                    "name": event["name"],
                    "event_id": event["event_id"]
                })
        except (ValueError, KeyError):
            pass
        
        if not event.get("deposit") and status == "booked":
            pending_deposits += 1
    
    upcoming_events.sort(key=lambda x: x["date"])
    next_event = upcoming_events[0] if upcoming_events else None
    
    return {
        "yearly_income": yearly_income,
        "monthly_income": monthly_income,
        "total_income": total_income,
        "pending_deposits": pending_deposits,
        "next_event": next_event,
        "total_events": len(events),
        "booked_events": len([e for e in events if e.get("status") in ["booked", "completed"]]),
        "unbooked_events": len([e for e in events if e.get("status") == "unbooked"]),
        "completed_events": len([e for e in events if e.get("status") == "completed"]),
        "currency": "EUR"
    }

@api_router.get("/income/monthly")
async def get_monthly_income(user: User = Depends(get_current_user)):
    """Get income breakdown by month for current year - only booked/completed events"""
    events = await db.events.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    
    current_year = datetime.now(timezone.utc).year
    monthly_data = {i: {"income": 0, "events": 0} for i in range(1, 13)}
    
    for event in events:
        # Only count booked or completed events
        if event.get("status") not in ["booked", "completed"]:
            continue
        try:
            event_date = datetime.strptime(event["date"], "%Y-%m-%d")
            if event_date.year == current_year:
                monthly_data[event_date.month]["income"] += event.get("clear_income", 0)
                monthly_data[event_date.month]["events"] += 1
        except (ValueError, KeyError):
            pass
    
    return {
        "year": current_year,
        "months": [{"month": i, "income": monthly_data[i]["income"], "events": monthly_data[i]["events"]} for i in range(1, 13)],
        "currency": "EUR"
    }

@api_router.get("/analytics/overview")
async def get_analytics_overview(user: User = Depends(get_current_user)):
    """Get analytics overview for charts"""
    events = await db.events.find({"user_id": user.user_id}, {"_id": 0}).to_list(500)
    
    now = datetime.now(timezone.utc)
    current_year = now.year
    
    # Monthly breakdown for current year
    monthly_income = {i: 0 for i in range(1, 13)}
    monthly_events = {i: 0 for i in range(1, 13)}
    
    # Status breakdown
    status_counts = {"booked": 0, "unbooked": 0, "completed": 0}
    
    # Package breakdown
    package_revenue = {}
    
    # Total stats
    total_revenue = 0
    total_costs = 0
    deposits_received = 0
    deposits_pending = 0
    
    for event in events:
        status = event.get("status", "unbooked")
        status_counts[status] = status_counts.get(status, 0) + 1
        
        # Only count revenue for booked/completed
        if status in ["booked", "completed"]:
            clear_income = event.get("clear_income", 0)
            total_revenue += clear_income
            total_costs += event.get("costs", 0)
            
            # Package breakdown
            pkg_name = event.get("package_name") or "No Package"
            package_revenue[pkg_name] = package_revenue.get(pkg_name, 0) + event.get("total_offer_price", 0)
            
            try:
                event_date = datetime.strptime(event["date"], "%Y-%m-%d")
                if event_date.year == current_year:
                    monthly_income[event_date.month] += clear_income
                    monthly_events[event_date.month] += 1
            except (ValueError, KeyError):
                pass
        
        # Deposit tracking for booked events
        if status == "booked":
            if event.get("deposit"):
                deposits_received += event.get("deposit_amount", 0)
            else:
                deposits_pending += 1
    
    return {
        "monthly_income": [{"month": i, "income": monthly_income[i], "events": monthly_events[i]} for i in range(1, 13)],
        "status_breakdown": status_counts,
        "package_revenue": [{"name": k, "revenue": v} for k, v in package_revenue.items()],
        "totals": {
            "revenue": total_revenue,
            "costs": total_costs,
            "profit_margin": round((total_revenue / (total_revenue + total_costs) * 100) if (total_revenue + total_costs) > 0 else 0, 1),
            "deposits_received": deposits_received,
            "deposits_pending_count": deposits_pending
        },
        "currency": "EUR",
        "year": current_year
    }

# ======================== HEALTH CHECK ========================

@api_router.get("/")
async def root():
    return {"message": "Wedding Photography Dashboard API"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router and middleware
app.include_router(api_router)

# Build allowed origins from FRONTEND_URL
_allowed_origins = [FRONTEND_URL]
# Also allow the preview/local URLs
if "preview.emergentagent.com" not in FRONTEND_URL:
    _allowed_origins.append("https://photo-sync-dashboard.preview.emergentagent.com")
if BACKEND_URL_ENV:
    _allowed_origins.append(BACKEND_URL_ENV)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
