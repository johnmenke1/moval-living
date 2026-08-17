/**
 * Hand-curated FAQ entries for parks whose unique features are NOT
 * captured by MoVal's ArcGIS attribute set (which only knows boolean
 * amenity columns + free-text Amenities bullets).
 *
 * Each entry is keyed by slug. The seed script merges these into the
 * universal template-generated FAQs so each park gets the best of
 * both: structured data (City-sourced) + curated narrative facts
 * (City-sourced from press releases, facilities brochures, etc.).
 *
 * Source URLs are documented per-entry. When in doubt, link to the
 * source — JoVe wants attribution everywhere.
 *
 * Field shapes:
 *   - "faqs"  : extra {q, a} pairs appended after the templated ones
 *               (use them sparingly — too many Q&A hurts readability
 *               AND makes the FAQPage structured data less likely to
 *               win a Google Rich Result).
 *
 * The seed script orders templated facts FIRST (locations, amenities,
 * ADA, hours, reservations) and curated facts LAST (the "interesting"
 * stuff). Google picks max 2-3 Q&A per park in the SERP — we want
 * the templated ones anchored to the most likely search queries
 * ("what amenities does X have") and the curated ones as enrichment.
 */

/**
 * Source: https://moval.org/news/2025/120525-FlightDeck.html
 *   "City of Moreno Valley to Hold Ribbon-Cutting Ceremony for
 *    Innovative Flight Deck Bike Park" — Dec 5, 2025.
 *
 * The City claims (paraphrased by the PR):
 *   - largest Velosolutions asphalt pump track in Southern California
 *   - region's first adaptive track for riders of all abilities
 *   - first asphalt jump lines in Southern California
 *   - asphalt bicycle playground for young riders
 *   - 1000-foot connecting path with Ambient Glow Technology
 *     (sunlight-charged glow rocks, illuminate after dark) — first
 *     use of this tech in Southern California
 *   - inspired by the city's aviation heritage
 *   - bikes, standard non-motorized scooters, skateboards, rollerblades
 *     welcome; motorized bikes/scooters prohibited
 *   - daily 7 AM to 10 PM, free admission, 13460 Morrison Street
 */
const MORRISON_FLIGHT_DECK = [
  {
    q: 'What is the Flight Deck Bike Park at Morrison Park?',
    a: 'The Flight Deck is the largest Velosolutions asphalt pump track in Southern California, located on the southern side of Morrison Park near the Fire Station at 13460 Morrison Street. It also features the region\'s first adaptive track, the first asphalt jump lines in Southern California, an asphalt bicycle playground for young riders, and a 1,000-foot connecting path with sunlight-charged glow rocks that illuminates after dark. The park opened December 18, 2025 and was designed and built by American Ramp Company, inspired by Moreno Valley\'s aviation heritage.',
  },
  {
    q: 'How do I get to the Flight Deck at 13460 Morrison Street?',
    a: 'The Flight Deck Bike Park is at 13460 Morrison Street, on the southern side of Morrison Park near the Fire Station. The main Morrison Park address is 26667 Dracaea Avenue — follow signs to the southern side of the park. Daily hours are 7:00 AM to 10:00 PM, and admission is free.',
  },
  {
    q: 'Is the Flight Deck adaptive-friendly?',
    a: 'Yes. The Flight Deck includes the region\'s first adaptive track designed for riders of all abilities, alongside the main Velosolutions pump track, jump lines, and a bicycle playground. The City of Moreno Valley welcomes standard bicycles, non-motorized scooters, skateboards, and rollerblades; motorized bikes and scooters are strictly prohibited.',
  },
]

/**
 * Source: https://moval.org/parks-comm-svc/parks-facilities.html
 *   "City Facilities — MoVenues" — Cottonwood Golf Center & Banquet Room.
 *
 *   - 13671 Frederick Street, Moreno Valley
 *   - 951.413.3280 for current rates/availability
 *   - 2,275 sq ft banquet room, accommodates 125 guests
 *   - full kitchen, spacious lobby, separate smaller (bride's) room
 *   - 360 + still photos hosted by City
 */
const COTTONWOOD_FAQ = [
  {
    q: 'What is the Cottonwood Banquet Room?',
    a: 'The Cottonwood Banquet Room at Cottonwood Golf Center (13671 Frederick Street, Moreno Valley) is a 2,275-square-foot rentable event space that can accommodate up to 125 guests. It includes a full kitchen, a spacious lobby, and a separate smaller room often used as a bride\'s room. Call (951) 413-3280 for current rates and availability.',
  },
]

/**
 * Source: https://moval.org/parks-comm-svc/parks-facilities.html
 *   Conference & Recreation Center (CRC) — 14075 Frederick Street.
 *
 *   - 14075 Frederick Street, Moreno Valley
 *   - Grand Ballroom: 8,200 sq ft, 400 guests, full kitchen,
 *     stage, dressing rooms, full video/movie screen
 *   - 2 meeting rooms + reception patio + outdoor banquet patio
 */
