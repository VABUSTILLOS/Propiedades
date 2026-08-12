import scrapy
from scrapy_poet import DummyResponse

from vivanuncios_com_mx.pages.navigation import NavigationPage
from vivanuncios_com_mx.pages.property import PropertyPage


class VivanunciosSpider(scrapy.Spider):
    name = "vivanuncios"
    start_urls = [
        "https://www.vivanuncios.com.mx/s-venta-inmuebles/chihuahua/v1c1097l1005p1?sort=most_lowered_price"
    ]

    async def parse(self, response: DummyResponse, nav: NavigationPage):
        nav_item = await nav.to_item()

        for link in nav_item.items or []:
            yield scrapy.Request(link["url"], callback=self.parse_item)

        if nav_item.next_page:
            yield scrapy.Request(nav_item.next_page, callback=self.parse)

    async def parse_item(self, response: DummyResponse, page: PropertyPage):
        yield await page.to_item()
