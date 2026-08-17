"""
Convert MoVal ArcGIS feature service response → TypeScript-ready seed data.
Output goes to scripts/parks-curated.ts (typed const) ready for seed-parks.mts.

Coordinate system: input is web-Mercator (wkid 102100). Converting
EPSG:3857 X/Y → WGS84 lat/lng via standard inverse Mercator projection.

Reads:
  C:\\Users\\john\\AppData\\Local\\Temp\\moval-parks.json
  C:\\Users\\john\\AppData\\Local\\Temp\\moval-other-parks.json

Writes:
  C:\\Users\\john\\Projects\\websites\\moval-living\\scripts\\parks-curated.ts
  (preview only — to stdout for inspection)
"""

import json
import math
from pathlib import Path

PARKS_IN = Path(r"C:\Users\john\AppData\Local\Temp\moval-parks.json")
OTHER_IN = Path(r"C:\Users\john\AppData\Local\Temp\moval-other-parks.json")
OUT_TS = Path(r"C:\Users\john\Projects\websites\moval-living\scripts\parks-curated.ts")

# Map City amenity columns → public amenity slugs consumed by /parks filter UI
# (the controlled vocabulary lives at src/lib/park-amenities.ts in this repo).
# Note: many of the City's "amenity columns" are infrastructure (off_street_parking,
# drinking_fountain, picnic_shelter, security_lighting) — those don't belong on
# the public filter chip list (which is interactive facilities users can play on),
# but we still store them on `Park.amenities[]` for editorial cards to show what
# the park offers. The seed stores the RAW slugs; the /parks filter UI does
# the grouping at render time (e.g. picnic_shelter + picnic_table → "picnic").
AMENITY_MAP = {
    "Barbecues": "bbq",
    "BasketballCourt": "basketball",
    "Benches": "benches",
    "DogPark": "dog_park",
    "FitnessEquipment": "fitness_equipment",
    "FootballField": "football_field",
    "GolfCourse": "golf_course",
    "HorseArena": "equestrian",          # sibling slugs: equestrian
    "Horseshoe": "horseshoe",
    "MeetingFacility": "meeting_facility",
    "MultiField": "multi_field",
    "MultiTrail": "multi_trail",
    "AthleticField": "athletic_field",
    "OffStParking": "parking",           # sibling slugs: parking
    "PickleballCourt": "pickleball",
    "PicnicShelter": "picnic",           # sibling slugs: picnic (umbrella)
    "PicnicTable": "picnic",             # collapsed
    "Playground": "playground",
    "Restroom": "restrooms",             # sibling slugs: restrooms (plural)
    "SecurityLighting": "lights",        # sibling slugs: lights
    "SkatePark": "skate_park",
    "SnackBar": "snack_bar",
    "SoccerArena": "soccer",             # sibling slugs: soccer
    "SoccerField": "soccer",             # collapsed
    "SoftballField": "baseball",         # sibling slugs: baseball (umbrella: baseball/softball)
    "BaseballField": "baseball",         # collapsed
    "TennisCourt": "tennis",             # sibling slugs: tennis (not tennis_court)
    "Trail": "walking_trails",           # sibling slugs: walking_trails
    "Trailhead": "walking_trails",       # collapsed
    "VolleyballCourt": "volleyball",
    "WalkingPath": "walking_trails",     # collapsed
    "WaterFeature": "water_play",
    "DrinkingFountain": "drinking_fountain",
    "ADA": "wheelchair_access",          # sibling slugs: wheelchair_access (not ada_accessible)
    "BanquetFacility": "banquet_facility",
}

# Pump track isn't a column but appears in the Amenities text blob on some parks.
# It's listed nowhere yet — flagged for manual curation later.

# City facility addresses we know about from the facilities page
# (these aren't in any feature service — kept for our editorial pass)
CRC_ADDRESS = "14075 Frederick Street"
TOWNGATE_CC_ADDRESS = "13100 Arbor Park Lane"
SENIOR_CENTER_ADDRESS = "25075 Fir Avenue"
COTTONWOOD_ADDRESS = "13671 Frederick Street"


def mercator_to_lonlat(x, y):
    """EPSG:3857 → WGS84 lon/lat."""
    lon = (x / 20037508.34) * 180.0
    lat = (y / 20037508.34) * 180.0
    lat = 180.0 / math.pi * (2.0 * math.atan(math.exp(lat * math.pi / 180.0)) - math.pi / 2.0)
    return lat, lon


def slugify(name: str) -> str:
    """Park name → URL slug."""
    s = name.lower()
    s = s.replace("&", "and").replace("/", "-")
    s = "".join(c if c.isalnum() or c in (" ", "-") else "" for c in s)
    s = "-".join(s.split())
    # trim common suffixes
    s = s.replace("-memorial-park", "-park")  # keep memorial info? no — slug spec simple
    return s


# Reset slug logic — keep "Memorial" only when there's no other distinguishing suffix
def slugify_clean(name: str) -> str:
    # Hand-pick the few that need 'memorial-park' style names
    has_explicit_park = any(
        w.lower() in name.lower() for w in ("Park", "Golf", "Center", "Arena")
    )
    base = slugify(name)
    # Standardize suffixes
    if base.endswith("and-nature-center"):
        base = base.replace("and-nature-center", "equestrian-park")
        base = base.replace("-equestrian-park-equestrian-park", "-equestrian-park")
    if base.endswith("passive-nature-park"):
        base = "hidden-springs-passive-nature-park"
    return base