const CRC_FAQ = [
  {
    q: 'What is the Grand Ballroom at the Conference & Recreation Center?',
    a: 'The Grand Ballroom at the Conference & Recreation Center (14075 Frederick Street, Moreno Valley) is an 8,200-square-foot event hall that can accommodate up to 400 guests. It features a full kitchen, a stage, dressing rooms, a full video/movie screen, plus two meeting rooms, a reception patio, and an outdoor banquet patio. Call (951) 413-3280 for current rates and availability.',
  },
]

/**
 * Source: https://moval.org/parks-comm-svc/parks-facilities.html
 *   Senior Community Center — 25075 Fir Avenue.
 *
 *   - Ballroom: 3,500 sq ft
 *   - 200 banquet | 450 theater | 500 standing
 *   - Full kitchen, tables, chairs, 2 meeting rooms
 *   - 951.413.3430
 */
const SENIOR_CENTER_FAQ = [
  {
    q: 'What is the Senior Community Center Banquet Hall?',
    a: 'The Senior Community Center at 25075 Fir Avenue, Moreno Valley, has a 3,500-square-foot ballroom that seats up to 200 banquet-style, 450 theater-style, or 500 standing guests. The hall includes a full kitchen, tables and chairs, plus two meeting rooms. Call (951) 413-3430 for current rates and availability.',
  },
]

/**
 * Source: https://moval.org/parks-comm-svc/parks-facilities.html
 *   TownGate Community Center — 13100 Arbor Park Lane.
 *
 *   - Ballroom: 2,000 sq ft (note: original page has typo "2,00",
 *     corrected here based on context — capacity is clearly 120
 *     banquet / 200 theater)
 *   - 120 banquet | 200 theater
 *   - Full kitchen + covered courtyard overlooking TownGate Memorial Park
 */
const TOWNGATE_CENTER_FAQ = [
  {
    q: 'What is the TownGate Community Center?',
    a: 'The TownGate Community Center at 13100 Arbor Park Lane, Moreno Valley, has a 2,000-square-foot ballroom that can seat up to 120 banquet-style or 200 theater-style guests. It includes a full kitchen, tables and chairs, and a covered courtyard that overlooks TownGate Memorial Park for additional seating. Call (951) 413-3280 for current rates and availability.',
  },
]

/**
 * Source: City of MoVal ArcGIS feature service `MoValOtherParks`
 *   (the secondary service that captures ancillary civic features).
 *
 *   Veterans Memorial — 14075 Frederick St (co-located with the
 *   Conference & Rec Center / Civic Center Amphitheater & Park).
 *   On the dedicated acreage at the corner of Frederick St. and
 *   the Conference Center driveway.
 *
 *   Amenities per the GIS:
 *     - Ceremony Site
 *     - Rose Garden
 *     - Veterans Memorial
 *     - Statue
 */
const VETERANS_MEMORIAL_FAQ = [
  {
    q: 'Where is Veterans Memorial in Moreno Valley?',
    a: 'Veterans Memorial is at 14075 Frederick Street, Moreno Valley, on the same campus as the Conference & Recreation Center and the Civic Center Amphitheater & Park. The memorial features a ceremony site, a rose garden, the veterans memorial itself, and a statue.',
  },
  {
    q: 'What can I do at Veterans Memorial?',
    a: 'Veterans Memorial is a dedicated civic memorial space: a ceremony site, rose garden, the veterans memorial, and a statue. It is colocated with the Conference & Recreation Center and the Civic Center Amphitheater & Park at 14075 Frederick Street.',
  },
]

/**
 * Juan Bautista de Anza Multi-Use Trail — Moreno Valley, CA.
 *
 *   Per the Feb 2024 NPS Partnership Certification (Section 7(h) of the
 *   National Trails System Act), an **8-mile** segment of the
 *   Juan Bautista de Anza National Historic Trail was federally
 *   certified as the City of Moreno Valley's Anza Trail, running from
 *   **Eucalyptus Avenue south to Lasselle Avenue**. Owned and
 *   managed by the City of Moreno Valley Parks & Community Services
 *   Department. The trail is built on a 100-ft-wide **Department of
 *   Water Resources (DWR)** water pipeline easement that runs
 *   diagonally through the city — distinct from (and not the same as)
 *   the California Aqueduct. The city is allowed to install
 *   non-structural improvements such as trails in the easement in
 *   cooperation with DWR.
 *
 *   Source anchors used for the Q&A below:
 *     1) NPS Partnership Certification Agreement (Feb 2024):
 *        http://movalarchive.org/archive/2024/Attachments/Attachment-15325.pdf
 *     2) NPS — "Hike the Anza Trail through Moreno Valley"
 *        https://www.nps.gov/thingstodo/hike-the-anza-trail-through-moreno-valley.htm
 *     3) Smart Cities Dive — 2023 Crown Communities Award writeup:
 *        https://www.smartcitiesdive.com/news/archive-acc-2023-crown-communities-award-winner-the-juan-bautista-multi-use-trail-project-in-moreno-/754345
 *     4) City of MoVal — City Trails page:
 *        http://moval.org/parks-comm-svc/parks-trails.html
 *     5) The 1,200-mile federal recreation trail program:
 *        https://www.nps.gov/juba/planyourvisit/things2do.htm
 */
