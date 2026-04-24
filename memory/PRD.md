# PhotoSync - Wedding Photography Business Dashboard

## Original Problem Statement
Create a cloud app table sheet with a beautiful minimalistic interface that can sync with Google Calendar. The user is a wedding photographer & videographer who wants to list booked and unbooked events from a specific calendar. 

Features: Date, Name, Info, Package, Deposit (yes/no), Deposit Amount, Attached Offers, Location, Offer Price, Photo Offer Price, Video Offer Price, Costs, Clear Income, Monthly/Yearly Clear Income. Auto-calculate clear work incomes. Desktop/Mobile view, Dark/Light mode, Package creation/editing, EUR currency, PWA support, CSV export for Apple Numbers, "Video" checkbox.

## Architecture
- **Frontend:** React + Tailwind CSS + Shadcn UI (Railway: photosync-em-production-fc35.up.railway.app)
- **Backend:** FastAPI + MongoDB (Railway: photosync-em-production.up.railway.app)
- **Auth:** Standalone Google OAuth 2.0 (NOT Emergent auth)
- **GitHub:** github.com/gkekon/photosync-Em

## What's Been Implemented (All DONE)
- Full-stack dashboard with Google Calendar one-way sync (read-only)
- Enhanced Calendar sync (detecting date/name/location changes)
- Event CRUD with custom fields and auto-calculations
- Monthly and Yearly clear income analytics
- Package creation/editing
- Dark/Light theme switcher with multiple themes
- PWA support (installable on iOS/Mac)
- CSV Export for Apple Numbers compatibility
- **CSV Import with preview and duplicate detection** (April 2026)
- **Calendar source filter** - switch between calendars in header (April 2026)
- **Backup system** - create/list/download/restore snapshots (April 2026)
- **Clear calendar** - delete events by calendar with confirmation (April 2026)
- Mobile responsive design
- **Standalone Google OAuth** replacing Emergent auth (April 2026)
- **CORS fix** for cross-domain Railway deployment (April 2026)
- **Dedicated /auth/callback route** for reliable token handling (April 2026)
- **Data migration** from CSV backups - 147 events imported (April 2026)
- Railway deployment configuration
- GitHub repository push with clean .gitignore

## Key Technical Decisions
- OAuth redirect goes to backend (`/api/auth/google/callback`), not frontend
- Session token passed via URL param to `/auth/callback`, then stored in localStorage
- `apiFetch` utility sends Bearer token + cookies for cross-domain auth
- CORS uses explicit origins (not wildcard `*`) to support credentials
- Service worker v2 skips cross-origin requests

## Google Cloud Console Setup
- **Project:** "My First Project"
- **Client ID:** 153601226750-ilobknkeq1bhk6dv1j9s6pfm4nrgh76t.apps.googleusercontent.com
- **Authorized redirect URIs:**
  - https://photosync-em-production.up.railway.app/api/auth/google/callback
  - https://photosync-em-production.up.railway.app/api/oauth/calendar/callback

## Backlog
- P1: File attachments for offers (requires cloud storage setup)
- P2: Multi-year analytics view
- P3: Email notifications for upcoming events
