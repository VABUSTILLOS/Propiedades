"""Custom scrapy-poet page object input providers."""

from typing import Callable, Sequence, Set

from scrapy.http import Response
from scrapy_poet.page_input_providers import PageObjectInputProvider
from web_poet import BrowserHtml, BrowserResponse, ResponseUrl


class PlaywrightBrowserResponseProvider(PageObjectInputProvider):
    """Provides a web-poet BrowserResponse built from a Playwright-rendered
    Scrapy response (scrapy-playwright puts the rendered HTML in response.text).
    """

    name = "playwright_browser_response"
    provided_classes = {BrowserResponse}

    def __call__(
        self, to_provide: Set[Callable], response: Response
    ) -> Sequence[BrowserResponse]:
        if BrowserResponse not in to_provide:
            return []
        return [
            BrowserResponse(
                url=ResponseUrl(str(response.url)),
                html=BrowserHtml(response.text),
                status=response.status,
            )
        ]
