import re

import scrapy
from scrapy_poet import DummyResponse

from vivanuncios_com_mx.pages.navigation import NavigationPage
from vivanuncios_com_mx.pages.property import PropertyPage


class VivanunciosSpider(scrapy.Spider):
    name = "vivanuncios"

    # Usage: scrapy crawl vivanuncios -a city=chihuahua -a deal=sale [-a pages=3]
    #   city:  URL slug of the locality (default chihuahua)
    #   deal:  sale (venta) | rent (renta)  (default sale)
    #   pages: max result pages to crawl (default 1)
    # Example: scrapy crawl vivanuncios -a city=monterrey -a deal=rent -a pages=5
    def __init__(self, city="chihuahua", deal="sale", pages="1", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.city = (city or "chihuahua").strip().lower().replace(" ", "-")
        self.deal = (deal or "sale").strip().lower()
        if self.deal not in ("sale", "rent"):
            raise ValueError(f"deal debe ser 'sale' o 'rent', se recibió: {deal}")
        self.max_pages = max(1, int(pages or "1"))
        prefix = "venta" if self.deal == "sale" else "renta"
        self.start_urls = [
            f"https://www.vivanuncios.com.mx/s-{prefix}-inmuebles/{self.city}/v1c1097l1005p1?sort=most_lowered_price"
        ]

    def _page_num(self, url: str) -> int:
        match = re.search(r"p(\d+)(?=[?/]|$)", url or "")
        return int(match.group(1)) if match else 1

    async def parse(self, response: DummyResponse, nav: NavigationPage):
        nav_item = await nav.to_item()

        for link in nav_item.items or []:
            yield scrapy.Request(link["url"], callback=self.parse_item)

        if nav_item.next_page and self._page_num(response.url) < self.max_pages:
            yield scrapy.Request(nav_item.next_page, callback=self.parse)

    async def parse_item(self, response: DummyResponse, page: PropertyPage):
        yield await page.to_item()
