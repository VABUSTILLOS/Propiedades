import scrapy

class MiniSpider(scrapy.Spider):
    name = "mini"
    start_urls = ["https://www.vivanuncios.com.mx/"]
    def parse(self, response):
        print("GOT", response.status, len(response.text))
