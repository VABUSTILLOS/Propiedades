import re

from vivanuncios_com_mx.items import NavigationItem
from web_poet import BrowserPage, Returns, field, handle_urls


@handle_urls("vivanuncios.com.mx")
class NavigationPage(BrowserPage, Returns[NavigationItem]):
    @field
    def items(self) -> list[dict] | None:
        items = []
        for card in self.css('[data-qa^="posting "]'):
            url = card.attrib.get("data-to-posting")
            if not url:
                continue
            full_url = self.response.urljoin(url)
            items.append({"url": str(full_url), "text": None})
        return items or None

    @field
    def next_page(self) -> str | None:
        if not self.css('[data-qa="PAGING_NEXT"]').get():
            return None
        url = str(self.response.url)
        match = re.search(r"p(\d+)(?=[?/]|$)", url)
        if not match:
            return None
        page = int(match.group(1)) + 1
        return re.sub(r"p\d+(?=[?/]|$)", f"p{page}", url, count=1)

    @field
    def subcategories(self) -> list[dict] | None:
        return None