def infer_type(name: str) -> str:
    """Map park name to our ParkType enum."""
    n = name.lower()
    if "golf" in n:
        return "GOLF"
    if "civic center amphitheater" in n or "conference" in n or "recreation center" in n:
        return "REC_CENTER"
    return "PARK"


def build_amenities(attrs: dict) -> list[str]:
    seen = set()
    tags = []
    for col, tag in AMENITY_MAP.items():
        v = attrs.get(col)
        if v in ("Yes", True, "true") and tag not in seen:
            seen.add(tag)
            tags.append(tag)
    # Pump track check — some parks have a textual "pump track" mention
    amen_text = (attrs.get("Amenities") or "").lower()
    if "pump" in amen_text and "pump_track" not in seen:
        tags.append("pump_track")
    return tags


def main():
    parks_data = json.loads(PARKS_IN.read_text(encoding="utf-8"))
    other_data = json.loads(OTHER_IN.read_text(encoding="utf-8"))

    parks_records = []
    for f in parks_data["features"]:
        a = f["attributes"]
        g = f.get("geometry") or {}
        lon, lat = (None, None)
        if "x" in g and "y" in g:
            lat, lon = mercator_to_lonlat(g["x"], g["y"])
        parks_records.append(
            {
                "source": "MoValParks",
                "cityId": a["OBJECTID"],
                "name": a["name"],
                "address": a.get("Address"),
                "latitude": lat,
                "longitude": lon,
                "acres": a.get("Acreage"),
                "ada": a.get("ADA") in ("Yes", True),
                "googleMapUrl": a.get("GoggleMap_Link"),
                "website": a.get("website"),
                "amenities": build_amenities(a),
                "activeNetReservationUrl": a.get("ActiveNet_Site"),
                "picUrl": a.get("pic_url"),
                "notes": a.get("Notes"),
                "type": infer_type(a["name"]),
                "slug": slugify_clean(a["name"]),
                "googlePlaceId": None,
            }
        )

    # Skip non-MoVal properties (state/regional parks) that show up in
    # MoValOtherParks. The City's "Find a Park" map lists them under "Also
    # Nearby" — they're NOT part of the City's 36 facilities.
    EXCLUDED_FROM_OTHER_PARKS = {
        "Lake Perris State Recreation Area",
        "San Jacinto Wildlife Area",
    }
    other_records = []
    for f in other_data["features"]:
        a = f["attributes"]
        nm = a.get("name", "")
        if nm in EXCLUDED_FROM_OTHER_PARKS:
            continue
        g = f.get("geometry") or {}
        lat, lon = (None, None)
        if "x" in g and "y" in g:
            lat, lon = mercator_to_lonlat(g["x"], g["y"])
        other_records.append(
            {
                "source": "MoValOtherParks",
                "cityId": a["OBJECTID"],
                "name": nm,
                "address": a.get("Address"),
                "latitude": lat,
                "longitude": lon,
                "amenities": build_amenities(a),
                "acres": a.get("Acreage"),
                "ada": a.get("ADA") in ("Yes", True),
                "website": a.get("website"),
                "googlePlaceId": None,
                "googleMapUrl": None,
                "cityFeatureId": a["OBJECTID"],
                "activeNetReservationUrl": a.get("ActiveNet_Site"),
                "picUrl": a.get("pic_url"),
                "notes": a.get("Notes"),
                "type": infer_type(nm),
                "slug": slugify_clean(nm),
            }
        )

    all_records = parks_records + other_records
    print(f"\n>>> Total: {len(parks_records)} from MoValParks + {len(other_records)} from MoValOtherParks = {len(all_records)}")

    # Write the .ts file
    OUT_TS.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "// AUTO-GENERATED from City of Moreno Valley ArcGIS feature services",
        "// Source: https://services2.arcgis.com/WgPlP3PNKC8Glejs/arcgis/rest/services/MoValParks/FeatureServer",
        "//         https://services2.arcgis.com/WgPlP3PNKC8Glejs/arcgis/rest/services/MoValOtherParks/FeatureServer",
        "// Generated: 2026-08-17 by scripts/build-parks-curated.py",
        "// Re-run after City updates; parser is idempotent and adds no fields below",
        "",
        "export type ParkTypeStr = 'PARK' | 'GOLF' | 'REC_CENTER'",
        "",
        "export interface CuratedPark {",
        "  slug: string",
        "  name: string",
        "  type: ParkTypeStr",
        "  address: string | null",
        "  city: 'Moreno Valley'",
        "  state: 'CA'",
        "  zip: string | null",
        "  latitude: number | null",
        "  longitude: number | null",
        "  amenities: string[]",
        "  acres: string | number | null",
        "  ada: boolean",
        "  website: string | null",
        "  googlePlaceId: null  // filled by Google Places lookup step",
        "  googleMapUrl: string | null",
        "  cityFeatureId: number  // OBJECTID from MoValParks or MoValOtherParks",
        "  source: 'MoValParks' | 'MoValOtherParks'",
        "  activeNetReservationUrl: string | null",
        "  picUrl: string | null  // City-hosted picture URL (proxy for hero placeholder)",
        "  notes: string | null",
        "}",
        "",
        "export const PARKS_CURATED: CuratedPark[] = " + json.dumps(all_records, ensure_ascii=False, indent=2).replace(
            '"Moreno Valley"', "'Moreno Valley'"
        ).replace(
            '"CA"', "'CA'"
        ),
        "",
    ]
    OUT_TS.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n>>> wrote {OUT_TS}")


if __name__ == "__main__":
    main()
