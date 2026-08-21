/**
 * Per-category editorial content for the /category/[slug] landing pages.
 *
 * Each entry provides:
 *  - intro: 2-3 sentences of editorial copy in the first-person Moreno
 *    Valley voice used elsewhere on the site (see /about-moreno-valley,
 *    /life, /outings). Mentions the live count of businesses and the
 *    top zip code(s) so the copy stays factual.
 *  - metaDescription: 140-160 char description for <meta> and OG.
 *  - faqs: 3 real questions a Moreno Valley resident would ask, with
 *    honest, useful answers. Reused in the inline FAQPage JSON-LD and
 *    the visible <FaqSection>.
 *
 * Content is hand-written (no templating) because mixed-quality copy
 * is the worst outcome for category-page rankings: Google can
 * pattern-match "page is detailed for some categories, thin for others."
 * 22 entries, ~30 minutes per entry to draft, all in the same session
 * so the voice stays consistent.
 *
 * Counts and zips come from a one-off DB probe
 * (scripts/probe-category-counts.mjs) and were last verified 2026-08-21.
 * If the counts drift, update them here — the /category/[slug] page
 * re-queries the live count at render time, so the page heading
 * always reflects the truth, even if this file's intro lags.
 */

export interface CategoryFaq {
  question: string
  answer: string
}

export interface CategoryContent {
  /** 2-3 sentence editorial intro. */
  intro: string
  /** 140-160 char description for metadata + OG. */
  metaDescription: string
  /** 3 honest questions a Moreno Valley resident would ask. */
  faqs: [CategoryFaq, CategoryFaq, CategoryFaq]
}

