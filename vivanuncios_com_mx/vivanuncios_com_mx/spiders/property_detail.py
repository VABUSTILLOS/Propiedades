"""Crawl Vivanuncios property detail pages to extract contact data.

Seeded with the site's existing property URLs (matched via source_url).
Rendering is done locally with Playwright since the site blocks plain HTTP.
"""

import json

import scrapy
from scrapy_playwright.page import PageMethod

from vivanuncios_com_mx.pages.property import PropertyPage

PROPERTY_URLS_PATH = "vivanuncios_com_mx/property_urls.json"

# Browser context kwargs for each fresh per-request context. Cloudflare
# rate-limits repeated renders within the SAME context (first render=200,
# subsequent=403). Creating one fresh context per request restores the
# "first render" behavior every time.
FRESH_CONTEXT_KWARGS = {
    "viewport": {"width": 1280, "height": 720},
    "user_agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "locale": "es-MX",
}


class PropertyDetailSpider(scrapy.Spider):
    name = "property_detail"

    custom_settings = {
        "ADDONS": {
            "scrapy_poet.Addon": 300,
        },
        "DOWNLOAD_HANDLERS": {
            "http": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
            "https": "scrapy_playwright.handler.ScrapyPlaywrightDownloadHandler",
        },
        "PLAYWRIGHT_BROWSER_TYPE": "chromium",
        "PLAYWRIGHT_LAUNCH_OPTIONS": {"headless": True},
        "PLAYWRIGHT_DEFAULT_NAVIGATION_TIMEOUT": 30_000,
        "PLAYWRIGHT_DEFAULT_WAIT_TIMEOUT": 15_000,
        "PLAYWRIGHT_PROCESS_REQUEST_HEADERS": None,
        "SCRAPY_POET_PROVIDERS": {
            "vivanuncios_com_mx.providers.PlaywrightBrowserResponseProvider": 100,
        },
        "ZYTE_API_TRANSPARENT_MODE": False,
        "USER_AGENT": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        "ROBOTSTXT_OBEY": False,
        "HTTPERROR_ALLOW_ALL": True,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
        "DOWNLOAD_DELAY": 2,
        "DOWNLOAD_TIMEOUT": 60,
        "RETRY_TIMES": 3,
        "RETRY_HTTP_CODES": [403, 429, 500, 502, 503, 504],
        "RETRY_PRIORITY_ADJUST": -1,
        "FEED_EXPORT_ENCODING": "utf-8",
    }

    def __init__(self, urls_file=PROPERTY_URLS_PATH, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.urls_file = urls_file

    async def start(self):
        """Yield initial requests.

        Scrapy 2.13+ entry point (replaces start_requests).
        """
        self.logger.info("start called, urls_file=%s", self.urls_file)
        with open(self.urls_file) as f:
            records = json.load(f)
        self.logger.info("loaded %d records", len(records))
        for i, record in enumerate(records):
            url = record.get("source_url") or record.get("url")
            if not url:
                continue
            yield scrapy.Request(
                url,
                meta={
                    "playwright": True,
                    # Unique context per request: this is the ONLY place
                    # per-request context kwargs are honored (startup
                    # PLAYWRIGHT_CONTEXTS would hold the max-contexts semaphore
                    # forever and deadlock custom-named contexts).
                    "playwright_context": f"c{i}",
                    "playwright_context_kwargs": FRESH_CONTEXT_KWARGS,
                    "playwright_include_page": True,
                    "playwright_page_goto_kwargs": {
                        "wait_until": "domcontentloaded",
                    },
                    # Wait for the real page content instead of networkidle:
                    # the Cloudflare Turnstile challenge keeps the network
                    # busy, so networkidle never resolves, while waiting for a
                    # real-content marker lets the challenge auto-resolve (a
                    # few seconds). `postingId` appears on every real listing
                    # page (even ones without a telephone in JSON-LD, e.g.
                    # bodega/terreno ads); the telephone check is a fallback
                    # for pages that vary their markup.
                    "playwright_page_methods": [
                        PageMethod(
                            "wait_for_function",
                            "() => (document.body.innerHTML || '').includes('postingId') || [...document.querySelectorAll('script[type=\"application/ld+json\"]')].some(s => (s.textContent || '').includes('telephone'))",
                            timeout=45_000,
                        ),
                        # Click the "Ver datos de contacto" button if present.
                        # Some publishers hide the full phone behind it and only
                        # hydrate `whatsApp` into the `publisher` JS object after
                        # the click (JSON-LD `telephone` stays absent).
                        PageMethod(
                            "evaluate",
                            "() => { const b = document.querySelector('#getPublisherData'); if (b) { b.click(); return true; } return false; }",
                        ),
                        PageMethod("wait_for_timeout", 3_500),
                    ],
                },
                dont_filter=True,
            )

    async def parse(self, response, page: PropertyPage):
        yield await page.to_item()
        await self._close_context(response)

    async def errback(self, failure):
        self.logger.warning("request failed: %s", failure.request.url)
        await self._close_context(failure.request)

    async def _close_context(self, request_or_response):
        """Close the Playwright context tied to a request/response.

        Without this, fresh per-request contexts accumulate (and, if a max is
        ever set, hold the semaphore). Closing restores the next request's
        "first render" behavior.
        """
        page = request_or_response.meta.get("playwright_page")
        if page is None or page.is_closed():
            return
        try:
            await page.context.close()
        except Exception:  # noqa: BLE001 - best effort cleanup
            pass
