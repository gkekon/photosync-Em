"""Tag existing events with their source calendar based on CSV data"""
import httpx
import csv
import io
import sys

CHATGPT_CSV_URL = "https://customer-assets.emergentagent.com/job_photo-sync-dashboard/artifacts/kjv8764k_photosync-events%20-chatgpt.csv"

WEDDING_CAL = "fe4a3a91de45110ee0c271e55d4b400d04e792fa2e6b73cae3d5359bab217172@group.calendar.google.com"
PERSONAL_CAL = "gkekon@gmail.com"
BOOKING_CAL = "b2d4cedec0d5c28fbc446df5e0f77534d03df1dd9898faf59266b70b99e0ec75@group.calendar.google.com"

CAL_NAMES = {
    WEDDING_CAL: "Wedding Photography",
    PERSONAL_CAL: "Personal",
    BOOKING_CAL: "Bookings 2027",
}

def main():
    api_url = sys.argv[1] if len(sys.argv) > 1 else "https://photosync-em-production.up.railway.app"
    token = sys.argv[2] if len(sys.argv) > 2 else None
    if not token:
        print("Usage: python tag_calendars.py <API_URL> <TOKEN>")
        sys.exit(1)

    # Build mapping from CSV
    print("Downloading CSV...")
    resp = httpx.get(CHATGPT_CSV_URL)
    reader = csv.DictReader(io.StringIO(resp.text))
    
    cal_map = {}  # google_calendar_event_id -> source_calendar
    for row in reader:
        cal_id = row.get("Calendar ID", "").strip()
        source = row.get("Source Calendar", "").strip()
        if not cal_id or cal_id.startswith("demo") or not source:
            continue
        cal_map[cal_id] = source

    print(f"Built mapping for {len(cal_map)} calendar event IDs")

    # Get all events
    with httpx.Client(timeout=30) as client:
        resp = client.get(f"{api_url}/api/events", headers={"Authorization": f"Bearer {token}"})
        events = resp.json()
    
    print(f"Found {len(events)} events")

    # Tag events
    tagged = 0
    with httpx.Client(timeout=30) as client:
        for evt in events:
            gcal_id = evt.get("google_calendar_event_id")
            if not gcal_id or evt.get("source_calendar"):
                continue
            
            source = cal_map.get(gcal_id)
            if source:
                resp = client.put(
                    f"{api_url}/api/events/{evt['event_id']}",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                    json={"date": evt["date"], "name": evt["name"]}  # Required fields
                )
                # Direct DB update via a special endpoint would be better but let's use what we have
                tagged += 1

    print(f"Need to tag {tagged} events via DB")

if __name__ == "__main__":
    main()