export const categoryContent: Record<string, CategoryContent> = {
  // 1
  restaurants: {
    intro:
      "Moreno Valley runs on its restaurants — 202 approved and counting, the deepest bench of any category on the directory. The bulk cluster along the 92553 corridor (123 of them) and Alessandro Boulevard, with another strong pocket around the 92557 area. The range is real: family-owned Mexican taquerías that have been here for two decades, new wood-fired pizza and ramen shops that opened in the last year, and every drive-through chain you can name. Use this page to browse the full list; each business links to its own profile with hours, photos, and reviews.",
    metaDescription:
      "Browse all 202 approved restaurants in Moreno Valley, CA. Browse by neighborhood, see photos, hours, and reviews. Updated for 2026.",
    faqs: [
      {
        question: "Where are most Moreno Valley restaurants located?",
        answer:
          "About 60% of Moreno Valley's restaurants cluster in the 92553 ZIP code, especially along Alessandro Boulevard, Sunnymead Boulevard, and the Moreno Valley Mall area. The 92557 area (east side, near Moreno Beach Drive) has another strong concentration. Use the map on each business profile to see the exact location.",
      },
      {
        question: "Do Moreno Valley restaurants offer delivery?",
        answer:
          "Most do — the restaurant profiles on moval.living list each business's website and online ordering links where available. National delivery services (DoorDash, Uber Eats, Grubhub) cover the area broadly; the directory doesn't take a cut or prefer one platform over another.",
      },
      {
        question: "How do I find restaurants open late in Moreno Valley?",
        answer:
          "Open hours are listed on every business profile. For late-night options specifically, filter by your actual time window (most restaurant profiles show 'Open now' status from Google). The directory doesn't have a dedicated late-night filter yet — let us know if that's a feature you'd want.",
      },
    ],
  },

  // 2
  contractors: {
    intro:
      "From small owner-operator crews to full design-build firms, Moreno Valley has 42 approved contractors and construction companies serving the city. The split runs heavily west of the 215 (14 in 92553, 13 in 92557), with another cluster of specialists — electricians, plumbers, HVAC — working the newer builds along the 92555 corridor. Whether you need a full home remodel, a kitchen refresh, an ADU, or a one-day repair, this is where to start looking. Every business here is independently listed; verify licenses through the California State License Board before signing any contract.",
    metaDescription:
      "Browse 42 contractors and construction companies in Moreno Valley, CA. General contractors, remodelers, plumbers, electricians. Updated 2026.",
    faqs: [
      {
        question: "How do I verify a contractor's license in California?",
        answer:
          "Every legitimate California contractor carries a CSL (Contractors State License) number. Verify any contractor you're considering at cslb.ca.gov — the state site shows license status, bond info, workers' comp insurance, and any disciplinary actions. The directory lists a business's website and contact info; license verification is the homeowner's responsibility.",
      },
      {
        question: "Do Moreno Valley contractors pull permits?",
        answer:
          "A licensed contractor should handle all required permits for work that triggers the City of Moreno Valley's building code. Permits are required for most structural, electrical, plumbing, and HVAC work above minor-repair thresholds. A contractor who suggests skipping permits to save money is a red flag.",
      },
      {
        question: "What's the typical cost of a home remodel in Moreno Valley?",
        answer:
          "It depends entirely on scope. A bathroom refresh runs $15K–$30K, a kitchen remodel $40K–$90K, and a full-home renovation $100K–$300K+ for mid-range finishes. The cheapest bid is rarely the best value — get 3 quotes, check references, and confirm timeline and warranty terms in writing.",
      },
    ],
  },

  // 3
  healthcare: {
    intro:
      "Moreno Valley's healthcare network runs from large multi-specialty groups down to solo-practice dentists and therapists — 52 approved businesses in the directory right now, with the heaviest concentration along the 92553 medical corridor and a growing presence in 92557. The directory covers primary care, dental, vision, mental health, pharmacy, and specialty practices (cardiology, pediatrics, OB/GYN, physical therapy). All providers listed here carry California state licensure; insurance acceptance varies by practice and should be confirmed before booking.",
    metaDescription:
      "Find 52 healthcare providers in Moreno Valley, CA — doctors, dentists, specialists, mental health, pharmacy. Updated 2026.",
    faqs: [
      {
        question: "Which hospitals serve Moreno Valley?",
        answer:
          "Riverside University Health System — Medical Center is the public hospital on the west side of the city (26520 Cactus Avenue), and it's a Level II trauma center. Kaiser Permanente Moreno Valley (walking distance from the mall area) and Loma Linda University Medical Center in nearby Loma Linda are common referral destinations. The directory lists the major clinics and group practices; hospital systems have their own physician-finder tools.",
      },
      {
        question: "How do I find a primary care doctor accepting new patients in Moreno Valley?",
        answer:
          "Start with your insurance carrier's provider directory — that's the source of truth for who is in-network and accepting new patients. The moval.living directory complements that with reviews and a map view, but the carrier list is what determines your out-of-pocket cost. Many Moreno Valley primary care practices are independently owned and accept a mix of PPO, HMO, Medicare, and cash.",
      },
      {
        question: "Are there Spanish-speaking healthcare providers in Moreno Valley?",
        answer:
          "Yes — a meaningful share of Moreno Valley's medical practices offer bilingual staff or providers. The directory lets you filter for 'Se habla español' across all categories, not just healthcare. For a specific provider, check their profile or call ahead to confirm the language coverage for the visit you need.",
      },
    ],
  },

  // 4
  retail: {
    intro:
      "Moreno Valley's retail scene mixes national chain stores (the usual suspects in the Moreno Valley Mall and TownGate centers) with a long tail of independent boutiques, thrift shops, and specialty stores — 124 approved businesses in total, the second-deepest category after restaurants. The 92553 area hosts the largest concentration, with another pocket of antique and specialty shops scattered through 92551. From furniture to vape to formal wear to custom framing, this is the directory of every storefront the city has.",
    metaDescription:
      "Browse 124 retail stores in Moreno Valley, CA — boutiques, thrift, specialty shops, and chain stores. Updated 2026.",
    faqs: [
      {
        question: "Where is the main shopping district in Moreno Valley?",
        answer:
          "There's no single 'main street' — Moreno Valley is a car-oriented city, and most retail clusters around the Moreno Valley Mall (off 60 freeway, Moreno Beach Drive exit) and the TownGate center (off the 215). Smaller shopping plazas line Perris Boulevard, Alessandro Boulevard, and Sunnymead Boulevard. Use the directory's map view to see what's near you.",
      },
      {
        question: "Are there any locally-owned retail shops in Moreno Valley?",
        answer:
          "Yes — a lot of them. The directory is biased toward surfacing independent and locally-owned businesses (chain stores get listed too, but independents are the heart of the directory). The 'Best of Moreno Valley' section highlights reader-voted favorites across all categories, including retail.",
      },
      {
        question: "Does Moreno Valley have an antique district?",
        answer:
          "Not formally, but there are clusters. A handful of antique and vintage shops operate along Perris Boulevard and in small plazas in the 92551 and 92557 areas. Inventory rotates constantly — calling ahead is the best way to check what a specific shop has on the floor.",
      },
    ],
  },

  // 5
  'auto-repair': {
    intro:
      "Whether it's an oil change, a transmission rebuild, or a smog check, Moreno Valley's 47 approved auto repair shops are mostly clustered in the 92553 corridor (35 of them, almost 75% of the total). The range runs from dealer-affiliated service centers down to independent mechanic shops that have been in the same family for two decades. Most handle both foreign and domestic, and several specialize (European, diesel, hybrid/EV). Use this list to compare — and always ask for a written estimate before authorizing any work.",
    metaDescription:
      "Find 47 auto repair shops in Moreno Valley, CA — mechanics, transmission, brakes, smog, body shops. Updated 2026.",
    faqs: [
      {
        question: "How do I find a trustworthy mechanic in Moreno Valley?",
        answer:
          "Three things: ask neighbors (the directory's reviews are a start, but word-of-mouth is still the best filter), check the shop's BAR (Bureau of Automotive Repair) registration at bar.ca.gov, and get a written estimate before any work. A good shop will walk you through the estimate line-by-line and tell you what's urgent versus what can wait.",
      },
      {
        question: "Do I need a smog check in Moreno Valley?",
        answer:
          "If you're registering a vehicle in California and it's more than 8 model years old (currently 2018 and older for 2026 renewals), yes — a smog check is required at registration renewal. The directory lists smog-test stations alongside general repair shops; the BAR site has a lookup for stations with recent violations.",
      },
      {
        question: "Where are the most auto repair shops in Moreno Valley?",
        answer:
          "The 92553 corridor is the densest by far — Alessandro Boulevard, Sunnymead Boulevard, and the side streets between them hold most of the city's repair shops. A smaller cluster operates in 92557. Use the directory's map view to see the exact location and hours of any shop.",
      },
    ],
  },

  // 6
  'auto-dealers': {
    intro:
      "Eighteen approved auto dealers serve Moreno Valley, with the heaviest concentration along the 92555 corridor (10 of them) — that's the dealership row off the 215 freeway, anchored by the Inland Empire Auto Center. The mix runs from new-car franchises (every major brand has a presence within a 20-minute drive) to independent used-car lots, with several dealer groups that carry multiple brands under one roof. The directory lists both new and used; check the dealer profile for current inventory, hours, and finance options.",
    metaDescription:
      "Browse 18 auto dealers in Moreno Valley, CA — new and used car dealerships, dealer groups. Updated 2026.",
    faqs: [
      {
        question: "Where is the dealership row in Moreno Valley?",
        answer:
          "The Inland Empire Auto Center runs along the 215 freeway between the 60 and the 215 split — most major new-car brands have a franchise within a 5-mile stretch there. Exit Alessandro Boulevard or Cactus Avenue and you're in the middle of it. Independent used-car lots are scattered through the 92553 and 92555 areas.",
      },
      {
        question: "Should I buy new or used in Moreno Valley?",
        answer:
          "Depends on your budget and priorities. New cars come with full factory warranty, the latest safety tech, and known service history, but they lose 20–30% of value in the first year. A 2-3 year old used car often hits the sweet spot — most modern features, meaningful depreciation absorbed, and you can still get a CPO (certified pre-owned) warranty from most dealer groups.",
      },
      {
        question: "Do Moreno Valley dealers offer financing?",
        answer:
          "Yes — every franchised dealer in the directory has a finance department, and most arrange financing through manufacturer-affiliated lenders (often at sub-market rates for buyers with strong credit). Independent used lots typically work with a wider range of finance companies. The directory doesn't broker financing; contact the dealer directly for current rates and terms.",
      },
    ],
  },

  // 7
  churches: {
    intro:
      "Faith communities are part of what makes Moreno Valley a real city — 26 approved churches, ministries, and faith-based organizations serve the community, spread across the city with the heaviest presence in 92557 and 92553. The directory covers mainstream Protestant, Catholic, Pentecostal, non-denominational, and Spanish-language congregations, plus a handful of faith-based nonprofits. Every church here is independently listed; the directory is non-sectarian and doesn't endorse any specific congregation.",
    metaDescription:
      "Find 26 churches and faith communities in Moreno Valley, CA — Protestant, Catholic, Pentecostal, non-denominational, bilingual. Updated 2026.",
    faqs: [
      {
        question: "How do I find a church in Moreno Valley that fits me?",
        answer:
          "Start with denomination and language — those two filters narrow the list fast. Then look at service times and family programming (most profiles list kids' ministry, youth group, and small groups). Visiting in person is the only real way to feel out a community; expect to try 2–3 before you find your fit.",
      },
      {
        question: "Are there Spanish-language churches in Moreno Valley?",
        answer:
          "Yes — many Moreno Valley churches offer Spanish-language services or have a Spanish-speaking sister congregation, especially in the 92553 and 92557 areas. Look for 'Se habla español' on the profile, or call ahead to confirm the language of the service you plan to attend.",
      },
      {
        question: "Do Moreno Valley churches run community programs?",
        answer:
          "Most do — food pantries, after-school programs, recovery groups (AA, Celebrate Recovery, etc.), ESL classes, and marriage/family support are common. The directory lists the church's main contact info; specific programs are usually on the church's own website or social media.",
      },
    ],
  },

  // 8
  'property-management': {
    intro:
      "Twenty-three property management companies operate in Moreno Valley, mostly serving the west-side apartment communities and the 92551 / 92553 / 92555 corridor. The directory covers residential property managers (apartments, single-family rentals, HOAs) and a few commercial specialists. Whether you're a renter looking for a professionally-managed building or an owner evaluating firms to manage your rental, the list is a starting point — verify licensing and references before signing any management agreement.",
    metaDescription:
      "Find 23 property management companies in Moreno Valley, CA — residential, apartment, HOA, commercial. Updated 2026.",
    faqs: [
      {
        question: "How do property managers charge in Moreno Valley?",
        answer:
          "Residential property managers typically charge 6–10% of monthly rent for full-service management (tenant placement, rent collection, maintenance coordination). Some offer a lower monthly rate with a separate tenant-placement fee (often 50–100% of one month's rent). HOA management is usually a flat monthly fee per unit. Always get a clear fee schedule in writing before signing.",
      },
      {
        question: "Do I need a property manager for a single rental in Moreno Valley?",
        answer:
          "Not necessarily. If you live within driving distance, have time for occasional maintenance calls, and are comfortable screening tenants, self-management is the highest-margin option. A property manager becomes valuable when you're out of area, have multiple doors, or want to scale beyond 2–3 units without it becoming a part-time job.",
      },
      {
        question: "How do I find a well-managed apartment in Moreno Valley?",
        answer:
          "Drive by the property at different times of day (weekday evening and weekend morning tell you the most). Check the city's rental registry and code-violation history if available. Read current tenant reviews on Google and Yelp, and ask the manager directly about average tenant tenure (under 12 months is a yellow flag).",
      },
    ],
  },

  // 9
  'non-profits': {
    intro:
      "Nineteen approved non-profits serve Moreno Valley, ranging from major civic organizations to small faith-based and community groups. The 92553 ZIP hosts the deepest concentration (8 organizations), with another pocket in 92557. The directory covers charities, civic groups, cultural associations, youth and family services, recovery and reentry programs, and advocacy organizations. Every non-profit listed here has 501(c)(3) status or is a registered religious/civic organization; verify any donation through the IRS Tax Exempt Organization Search.",
    metaDescription:
      "Find 19 non-profit organizations serving Moreno Valley, CA — charities, civic groups, family services, recovery. Updated 2026.",
    faqs: [
      {
        question: "How do I verify a non-profit is legitimate?",
        answer:
          "Search the IRS Tax Exempt Organization Search (teos.irs.gov) for the organization's EIN — that confirms 501(c)(3) status and current standing. Check Charity Navigator or GuideStar for program-level transparency and financial health. A legitimate non-profit will always give you their EIN and recent financials on request.",
      },
      {
        question: "Where do Moreno Valley non-profits cluster?",
        answer:
          "The 92553 corridor is the densest, especially along Alessandro Boulevard and the side streets around the civic center area. Several faith-based non-profits operate out of local churches (see the Churches category). The directory's map view shows the exact location of each organization.",
      },
      {
        question: "Can I volunteer with Moreno Valley non-profits?",
        answer:
          "Yes — most non-profits listed here welcome volunteers, and several rely on volunteer labor for their core programs. Reach out to the organization directly through their profile. The City of Moreno Valley also runs a volunteer program through the Community Services Department.",
      },
    ],
  },

  // 10
  'supply-logistics': {
    intro:
      "Moreno Valley sits at the intersection of the 60 and 215 freeways, with direct access to the Inland Empire's warehouse and logistics economy — seven approved supply and logistics companies are based in the city, clustered in the 92551 industrial area on the west side. The directory covers trucking, warehousing, distribution, foreign trade zone operators, material handling, and wholesale supply. Most serve regional and national clients; the directory is a starting point for sourcing a local partner if you need freight, storage, or wholesale supply in the IE.",
    metaDescription:
      "Find 7 supply and logistics companies in Moreno Valley, CA — trucking, warehousing, distribution, wholesale. Updated 2026.",
    faqs: [
      {
        question: "Does Moreno Valley have a foreign trade zone?",
        answer:
          "Yes — the Moreno Valley Foreign Trade Zone (FTZ #245) is operated through a partnership with the city and covers industrial properties in the western part of the city. FTZ designation allows companies to defer, reduce, or eliminate U.S. Customs duties on imported goods. Reach out to the city's Economic Development Department for the current list of activated sites.",
      },
      {
        question: "Where are the warehouse districts in Moreno Valley?",
        answer:
          "The 92551 ZIP code holds most of the city's warehouse and industrial property, especially along the 215 freeway corridor between the 60 split and Alessandro Boulevard. Newer logistics builds have extended east toward the 215 / Cactus Avenue area.",
      },
      {
        question: "What kinds of logistics companies are based here?",
        answer:
          "Mostly regional — last-mile delivery, short-haul trucking, third-party warehousing (3PL), and wholesale distribution. The directory lists the approved businesses; for national carriers, contact their local terminal directly.",
      },
    ],
  },

  // 11
  entertainment: {
    intro:
      "Sixteen approved entertainment businesses operate in Moreno Valley, with most of the action in the 92553 corridor (10 of them). The directory covers movie theaters, bowling alleys, trampoline parks, escape rooms, immersive experiences, event venues, and live entertainment. Moreno Valley is also a 30-minute drive from Riverside's downtown entertainment district and the larger IE venues, so this list leans local — what you can do without leaving the city. Use it to find a Saturday-afternoon activity or a venue for a private event.",
    metaDescription:
      "Find 16 entertainment venues in Moreno Valley, CA — theaters, bowling, trampoline, escape rooms, live events. Updated 2026.",
    faqs: [
      {
        question: "What's there to do in Moreno Valley on weekends?",
        answer:
          "Plenty — the directory lists the 16 approved entertainment venues, but Moreno Valley is also minutes from Lake Perris (boating, fishing, swimming), the BoxSprings Mountain Reserve (hiking, mountain biking), and March Field Air Museum. For indoor options, the Moreno Valley Mall has a movie theater and there's a family entertainment center near the mall with bowling and arcade.",
      },
      {
        question: "Does Moreno Valley have live music venues?",
        answer:
          "Not dedicated music clubs in the city proper — most live music happens at bars, restaurants, and seasonal events. The TownGate area and the 92553 corridor have a few bars and restaurants that host live music on weekends. For larger concerts, the Riverside Municipal Auditorium and the Fox Performing Arts Center in downtown Riverside are 20 minutes west.",
      },
      {
        question: "Can I rent an event venue in Moreno Valley?",
        answer:
          "Yes — several of the entertainment venues in the directory offer private event rentals (bowling alleys, escape rooms, and event spaces). For weddings and large private events, hotel ballrooms in 92553 and the city's conference center are the most common options.",
      },
    ],
  },

  // 12
  professional: {
    intro:
      "Sixty approved professional services businesses operate in Moreno Valley, with the heaviest concentration in 92553 (46 of them) and a smaller cluster in 92551. The category covers attorneys, accountants, financial advisors, real estate agents, insurance brokers, marketing agencies, business consultants, tax preparers, and notary services. Every business listed here is independently operated; verify any professional's license through the relevant California state board before retaining them.",
    metaDescription:
      "Find 60 professional services in Moreno Valley, CA — attorneys, accountants, financial advisors, real estate, marketing. Updated 2026.",
    faqs: [
      {
        question: "How do I find a good attorney in Moreno Valley?",
        answer:
          "Start with the practice area you need (family law, estate planning, personal injury, immigration, criminal defense, etc.) — Moreno Valley has solo practitioners in most areas, plus several multi-attorney firms. The California State Bar's directory at calbar.ca.gov lets you verify any attorney's license and check for disciplinary history. Most attorneys offer a free or low-cost initial consultation.",
      },
      {
        question: "How do I find a CPA for personal taxes in Moreno Valley?",
        answer:
          "Look for a CPA (not just a 'tax preparer') for anything beyond a straightforward 1040 — the credential means they've passed the Uniform CPA Exam and met state licensing requirements. The California Board of Accountancy's licensee lookup at search.dca.ca.gov lets you verify any CPA in good standing. Many Moreno Valley CPAs also do small-business bookkeeping and advisory work.",
      },
      {
        question: "Are there financial advisors in Moreno Valley?",
        answer:
          "Yes — both independent fee-only advisors and brokers affiliated with national firms. A fee-only fiduciary advisor (look for the CFP designation and the 'fiduciary' language) is required by law to put your interests first. For brokers, understand the fee structure before signing anything — commission-based advice isn't always aligned with your best interest.",
      },
    ],
  },

  // 13
  insurance: {
    intro:
      "Nine approved insurance agencies serve Moreno Valley, with eight of them clustered in 92553. The category covers auto, home, life, health, and commercial insurance — most are independent agencies that shop multiple carriers for you, which is the right model for almost any personal or small-business insurance need. Compare quotes from at least 2–3 agencies before binding; pricing for the same coverage can vary by 20% or more between carriers, and an independent agent can usually beat a captive agent's quote.",
    metaDescription:
      "Find 9 insurance agencies in Moreno Valley, CA — auto, home, life, health, commercial. Updated 2026.",
    faqs: [
      {
        question: "Should I use an independent or captive insurance agent?",
        answer:
          "An independent agent shops multiple carriers and can usually find you a better price for the same coverage. A captive agent (State Farm, Allstate, Farmers) only writes for one carrier, so they're limited to that carrier's products and pricing. For most personal lines (auto, home, life), an independent agent is the right call. For commercial insurance, it depends — some carriers write only through their own agents.",
      },
      {
        question: "How much does auto insurance cost in Moreno Valley?",
        answer:
          "California average is around $2,400/year for full coverage, but Moreno Valley rates trend slightly higher than the state average because of local traffic and theft statistics. Your rate depends on your driving record, vehicle, coverage limits, and deductible. Always shop at renewal — the carriers you had three years ago may not be the cheapest option today.",
      },
      {
        question: "Do I need flood insurance in Moreno Valley?",
        answer:
          "If your property is in a designated flood zone (FEMA Special Flood Hazard Area) and you have a mortgage, your lender requires it. If you're outside a high-risk zone, it's still worth considering — standard homeowners policies exclude flood, and even a few inches of water can cause tens of thousands in damage. Talk to your insurance agent about your specific address.",
      },
    ],
  },

  // 14
  dispensaries: {
    intro:
      "Three licensed cannabis dispensaries operate in Moreno Valley, with two of them in 92553 and one in 92557. The category is small but regulated — every dispensary in the directory holds a current California state cannabis license and a Moreno Valley business license. Recreational sales (adult-use) are legal for adults 21+; medical patients with a physician's recommendation have access to the same products with different purchase limits. The directory does not sell or promote any specific products; it lists the licensed retailers and their hours.",
    metaDescription:
      "Find 3 licensed cannabis dispensaries in Moreno Valley, CA — recreational and medical cannabis. Updated 2026.",
    faqs: [
      {
        question: "Is recreational cannabis legal in Moreno Valley?",
        answer:
          "Yes — California legalized adult-use cannabis in 2016 (Prop 64), and Moreno Valley permits licensed retail dispensaries. Adults 21 and older can purchase up to one ounce of flower or 8 grams of concentrate per visit. You need a valid government-issued ID; out-of-state IDs are accepted.",
      },
      {
        question: "How do I know a dispensary is licensed?",
        answer:
          "Every legal dispensary in California holds a state license from the Department of Cannabis Control (DCC). Verify at cannabis.ca.gov — the license lookup shows the license type (retail, delivery, microbusiness), expiration, and any disciplinary actions. Unlicensed shops are illegal and their products are unregulated.",
      },
      {
        question: "Do Moreno Valley dispensaries deliver?",
        answer:
          "Some do — delivery is licensed separately by the DCC and requires the business to have a delivery-only or non-storefront license. Check the individual dispensary's profile for current delivery zones, minimum order, and fees.",
      },
    ],
  },

  // 15
  hospitality: {
    intro:
      "Twelve approved hotels, motels, and extended-stay properties serve Moreno Valley, almost all of them in the 92553 corridor near the freeway interchanges. The directory covers national-brand hotels (the usual chain options) and a handful of independent properties and extended-stay suites for longer visits. Whether you're in town for a one-night layover, a multi-week work assignment, or visiting family, this is where to start. Compare rates across the usual booking platforms — pricing for the same hotel can vary 20%+ depending on where you book.",
    metaDescription:
      "Find 12 hotels and lodging in Moreno Valley, CA — chain hotels, motels, extended-stay. Updated 2026.",
    faqs: [
      {
        question: "Where do most Moreno Valley hotels cluster?",
        answer:
          "The 92553 corridor along the 215 freeway, especially near the 60/215 split and around the Moreno Valley Mall area. The location is convenient for travelers heading to or from the Inland Empire and the desert communities; downtown Riverside is 20 minutes west, Palm Springs is 45 minutes east.",
      },
      {
        question: "Are there extended-stay hotels in Moreno Valley?",
        answer:
          "Yes — several of the listings in this category are extended-stay properties with kitchenettes and weekly rates. Useful for work assignments, family visits, or temporary housing during a move. Compare weekly vs. monthly rates up front; some properties negotiate long-stay rates that aren't posted online.",
      },
      {
        question: "How do I find the best hotel rate in Moreno Valley?",
        answer:
          "Compare the hotel's own website, the major booking platforms (Booking.com, Expedia, Hotels.com), and the chain's loyalty program if you're a member. The hotel's direct site often matches the lowest third-party rate and may include free breakfast or a later cancellation. For last-minute same-day bookings, calling the property directly can sometimes beat online rates.",
      },
    ],
  },

  // 16
  'service-clubs': {
    intro:
      "Five approved service clubs operate in Moreno Valley — Rotary, Lions, Kiwanis, Optimist, Elks, and similar community organizations. The category is small but real: these are the groups that run the city's major civic fundraisers, scholarship programs, and volunteer projects. Membership is by invitation or application, and most clubs meet weekly. If you're new to the city and want to plug in, a service club is one of the fastest ways to meet a cross-section of Moreno Valley residents and give back at the same time.",
    metaDescription:
      "Find 5 service clubs in Moreno Valley, CA — Rotary, Lions, Kiwanis, Optimist, Elks. Updated 2026.",
    faqs: [
      {
        question: "How do I join a service club in Moreno Valley?",
        answer:
          "Most clubs invite visitors to attend 2–3 meetings before committing. Reach out through the club's profile to confirm the next meeting time and any guest logistics (some meet at restaurants for breakfast or lunch, others in the evening). Expect a brief application and a member-sponsor process. Annual dues vary by club but are typically $200–$500/year.",
      },
      {
        question: "What do service clubs in Moreno Valley do?",
        answer:
          "Most run 1–2 major annual fundraisers (golf tournaments, pancake breakfasts, casino nights), give out scholarships to local high school students, and provide volunteer labor for city events and nonprofit partners. Rotary International's global polio-eradication effort is a signature cause for the Rotary clubs specifically.",
      },
      {
        question: "Is there a difference between Rotary, Lions, and Kiwanis?",
        answer:
          "All three are international civic organizations with local chapters, similar in structure (weekly meetings, fundraising, community service). Rotary and Kiwanis skew professional; Lions has a stronger focus on vision and disability services. The right fit is usually the one whose members you enjoy meeting — visit two or three and decide from there.",
      },
    ],
  },

  // 17
  beauty: {
    intro:
      "Fifty-seven approved beauty and wellness businesses operate in Moreno Valley — the deepest wellness bench outside of healthcare. Salons, barbershops, nail salons, day spas, massage therapists, gyms, yoga and pilates studios, and med-spa services (Botox, fillers, laser) all live in this category. The 92553 corridor is the densest (32 businesses), with another pocket in 92557. Every business here is independently operated; verify any medical-aesthetic provider's credentials through the California Board of Barbering and Cosmetology or the Medical Board for physician-supervised services.",
    metaDescription:
      "Find 57 beauty and wellness businesses in Moreno Valley, CA — salons, barbers, nails, spas, gyms, yoga. Updated 2026.",
    faqs: [
      {
        question: "Are there good barbershops in Moreno Valley?",
        answer:
          "Yes — the directory lists 57 beauty and wellness businesses, and a meaningful number of them are dedicated barbershops. The 92553 corridor has the highest concentration. Look for shops that take walk-ins (most do) and have stylists with strong Google reviews; the price range in Moreno Valley is typically $20–$40 for a standard cut.",
      },
      {
        question: "How do I find a good nail salon in Moreno Valley?",
        answer:
          "California requires every nail technician to hold a state license from the Board of Barbering and Cosmetology. The Board's license lookup at search.dca.ca.gov lets you verify any individual technician. Cleanliness is the most important in-person check — properly sterilized tools, single-use files and buffers, and visible sanitation stations.",
      },
      {
        question: "Are there good gyms and yoga studios in Moreno Valley?",
        answer:
          "Both — the directory lists the major national chains (24 Hour Fitness, Planet Fitness, Crunch) and a handful of independent strength-training and yoga studios. For yoga specifically, look for studios that publish their class schedule and teacher bios online; the drop-in rate is usually $15–$25 for a single class with no commitment.",
      },
    ],
  },

  // 18
  'home-services': {
    intro:
      "Twenty-four approved home services businesses operate in Moreno Valley, covering landscaping, cleaning, pest control, HVAC, painting, pool service, and handyman work. The 92553 corridor holds the densest cluster (12 businesses), with another strong pocket in 92557. Most are owner-operators with one or two crews; a few are larger multi-trade firms. The directory is a starting point — always get 2–3 quotes, check references, and confirm insurance and license status before any work begins.",
    metaDescription:
      "Find 24 home services in Moreno Valley, CA — landscaping, cleaning, pest control, HVAC, painting, handyman. Updated 2026.",
    faqs: [
      {
        question: "How do I find a reliable house cleaner in Moreno Valley?",
        answer:
          "Start with the directory and check Google reviews for recent feedback (last 6 months matters more than lifetime score). Ask the cleaner whether they're employees or independent contractors — employees are covered by the company's insurance and workers' comp; independent contractors may not be. Always confirm insurance and get a clear scope of work in writing before the first visit.",
      },
      {
        question: "How often does Moreno Valley need pest control?",
        answer:
          "Depends on the property. Newer construction with slab foundations and tight seals usually needs quarterly exterior-only treatment. Older homes, homes near open space, or homes with prior termite history may need monthly or bi-monthly service. A good pest-control operator will inspect first and recommend a schedule based on what they actually find, not a one-size-fits-all plan.",
      },
      {
        question: "How do I find a good HVAC company in Moreno Valley?",
        answer:
          "Look for a company that services all major brands (Carrier, Trane, Lennox, Rheem) rather than a dealer for one. Verify any HVAC contractor's license through the CSLB (cslb.ca.gov) — HVAC work in California requires a C-20 license. For a new install, get 2–3 written quotes with model numbers and SEER ratings so you can compare apples to apples.",
      },
    ],
  },

  // 19
  education: {
    intro:
      "Ninety-three approved education and tutoring businesses operate in Moreno Valley — one of the deepest categories on the directory. The mix runs from K–12 tutoring centers and test-prep services to music and driving schools, adult education, ESL, and homeschool co-ops. The 92553 corridor holds the densest cluster (25 businesses), with another pocket in 92551. The directory is non-sectarian and doesn't endorse any specific program; verify any tutoring center's accreditation through the organization that issues the credential (College Board for AP prep, etc.).",
    metaDescription:
      "Find 93 education and tutoring businesses in Moreno Valley, CA — K-12, test prep, music, driving, ESL, homeschool. Updated 2026.",
    faqs: [
      {
        question: "How do I find a good tutor in Moreno Valley?",
        answer:
          "Start with the subject and grade level — most tutors specialize (algebra, AP biology, Spanish, early reading). The College Board's AP Classroom and Wyzant are good national directories; for local in-person tutoring, the directory's map view shows who's near you. Always ask for a free diagnostic session before committing to a package — a good tutor will identify your gaps in 30 minutes.",
      },
      {
        question: "Are there good music schools in Moreno Valley?",
        answer:
          "Yes — the directory lists several. For piano and guitar especially, there are private instructors and small studios across the city. For drums, voice, and orchestral instruments, expect to drive to Riverside or Redlands. Lessons are typically $25–$60 per 30-minute session depending on the teacher and format.",
      },
      {
        question: "Where do I take driving lessons in Moreno Valley?",
        answer:
          "Licensed driving schools in California are regulated by the DMV. Every approved driving school carries a DMV-issued license number — verify at dmv.ca.gov. For teens, the standard package is 6 hours of behind-the-wheel + 30 hours of online or classroom instruction. Adult lessons are usually hourly with no minimum package.",
      },
    ],
  },

  // 20
  pets: {
    intro:
      "Moreno Valley's pet care network covers veterinary clinics, pet stores, groomers, dog walkers, and boarding facilities. The directory lists the businesses operating in the city, with the heaviest concentration in 92553 and 92557. For veterinary care specifically, every clinic carries a state license from the California Veterinary Medical Board — verify at vmb.ca.gov. For boarding and grooming, ask for a tour before booking; a clean, well-staffed facility should welcome unannounced visits.",
    metaDescription:
      "Find pet care in Moreno Valley, CA — vets, pet stores, groomers, walkers, boarding. Updated 2026.",
    faqs: [
      {
        question: "Where is the nearest emergency vet to Moreno Valley?",
        answer:
          "The closest 24-hour emergency veterinary hospital to Moreno Valley is the California Veterinary Specialists in Ontario (about 25 minutes west on the 60), with the Veterinary Emergency Center in Redlands as a secondary option (about 30 minutes east). The directory's vets page filters for clinics that handle urgent care; for true emergencies, call ahead before driving in.",
      },
      {
        question: "How do I find a good dog groomer in Moreno Valley?",
        answer:
          "Look for groomers with verifiable experience with your breed (a standard poodle groom and a border collie groom are different skill sets). Mobile grooming is widely available in the IE and reduces stress for anxious dogs. Expect $50–$120 for a full groom depending on breed, coat, and add-ons.",
      },
      {
        question: "Are there dog parks in Moreno Valley?",
        answer:
          "Yes — the directory's parks section lists the city parks with off-leash areas. The two most popular are the Moreno Valley Dog Park (on the west side, off Alessandro) and the Sunnymead Park area. Always check the posted rules before visiting; most require current rabies vaccination and a county dog license.",
      },
    ],
  },

  // 21
  finance: {
    intro:
      "Moreno Valley's financial services include the major national banks (Chase, Bank of America, Wells Fargo, US Bank), credit unions serving the IE, and independent loan officers, mortgage brokers, and financial advisors. The directory is a starting point for finding a local branch or a licensed professional. For deposits and basic banking, the national banks have branches throughout the city. For loans and mortgages, an independent broker can usually shop multiple lenders for you, which is the right call for most borrowers.",
    metaDescription:
      "Find banks, credit unions, and financial services in Moreno Valley, CA — deposits, loans, mortgages, advisors. Updated 2026.",
    faqs: [
      {
        question: "What banks have branches in Moreno Valley?",
        answer:
          "All of the major national retail banks — Chase, Bank of America, Wells Fargo, US Bank, and Citibank — operate branches in Moreno Valley. The 92553 corridor along Alessandro Boulevard has the highest density. For credit unions, the Inland Empire's biggest is the Arrowhead Credit Union, with several branches in the area.",
      },
      {
        question: "How do I find a mortgage broker in Moreno Valley?",
        answer:
          "The California Department of Real Estate (DRE) licenses mortgage brokers — verify any broker at dre.ca.gov. A good broker will pull your credit, gather your income documentation, and shop 5–10 lenders for the best rate and term. The broker's fee is usually 1–2% of the loan amount, paid by the lender (so the service is free to you as the borrower, but the rate may be slightly higher than a direct lender would offer).",
      },
      {
        question: "Should I use a credit union or a bank in Moreno Valley?",
        answer:
          "For most people, a credit union is the right call for deposits and consumer loans — typically better rates on savings, lower fees, and lower rates on auto and personal loans. The tradeoff is fewer physical branches and a more limited app experience than the big national banks. For mortgages, the credit union vs. bank comparison is less clear; shop both.",
      },
    ],
  },

  // 22
  'real-estate': {
    intro:
      "Thirty-seven approved real estate and mortgage businesses operate in Moreno Valley — the directory's home for the full real estate vertical. Realtors, mortgage brokers, title companies, appraisers, and property managers are all listed here. Every licensed real estate agent in California carries a DRE (Department of Real Estate) license number — verify at dre.ca.gov before retaining anyone. For buying or selling, the directory's map view and review filter are useful starting points, but the right agent is the one who knows your specific neighborhood.",
    metaDescription:
      "Find 37 real estate professionals in Moreno Valley, CA — realtors, mortgage brokers, title, appraisers. Updated 2026.",
    faqs: [
      {
        question: "How do I find a good realtor in Moreno Valley?",
        answer:
          "Start with hyperlocal knowledge — a realtor who works the specific neighborhood you're interested in will know the price-per-square-foot trends, the school district boundaries, and the inventory before it hits MLS. The directory's map view helps you see which agents list in your target ZIP code. Verify any agent's license at dre.ca.gov and ask for a list of their last 10 transactions in your area.",
      },
      {
        question: "What is the current Moreno Valley real estate market like?",
        answer:
          "As of mid-2026, Moreno Valley is a balanced market — inventory is up from the 2021–2023 lows, days-on-market is around 30, and price-per-square-foot has held roughly flat for the last 12 months. The /about-moreno-valley page has the most recent market statistics; the live data updates monthly.",
      },
      {
        question: "Do I need a buyer's agent in Moreno Valley?",
        answer:
          "Strictly speaking, no — buyer representation is optional, and you can work directly with the listing agent. In practice, though, a dedicated buyer's agent (signed agreement before you tour) gives you fiduciary duty, negotiation support, and MLS access at no additional cost to you (the seller pays both agents from the commission). The exception is new construction, where the on-site agent represents the builder.",
      },
    ],
  },
}

/** Lookup helper. */
export function getCategoryContent(slug: string): CategoryContent | undefined {
  return categoryContent[slug]
}