const ANZA_TRAIL_FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'What is the Juan Bautista Trail in Moreno Valley?',
    a: "It's the 8-mile Moreno Valley segment of the federally certified Juan Bautista de Anza National Historic Trail — a paved, multi-use path that the City of Moreno Valley built and now manages. Per the National Park Service's Feb 2024 Partnership Certification Agreement (Section 7(h) of the National Trails System Act), the trail is owned by the City and managed by the City's Parks & Community Services Department; it sits inside a 100-ft-wide Department of Water Resources (DWR) pipeline easement that runs diagonally through the city.",
  },
  {
    q: 'How long is the Anza Trail in MoVal, and where does it run?',
    a: "The City of Moreno Valley's certified Anza Trail segment is **8 miles**, running from **Eucalyptus Avenue south to Lasselle Avenue** and ultimately connecting to the Lake Perris State Recreation Area to the south. The latest 4-mile phase (the ATP-4 segment, from the Moreno Valley Mall area to Iris Avenue) was substantially completed in late August 2023; the prior four miles were already in place from Segment 1 (Lake Perris SRA → El Potrero Park) and Segment 2 (El Potrero Park → Iris Avenue).",
  },
  {
    q: "Is the Anza Trail in Moreno Valley paved, and is it ADA accessible?",
    a: "Yes on both. Per the NPS certification agreement, the trail surface is **concrete, pavement, and decomposed granite** (with lighting in some sections) and the entire trail segment is **ADA compliant**, with ramps at intersections. It's a flat, paved route suitable for strollers, wheelchairs, and beginner cyclists.",
  },
  {
    q: "Who can use the Anza Trail, and what are the hours?",
    a: "It's a **multi-use trail** for pedestrians, bicyclists, and equestrians — **no motorized vehicles** (per the 2023 Crown Communities award description and the City's own trail rules). It's open **24 hours a day, 7 days a week**, with **no fee or permit** required. Pets must be leashed and you must pick up after them.",
  },
  {
    q: 'What awards and recognition has the Anza Trail gotten?',
    a: "Two industry recognitions on its 2023 completion: (1) the **American City & County 2023 Crown Communities Award** for the multi-phase trail project, and (2) the **Southern California Chapter of the American Public Works Association 2023 B.E.S.T. Project of the Year** award. Both cited the city's work converting an otherwise unused 100-foot DWR pipeline easement into a usable trail.",
  },
  {
    q: "What's the broader Anza Trail that this connects to?",
    a: "Moreno Valley's trail is one continuous segment of the **Juan Bautista de Anza National Historic Trail**, a **1,200-mile** federally designated recreation trail honoring the 1775–1776 expedition led by Spanish commander Juan Bautista de Anza from Sonora, Mexico to San Francisco. It's administered by the National Park Service and spans 14 California counties and 5 Arizona counties; nearly 300 miles have been federally certified as official recreation segments. Moreno Valley's 8-mile segment is in the official recreation trail system (per the NPS Federal Certification, Feb 2024).",
  },
  {
    q: 'How much did the Anza Trail cost, and who paid for it?',
    a: "Total project cost was about **$14.8M**, with **$12.2M from California's Active Transportation Program (Cycles 2, 3, and 4)** — fully state-funded through the California Transportation Commission, with no federal dollars. Per the Crown Communities award writeup, the city worked with local schools and the school district to also promote it as a Safe Route to School path.",
  },
]

/**
 * Map of slug → curated FAQ extras. The seed script reads this map and
 * appends the array to the universal-template FAQs for the matching
 * park. Add new entries here when a park gets a named new feature
 * (ribbon-cutting announcements, a new ball-field lighting project,
 * etc).
 */
export const CURATED_FAQS: Record<string, Array<{ q: string; a: string }>> = {
  'morrison-park': MORRISON_FLIGHT_DECK,
  'cottonwood-golf-center': COTTONWOOD_FAQ,
  'moreno-valley-crc': CRC_FAQ,
  'moreno-valley-senior-center': SENIOR_CENTER_FAQ,
  'towngate-community-center': TOWNGATE_CENTER_FAQ,
  'veterans-memorial': VETERANS_MEMORIAL_FAQ,
  'juan-bautista-trail': ANZA_TRAIL_FAQ,
}
