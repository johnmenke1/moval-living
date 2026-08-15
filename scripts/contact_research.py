"""
contact_research.py — research-only contact-info scraper.

WHAT THIS IS
    A research tool. Runs against a list of business websites, extracts
    visible email addresses and social-media profile links, and writes
    the results to a JSON file. NO database writes. NO email sending.
    NO GHL contact creation. The output is for Johnny to read and
    manually decide who to contact.

WHAT THIS IS NOT
    NOT an outreach engine. NOT part of any automated sequence. NOT
    wired to SES, GHL, Stripe, or any other side-effect system. The
    scraper fetches, parses, and writes to disk. That's it.

USAGE
    # 1. Make a CSV with one column called "website" (with or without scheme):
    #      website
    #      https://acmeplumbing.com
    #      www.downtowndental.com
    #      bestofmoval.example.org
    #
    # 2. Run the scraper:
    #      python scripts/contact_research.py --input websites.csv --out out/contact-research.json
    #
    # 3. Read the JSON. Manually email the businesses you have a real
    #    reason to contact. Do NOT pipe this into any bulk-send system.

ETHICS + LEGAL
    Scraping a website's publicly visible email is legal in the US
    (hiQ v. LinkedIn, 2022) and the data is publicly published by the
    business itself. USING the scraped addresses to send unsolicited
    bulk marketing email is a CASL / CAN-SPAM violation regardless of
    how the addresses were obtained. This script gives you the data;
    what you do with it is your call. The default output is a JSON
    file. There is no `send` step.

    Per CASL / CAN-SPAM, even a single "commercial electronic message"
    to a recipient without consent can trigger liability. The only
    legal cold outreach requires either (a) explicit consent, (b) an
    existing business relationship, or (c) the recipient having
    conspicuously published their address for the purpose of receiving
    unsolicited commercial messages of that type. Most scraped info@
    addresses do not satisfy (c). The default position is: do not
    cold-email scraped addresses.

DEPENDENCIES
    pip install httpx beautifulsoup4 lxml

LICENSE
    This is Johnny's tool. Use it, fork it, throw it away.
"""

import argparse
import asyncio
import csv
import json
import re
import sys
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

# ─────────────────────────────────────────────────────────────────────────
# Regex + patterns
# ─────────────────────────────────────────────────────────────────────────

EMAIL_REGEX = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"

SOCIAL_PATTERNS = {
    "facebook":  r"(?:https?://)?(?:www\.)?(?:facebook\.com|fb\.com)/[a-zA-Z0-9._-]+/?",
    "instagram": r"(?:https?://)?(?:www\.)?instagram\.com/[a-zA-Z0-9._-]+/?",
    "linkedin":  r"(?:https?://)?(?:www\.)?linkedin\.com/(?:company|in)/[a-zA-Z0-9._-]+/?",
    "twitter":   r"(?:https?://)?(?:www\.)?(?:twitter\.com|x\.com)/[a-zA-Z0-9._-]+/?",
    "youtube":   r"(?:https?://)?(?:www\.)?youtube\.com/(?:@|c/|user/)?[a-zA-Z0-9._-]+/?",
}

IGNORED_EXTENSIONS = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".pdf", ".css", ".js")

# Free-mail and role-based inboxes that are almost never the decision-maker.
# Listed in the output as a `low_value` flag — useful to filter out if you're
# going to manually email anyone. Do NOT auto-suppress: some businesses really
# do list their gmail as the primary contact.
LOW_VALUE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
    "icloud.com", "me.com", "live.com", "msn.com", "protonmail.com",
    "mail.com", "gmx.com", "yandex.com", "zoho.com",
}

ROLE_PREFIXES = {
    "info", "contact", "hello", "admin", "office", "sales", "support",
    "noreply", "no-reply", "webmaster", "postmaster", "enquiries",
    "inquiries", "reception", "frontdesk",
}

CONTACT_KEYWORDS = ["contact", "about", "get-in-touch", "team", "staff"]


# ─────────────────────────────────────────────────────────────────────────
# Result data class
# ─────────────────────────────────────────────────────────────────────────

@dataclass
class ScrapeResult:
    url: str
    final_url: Optional[str] = None
    http_status: Optional[int] = None
    emails: list[str] = field(default_factory=list)
    socials: dict[str, list[str]] = field(default_factory=dict)
    contact_links_checked: list[str] = field(default_factory=list)
    status: str = "pending"            # "success" | "no_contact_info" | "error: <msg>"
    error: Optional[str] = None
    duration_ms: int = 0


# ─────────────────────────────────────────────────────────────────────────
# Parsing
# ─────────────────────────────────────────────────────────────────────────

def deobfuscate_text(raw_text: str) -> str:
    """Replace [at]/(at)/{at} with @ and [dot]/(dot)/{dot} with ."""
    text = re.sub(r"[\(\[\{\s]*(?:at|AT)[\)\]\}\s]*", "@", raw_text)
    text = re.sub(r"[\(\[\{\s]*(?:dot|DOT)[\)\]\}\s]*", ".", text)
    return text


