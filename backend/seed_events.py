"""
Seed script to import events from CSV backups into PhotoSync database.
Merges data from both Emergent and ChatGPT CSV exports, deduplicates by Calendar ID,
and imports via the API.
"""
import csv
import json
import io
import sys
import httpx

# ChatGPT CSV has the most complete data
CHATGPT_CSV_URL = "https://customer-assets.emergentagent.com/job_photo-sync-dashboard/artifacts/kjv8764k_photosync-events%20-chatgpt.csv"
EMERGENT_CSV_URL = "https://customer-assets.emergentagent.com/job_photo-sync-dashboard/artifacts/tmdwp317_photosync_events_2026-03-31.csv"


def parse_chatgpt_csv(content):
    """Parse ChatGPT format CSV"""
    reader = csv.DictReader(io.StringIO(content))
    events = []
    for row in reader:
        events.append({
            "date": row.get("Date", "").strip(),
            "name": row.get("Name", "").strip(),
            "status": row.get("Status", "unbooked").strip().lower(),
            "has_video": row.get("Video", "No").strip().lower() == "yes",
            "package_name": row.get("Package", "").strip() or None,
            "location": row.get("Location", "").strip() or None,
            "photo_offer_price": float(row.get("Photo Price", 0) or 0),
            "video_offer_price": float(row.get("Video Price", 0) or 0),
            "total_offer_price": float(row.get("Offer Price", 0) or 0),
            "costs": float(row.get("Costs", 0) or 0),
            "clear_income": float(row.get("Clear Income", 0) or 0),
            "deposit": row.get("Deposit", "No").strip().lower() == "yes",
            "deposit_amount": float(row.get("Deposit Amount", 0) or 0),
            "attached_offers": row.get("Offers", "").strip() or None,
            "info": row.get("Info", "").strip() or None,
            "google_calendar_event_id": row.get("Calendar ID", "").strip() or None,
            "_imported_from_google": row.get("Imported From Google", "No").strip().lower() == "yes",
        })
    return events


def parse_emergent_csv(content):
    """Parse Emergent/PhotoSync format CSV"""
    reader = csv.DictReader(io.StringIO(content))
    events = []
    for row in reader:
        events.append({
            "date": row.get("Date", "").strip(),
            "name": row.get("Name", "").strip(),
            "status": row.get("Status", "unbooked").strip().lower(),
            "has_video": row.get("Has Video", "No").strip().lower() == "yes",
            "package_name": row.get("Package", "").strip() or None,
            "location": row.get("Location", "").strip() or None,
            "photo_offer_price": float(row.get("Photo Price (EUR)", 0) or 0),
            "video_offer_price": float(row.get("Video Price (EUR)", 0) or 0),
            "total_offer_price": float(row.get("Offer Price (EUR)", 0) or 0),
            "costs": float(row.get("Costs (EUR)", 0) or 0),
            "clear_income": float(row.get("Clear Income (EUR)", 0) or 0),
            "deposit": row.get("Deposit", "No").strip().lower() == "yes",
            "deposit_amount": float(row.get("Deposit Amount (EUR)", 0) or 0),
            "attached_offers": row.get("Attached Offers", "").strip() or None,
            "info": row.get("Info", "").strip() or None,
            "google_calendar_event_id": row.get("Google Calendar ID", "").strip() or None,
            "_imported_from_google": False,
        })
    return events


def merge_and_deduplicate(chatgpt_events, emergent_events):
    """
    Merge events from both sources, deduplicate by Calendar ID.
    For duplicates: prefer Google-imported version (more up-to-date).
    """
    # Index ChatGPT events by calendar ID
    by_cal_id = {}
    
    for evt in chatgpt_events:
        cal_id = evt.get("google_calendar_event_id")
        if not cal_id or cal_id.startswith("demo"):
            continue
        
        existing = by_cal_id.get(cal_id)
        if existing:
            # Prefer Google-imported version
            if evt["_imported_from_google"] and not existing["_imported_from_google"]:
                by_cal_id[cal_id] = evt
            # If both are Google-imported or both not, prefer the one with more data
            elif evt["total_offer_price"] > existing["total_offer_price"]:
                by_cal_id[cal_id] = evt
        else:
            by_cal_id[cal_id] = evt
    
    # Add Emergent events that have unique calendar IDs
    for evt in emergent_events:
        cal_id = evt.get("google_calendar_event_id")
        if cal_id and cal_id not in by_cal_id:
            by_cal_id[cal_id] = evt
        elif cal_id and cal_id in by_cal_id:
            # Emergent version might have better info/offers for some events
            existing = by_cal_id[cal_id]
            # Merge attached_offers if Emergent has them and ChatGPT doesn't
            if evt.get("attached_offers") and not existing.get("attached_offers"):
                existing["attached_offers"] = evt["attached_offers"]
            # Merge info if Emergent has it and ChatGPT doesn't
            if evt.get("info") and not existing.get("info"):
                existing["info"] = evt["info"]
    
    # Clean up internal fields
    result = []
    for evt in by_cal_id.values():
        evt.pop("_imported_from_google", None)
        result.append(evt)
    
    return result


def import_events(api_url, token, events):
    """Import events via the API"""
    imported = 0
    skipped = 0
    errors = 0
    
    with httpx.Client(timeout=30) as client:
        for evt in events:
            try:
                resp = client.post(
                    f"{api_url}/api/events",
                    json=evt,
                    headers={"Authorization": f"Bearer {token}"}
                )
                if resp.status_code == 200:
                    imported += 1
                else:
                    errors += 1
                    print(f"  Error importing '{evt['name']}': {resp.status_code} - {resp.text[:100]}")
            except Exception as e:
                errors += 1
                print(f"  Exception importing '{evt['name']}': {e}")
    
    return imported, skipped, errors


def main():
    API_URL = sys.argv[1] if len(sys.argv) > 1 else "https://photosync-em-production.up.railway.app"
    TOKEN = sys.argv[2] if len(sys.argv) > 2 else None
    
    if not TOKEN:
        print("Usage: python seed_events.py <API_URL> <SESSION_TOKEN>")
        sys.exit(1)
    
    print("Downloading CSV files...")
    with httpx.Client() as client:
        chatgpt_resp = client.get(CHATGPT_CSV_URL)
        emergent_resp = client.get(EMERGENT_CSV_URL)
    
    print("Parsing ChatGPT CSV...")
    chatgpt_events = parse_chatgpt_csv(chatgpt_resp.text)
    print(f"  Found {len(chatgpt_events)} events")
    
    print("Parsing Emergent CSV...")
    emergent_events = parse_emergent_csv(emergent_resp.text)
    print(f"  Found {len(emergent_events)} events")
    
    print("Merging and deduplicating...")
    merged = merge_and_deduplicate(chatgpt_events, emergent_events)
    
    # Sort by date
    merged.sort(key=lambda x: x.get("date", ""))
    
    # Stats
    booked = [e for e in merged if e["status"] in ("booked", "completed")]
    unbooked = [e for e in merged if e["status"] == "unbooked"]
    print(f"  Merged: {len(merged)} unique events ({len(booked)} booked/completed, {len(unbooked)} unbooked)")
    
    print(f"\nImporting to {API_URL}...")
    imported, skipped, errors = import_events(API_URL, TOKEN, merged)
    print(f"\nDone! Imported: {imported}, Skipped: {skipped}, Errors: {errors}")


if __name__ == "__main__":
    main()
