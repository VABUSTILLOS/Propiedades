"""Crawl Vivanuncios property detail pages to extract contact data.

Seeded with the site's existing property URLs (matched via source_url).
Rendering is done locally with Playwright since the site blocks plain HTTP.
"""

import json

import scrapy
from scrapy_playwright.page import PageMethod

from vivanuncios_com_mx.pages.property import PropertyPage

PROPERTY_URLS_PATH = "vivanuncios_com_mx/property_urls.json"

print("### module imported", flush=True)


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
        "PLAYWRIGHT_CONTEXTS": {
            "default": {
                "viewport": {"width": 1280, "height": 720},
                "user_agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/125.0.0.0 Safari/537.36"
                ),
                "locale": "es-MX",
            },
        },
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
        print(f"### spider __init__ called, urls_file={urls_file}", flush=True)
        super().__init__(*args, **kwargs)
        self.urls_file = urls_file

    async def start(self):
        """Yield initial requests.

        Scrapy 2.13+ entry point (replaces start_requests).
        """
        print(f"### start called, urls_file={self.urls_file}", flush=True)
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
                    # Unique context per request (with PLAYWRIGHT_MAX_CONTEXTS=1
                    # this closes the previous context, giving each URL a
                    # fresh fingerprint that dodges progressive rate-limiting).
                    "playwright_context": f"c{i}",
                    "playwright_page_goto_kwargs": {
                        "wait_until": "domcontentloaded",
                    },
                    "playwright_page_methods": [
                        PageMethod(
                            "wait_for_function",
                            (
                                "() => "
                                "[...document.querySelectorAll('script[type=\"application/ld+json\"]')]"
                                ".some(s => (s.textContent || '').includes('telephone'))"
                            ),
                            timeout=30_000,
                        ),
                    ],
                },
                dont_filter=True,
            )

    async def parse(self, response, page: PropertyPage):
        yield await page.to_item()
