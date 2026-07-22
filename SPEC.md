# SPEC.md — moval.living

## 1. Concept & Vision

**moval.living** is a bright, modern local business directory for Moreno Valley, California — designed to be the go-to resource for residents and visitors finding trusted local businesses. The site feels energetic and trustworthy: a community hub that elevates local entrepreneurs. The long-term business model is two-fold: (1) directory revenue via paid listing tiers, and (2) a sales funnel where unlisted businesses become web design clients via GoHighLevel.

**Tagline:** *Moreno Valley's Local Business Hub*

---

## 2. Design Language

### Aesthetic Direction
Modern, clean, and vibrant — inspired by successful local directories like VegasThrive and NVLocalThrive but with fresher, more contemporary polish. Think bold section dividers, card-based layouts, and confident use of whitespace.

### Color Palette
- **Primary:** `#2563EB` (bright blue — trust, community)
- **Secondary:** `#0EA5E9` (sky blue — energy, openness)
- **Accent:** `#F97316` (warm orange — CTAs, highlights, urgency)
- **Background:** `#F8FAFC` (off-white — clean, readable)
- **Surface:** `#FFFFFF` (white — cards, modals)
- **Text Primary:** `#0F172A` (near-black)
- **Text Secondary:** `#64748B` (muted slate)
- **Success:** `#22C55E`
- **Error:** `#EF4444`

### Typography
- **Headings:** `Inter` (Google Fonts) — bold, modern, confident
- **Body:** `Inter` — consistent and highly readable
- **Monospace:** `JetBrains Mono` — for any code/technical elements
- Scale: 14px base, 1.25 modular scale

### Spatial System
- Base unit: 4px
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96px
- Card border-radius: 12px
- Button border-radius: 8px
- Max content width: 1280px

### Motion Philosophy
- Subtle and purposeful — no gratuitous animation
- Hover transitions: 150ms ease-out (scale, color, shadow)
- Page entrances: fade-in 300ms ease-out
- Modal/drawer: slide-in 200ms ease-out
- Skeleton loaders on async content

### Visual Assets
- Icons: Lucide React (consistent, clean line icons)
- Images: Unsplash for hero/category imagery via direct URLs
- Decorative: CSS gradient backgrounds, subtle geometric shapes

---

## 3. Layout & Structure

### Site Architecture
```
/ (Home)
/search (Directory search + browse)
/business/[slug] (Business detail page)
/submit (Submit a new business)
/claim (Claim a business listing)
/login (Business owner login)
/dashboard (Owner dashboard — claimed businesses, edit, reviews)
/dashboard/business/[id]/edit (Edit business details)
/dashboard/reviews (Manage reviews)
```

### Home Page Sections
1. **Hero** — Full-width gradient hero, tagline, prominent search bar, category quick-links
2. **Featured Businesses** — Horizontally scrollable card row (paid tier)
3. **Browse by Category** — Grid of category cards with icons + count
4. **How It Works** — 3-step section (Search → Connect → Support)
5. **Recent Reviews** — Latest community reviews with star ratings
6. **CTA Banner** — "Own a business? Get listed free" + upsell to paid
7. **Footer** — Links, social, contact, copyright

### Responsive Strategy
- Mobile-first breakpoints: sm(640), md(768), lg(1024), xl(1280)
- Category grid: 2-col mobile → 3-col tablet → 4-col desktop
- Business cards: 1-col mobile → 2-col tablet → 3-col desktop
- Search bar: full-width on mobile, centered max-2xl on desktop

---

## 4. Features & Interactions

### Core Features

#### 4.1 Directory Search & Browse
- Full-text search by business name, category, keyword
- Filter by: category, rating, tier (featured/standard)
- Sort by: relevance, newest, highest-rated, alphabetical
- Paginated results (20 per page)
- URL-reflected filters (shareable search links)
- Empty state: friendly message + "Submit this business" CTA