def _classify_email(email: str) -> dict:
    """Annotate an email with low_value/role flags. Pure function, no side effects."""
    local, _, domain = email.partition("@")
    local_lower = local.lower()
    domain_lower = domain.lower()
    return {
        "email": email,
        "domain": domain_lower,
        "local": local_lower,
        "low_value": domain_lower in LOW_VALUE_EMAIL_DOMAINS,
        "role": local_lower in ROLE_PREFIXES,
    }


def extract_emails_from_html(html_content: str) -> list[dict]:
    """Return annotated email records from mailto: links + deobfuscated body text."""
    soup = BeautifulSoup(html_content, "html.parser")
    raw_emails: set[str] = set()

    # 1. mailto: links — these are the highest signal (the business chose to publish)
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.lower().startswith("mailto:"):
            email = href.split(":", 1)[1].split("?")[0].strip()
            if email:
                raw_emails.add(email.lower())

    # 2. deobfuscate body text and regex
    text = deobfuscate_text(soup.get_text())
    for match in re.findall(EMAIL_REGEX, text):
        candidate = match.lower()
        if not candidate.endswith(IGNORED_EXTENSIONS):
            raw_emails.add(candidate)

    return [_classify_email(e) for e in sorted(raw_emails)]


def extract_social_links(html_content: str, base_url: str) -> dict[str, list[str]]:
    """Find profile links to known social platforms. Filter share/intent URLs."""
    soup = BeautifulSoup(html_content, "html.parser")
    found: dict[str, set[str]] = {p: set() for p in SOCIAL_PATTERNS}

    for a in soup.find_all("a", href=True):
        full = urljoin(base_url, a["href"]).rstrip("/")
        for platform, pattern in SOCIAL_PATTERNS.items():
            if re.match(pattern, full, re.IGNORECASE):
                if not any(banned in full for banned in ["/sharer", "/intent", "/share", "/post"]):
                    found[platform].add(full)

    return {k: sorted(v) for k, v in found.items() if v}


def get_contact_links(url: str, html_content: str, max_links: int = 3) -> list[str]:
    """Return up to N same-domain links whose href looks like a contact/about page."""
    soup = BeautifulSoup(html_content, "html.parser")
    links: set[str] = set()
    base_netloc = urlparse(url).netloc

    for a in soup.find_all("a", href=True):
        href_lower = a["href"].lower()
        if any(kw in href_lower for kw in CONTACT_KEYWORDS):
            full = urljoin(url, a["href"])
            if urlparse(full).netloc == base_netloc:
                links.add(full)
        if len(links) >= max_links:
            break

    return list(links)[:max_links]


# ─────────────────────────────────────────────────────────────────────────
# Network
# ─────────────────────────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


async def scrape_one(
    client: httpx.AsyncClient,
    raw_url: str,
    timeout_s: float = 10.0,
    check_contact_subpages: bool = True,
) -> ScrapeResult:
    """Scrape one website: homepage, then up to 3 contact/about subpages if no emails found."""
    url = raw_url if raw_url.startswith(("http://", "https://")) else f"https://{raw_url}"
    result = ScrapeResult(url=url)
    start = time.monotonic()

    try:
        # Homepage
        res = await client.get(url, headers=HEADERS, follow_redirects=True, timeout=timeout_s)
        result.final_url = str(res.url)
        result.http_status = res.status_code

        if res.status_code >= 400:
            result.status = f"error: HTTP {res.status_code}"
            result.duration_ms = int((time.monotonic() - start) * 1000)
            return result

        emails = extract_emails_from_html(res.text)
        socials = extract_social_links(res.text, url)

        # Contact subpages — only if homepage had no emails. Budget: up to 3.
        if not emails and check_contact_subpages:
            contact_links = get_contact_links(url, res.text, max_links=3)
            for link in contact_links:
                result.contact_links_checked.append(link)
                try:
                    sub = await client.get(
                        link, headers=HEADERS, follow_redirects=True, timeout=timeout_s
                    )
                    if sub.status_code < 400:
                        for e in extract_emails_from_html(sub.text):
                            if e not in emails:
                                emails.append(e)
                        for platform, urls in extract_social_links(sub.text, url).items():
                            merged = set(socials.get(platform, [])) | set(urls)
                            socials[platform] = sorted(merged)
                        if emails:
                            break
                except httpx.HTTPError:
                    continue

        result.emails = emails
        result.socials = socials
        if emails or socials:
            result.status = "success"
        else:
            result.status = "no_contact_info"

    except httpx.TimeoutException:
        result.status = "error: timeout"
        result.error = f"Request exceeded {timeout_s}s"
    except httpx.ConnectError as e:
        result.status = "error: connection"
        result.error = str(e)[:200]
    except httpx.HTTPError as e:
        result.status = "error: http"
        result.error = str(e)[:200]
    except Exception as e:
        result.status = "error: unexpected"
        result.error = repr(e)[:200]

    result.duration_ms = int((time.monotonic() - start) * 1000)
    return result


# ─────────────────────────────────────────────────────────────────────────
# Input parsing
# ─────────────────────────────────────────────────────────────────────────

