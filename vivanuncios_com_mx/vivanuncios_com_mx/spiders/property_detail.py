"""Crawl Vivanuncios property detail pages to extract contact data.

Seeded with the site's existing property URLs (matched via source_url).
Rendering is done locally with Playwright since the site blocks plain HTTP.
"""

import json

import scrapy
from scrapy_playwright.page import PageMethod

from vivanuncios_com_mx.pages.property import PropertyPage

PROPERTY_URLS_PATH = "vivanuncios_com_mx/property_urls.json"


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
        "SCRAPY_POET_PROVIDERS": {
            "vivanuncios_com_mx.providers.PlaywrightBrowserResponseProvider": 100,
        },
        "ZYTE_API_TRANSPARENT_MODE": False,
        "ROBOTSTXT_OBEY": False,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 1,
        "DOWNLOAD_DELAY": 2,
        "DOWNLOAD_TIMEOUT": 60,
        "FEED_EXPORT_ENCODING": "utf-8",
    }

    def __init__(self, urls_file=PROPERTY_URLS_PATH, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.urls_file = urls_file

    def start_requests(self):
        with open(self.urls_file) as f:
            records = json.load(f)
        for record in records:
            url = record.get("source_url") or record.get("url")
            if not url:
                continue
            yield scrapy.Request(
                url,
                meta={
                    "playwright": True,
                    "playwright_page_methods": [
                        PageMethod("wait_for_load_state", "networkidle"),
                    ],
                },
                dont_filter=True,
            )

    async def parse(self, response, page: PropertyPage):
        yield await page.to_item()