#### 4.2 Business Listing Pages
Each business profile includes:
- Business name, logo, cover image, tagline
- Category breadcrumb
- Contact: phone, email, website link, address
- Google Maps embed (using Johnny's API key)
- Hours of operation (with open/closed status)
- Social links (Facebook, Instagram, Yelp, Google Business)
- Business description (SEO-rich, 300+ words encouraged)
- Photo gallery (up to 8 photos)
- Reviews section with star rating breakdown
- "Contact Business" form (routes through GHL)
- CTA: "Want a website like this?" → GoHighLevel funnel
- Claim badge if owner-verified

#### 4.3 Self-Service Business Submission
- Multi-step form: Basic Info → Location → Contact → Description → Photos → Review
- Category selection with search
- Address autocomplete (Google Places API)
- Image upload (up to 5 photos)
- Submission enters "pending" state until admin or auto-approved
- Email notification on approval

#### 4.4 Business Claiming & Owner Dashboard
- "Claim This Business" button → email verification flow
- Owner registers/login → links account to business
- Dashboard: edit all business fields, upload photos, manage hours
- Reviews management: respond to reviews, flag inappropriate
- Tier upgrade CTA within dashboard
- Analytics: view count, search position

#### 4.5 Reviews System
- Logged-in users can leave a review (1 per business)
- Star rating (1-5) + written review
- Owner can respond to reviews
- Admin can flag/delete reviews
- Aggregate rating recalculates on new review

#### 4.6 Paid Tiers
| Feature | Free | Featured |
|---|---|---|
| Basic listing | ✅ | ✅ |
| Contact info | ✅ | ✅ |
| Map embed | ✅ | ✅ |
| Photos (up to 3) | ✅ | ✅ |
| Reviews | ✅ | ✅ |
| Featured badge | ❌ | ✅ |
| Homepage featured section | ❌ | ✅ |
| Priority search ranking | ❌ | ✅ |
| Photos (up to 8) | ❌ | ✅ |
| Social links | ❌ | ✅ |
| Analytics | Basic | Full |

#### 4.7 GoHighLevel Integration
- Contact form submissions routed to GHL via webhook/API
- "Get a Website" CTA routes to GHL funnel
- GHL handles email nurturing sequences

#### 4.8 Email (AWS SES)
- Review notification to business owner
- New submission admin alert
- Approval/rejection notification to submitter
- Welcome email on claim verification

### Interaction Details
- Search: debounced 300ms, instant results preview
- Business card hover: slight scale (1.02) + shadow elevation
- "Load more" replaces pagination on mobile
- Star rating input: hover preview before click confirm
- Image gallery: click to expand lightbox

### Edge Cases
- Duplicate business submission: prompt to claim instead
- Business with no reviews: show "Be the first to review" prompt
- API failures: skeleton loaders → inline error with retry
- Map load failure: show address as text fallback

---

## 5. Component Inventory

### Navigation
- **Header:** Logo, nav links (Home, Browse, Submit, Login), "List Your Business" CTA button. Sticky on scroll with blur backdrop.
- **Mobile Menu:** Slide-in drawer from right, full-height, overlay backdrop
- **Footer:** 4-column layout (About, Categories, For Businesses, Legal), social icons

### Business Card
- States: default, hover (elevated shadow + scale), featured (accent border + badge)
- Shows: thumbnail, name, category, star rating, short description snippet, location

### Search Bar
- Large, prominent input with search icon
- Category filter dropdown inline
- States: empty, typing (with suggestions dropdown), submitted

### Category Card
- Icon (Lucide), category name, business count
- Hover: background color shift + slight scale

### Review Card
- Reviewer name + avatar, star rating, date, review text
- Owner response (if any) indented below

### Business Submission Form
- Multi-step with progress indicator
- Each step: label, input, validation message, "Next/Back" buttons
- Final step: summary review + submit

### Owner Dashboard
- Sidebar navigation
- Business list (if owner has multiple claimed businesses)
- Edit form: same fields as submission, pre-populated
- Reviews tab: list of all reviews with respond/flag actions

---

## 6. Technical Approach

### Stack
- **Framework:** Next.js 14+ (App Router, React Server Components)
- **Styling:** Tailwind CSS v3
- **Language:** TypeScript
- **Database:** Neon DB (PostgreSQL)
- **ORM:** Prisma
- **Auth:** NextAuth.js v5 (credentials + email magic link)
- **Maps:** Google Maps JavaScript API (Johnny's key)
- **Email:** AWS SES via nodemailer
- **Marketing:** GoHighLevel (webhooks for form submissions)
- **Hosting:** Vercel (frontend) + Neon DB (database)

### Database Schema (Prisma)

```prisma
model Business {
  id            String    @id @default(cuid())
  slug          String    @unique
  name          String
  tagline       String?
  description   String
  categoryId    String
  category      Category  @relation(fields: [categoryId], references: [id])
  tier          Tier      @default(FREE)
  status        Status    @default(PENDING)
  
  // Contact
  email         String?
  phone         String?
  website       String?
  address       String
  city          String    @default("Moreno Valley")
  state         String    @default("CA")
  zip           String
  latitude      Float?
  longitude     Float?
  
  // Media
  logo          String?
  coverImage    String?
  photos        String[]  // JSON array of URLs
  
  // Social
  facebook      String?
  instagram     String?
  yelp          String?
  googleBusiness String?
  
  // Hours (JSON)
  hours         Json?     // { mon: {open: "9am", close: "5pm"}, ... }
  
  // SEO
  metaTitle     String?
  metaDescription String?
  
  // Relations
  owner         Owner?    @relation(fields: [ownerId], references: [id])
  ownerId       String?
  reviews       Review[]
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Category {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  description String?
  icon        String    // Lucide icon name
  businesses  Business[]
  createdAt   DateTime  @default(now())
}

model Owner {
  id          String    @id @default(cuid())
  email       String    @unique
  name        String?
  business    Business?
  createdAt   DateTime  @default(now())
}

model Review {
  id         String    @id @default(cuid())
  businessId String
  business   Business  @relation(fields: [businessId], references: [id])
  authorName String
  authorEmail String?
  rating     Int       // 1-5
  content    String
  response   String?   // Owner response
  flagged    Boolean   @default(false)
  createdAt  DateTime  @default(now())
}

enum Tier {
  FREE
  FEATURED
}

enum Status {
  PENDING
  APPROVED
  REJECTED
}
```

### API Routes
```
POST   /api/businesses          Create/submit new business
GET    /api/businesses          List/search businesses
GET    /api/businesses/[slug]   Get single business
PUT    /api/businesses/[slug]   Update business (owner/admin)
DELETE /api/businesses/[slug]   Delete business (admin)

GET    /api/categories          List all categories

POST   /api/reviews             Create review
GET    /api/businesses/[slug]/reviews  Get reviews for business
PUT    /api/reviews/[id]        Update/respond to review

POST   /api/auth/[...nextauth]  NextAuth handlers

POST   /api/contact             Route contact form to GHL
POST   /api/claim               Initiate business claim flow
```

### Environment Variables
```
DATABASE_URL=           # Neon DB connection string
NEXTAUTH_SECRET=        # Random secret for NextAuth
NEXTAUTH_URL=           # https://moval.living
GOOGLE_MAPS_API_KEY=    # Johnny's existing key
GHL_API_KEY=            # GoHighLevel API key
GHL_WEBHOOK_URL=        # GHL webhook for contact form
AWS_SES_ACCESS_KEY=     # AWS SES access key
AWS_SES_SECRET_KEY=     # AWS SES secret key
AWS_SES_REGION=         # e.g. us-west-2
```

### Third-Party Integrations
- **Google Maps:** Maps JavaScript API for embed + Places API for address autocomplete
- **GoHighLevel:** Contact form submissions sent to GHL via REST API
- **AWS SES:** Transactional emails via nodemailer
- **NextAuth:** Auth for business owners (email + Google OAuth option)