def load_urls_from_csv(path: Path) -> list[str]:
    """Read a CSV with a 'website' column. Return the list of URLs (deduped, order preserved)."""
    seen: set[str] = set()
    out: list[str] = []
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or "website" not in reader.fieldnames:
            print(f"[error] CSV must have a 'website' column. Found: {reader.fieldnames}", file=sys.stderr)
            sys.exit(2)
        for row in reader:
            w = (row.get("website") or "").strip()
            if w and w not in seen:
                seen.add(w)
                out.append(w)
    return out


def load_urls_from_json(path: Path) -> list[str]:
    """Read a JSON list of URLs (or a list of objects with a 'website' key)."""
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        urls = []
        for item in data:
            if isinstance(item, str):
                urls.append(item)
            elif isinstance(item, dict) and "website" in item:
                urls.append(item["website"])
        return urls
    if isinstance(data, dict) and "urls" in data:
        return list(data["urls"])
    print("[error] JSON must be a list of URLs or {'urls': [...]}", file=sys.stderr)
    sys.exit(2)


# ─────────────────────────────────────────────────────────────────────────
# Summary stats
# ─────────────────────────────────────────────────────────────────────────

def summarize(results: list[ScrapeResult]) -> dict:
    """Build a small stats block to make the JSON output easy to read at a glance."""
    by_status: dict[str, int] = {}
    total_emails = 0
    total_low_value = 0
    total_role = 0
    domains: dict[str, int] = {}
    socials_seen: dict[str, int] = {}

    for r in results:
        by_status[r.status] = by_status.get(r.status, 0) + 1
        for e in r.emails:
            total_emails += 1
            if e["low_value"]:
                total_low_value += 1
            if e["role"]:
                total_role += 1
            domains[e["domain"]] = domains.get(e["domain"], 0) + 1
        for platform, urls in r.socials.items():
            socials_seen[platform] = socials_seen.get(platform, 0) + len(urls)

    return {
        "total_websites": len(results),
        "by_status": by_status,
        "total_emails": total_emails,
        "low_value_emails": total_low_value,
        "role_emails": total_role,
        "unique_email_domains": len(domains),
        "social_profiles_found": socials_seen,
    }


# ─────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────

async def run(
    urls: list[str],
    concurrency: int,
    timeout_s: float,
    skip_contact_subpages: bool,
) -> list[ScrapeResult]:
    limits = httpx.Limits(max_connections=concurrency, max_keepalive_connections=concurrency)
    async with httpx.AsyncClient(limits=limits, timeout=timeout_s) as client:
        sem = asyncio.Semaphore(concurrency)

        async def bound(u: str) -> ScrapeResult:
            async with sem:
                return await scrape_one(client, u, timeout_s=timeout_s,
                                        check_contact_subpages=not skip_contact_subpages)

        tasks = [bound(u) for u in urls]
        return await asyncio.gather(*tasks)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Research-only contact-info scraper. Output is JSON, not DB writes.",
    )
    parser.add_argument("--input", "-i", required=True, help="Path to .csv (with 'website' column) or .json (list of URLs).")
    parser.add_argument("--out", "-o", default="out/contact-research.json", help="Output JSON path.")
    parser.add_argument("--max-websites", type=int, default=0, help="Cap on input size (0 = no cap). Safety valve.")
    parser.add_argument("--concurrency", "-c", type=int, default=10, help="Max parallel requests (default 10).")
    parser.add_argument("--timeout", type=int, default=10, help="Per-request timeout in seconds.")
    parser.add_argument("--skip-contact-subpages", action="store_true", help="Only scrape homepage.")
    parser.add_argument("--dry-run", action="store_true", help="Print summary to stdout, do not write file.")
    args = parser.parse_args()

    in_path = Path(args.input)
    if not in_path.exists():
        print(f"[error] input not found: {in_path}", file=sys.stderr)
        sys.exit(2)

    if in_path.suffix.lower() == ".csv":
        urls = load_urls_from_csv(in_path)
    elif in_path.suffix.lower() == ".json":
        urls = load_urls_from_json(in_path)
    else:
        print(f"[error] input must be .csv or .json (got {in_path.suffix})", file=sys.stderr)
        sys.exit(2)

    if args.max_websites and len(urls) > args.max_websites:
        print(f"[cap] limiting to first {args.max_websites} of {len(urls)} urls", file=sys.stderr)
        urls = urls[:args.max_websites]

    print(f"[start] scraping {len(urls)} websites (concurrency={args.concurrency}, timeout={args.timeout}s)", file=sys.stderr)
    started = time.monotonic()
    results = asyncio.run(run(urls, args.concurrency, args.timeout, args.skip_contact_subpages))
    elapsed = time.monotonic() - started

    summary = summarize(results)
    payload = {
        "summary": summary,
        "elapsed_seconds": round(elapsed, 2),
        "results": [asdict(r) for r in results],
    }

    if args.dry_run:
        print(json.dumps(summary, indent=2))
        return

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"[done] {len(results)} sites in {elapsed:.1f}s → {out_path}", file=sys.stderr)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
