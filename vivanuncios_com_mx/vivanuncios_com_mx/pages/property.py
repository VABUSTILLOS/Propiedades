import re
from functools import cached_property

import extruct

from vivanuncios_com_mx.items import PropertyItem
from web_poet import BrowserPage, Returns, field, handle_urls


@handle_urls("vivanuncios.com.mx")
class PropertyPage(BrowserPage, Returns[PropertyItem]):
    @cached_property
    def _metadata(self) -> dict:
        return extruct.extract(
            self.selector.root,
            base_url=str(self.response.url),
            syntaxes=["json-ld"],
        )

    @cached_property
    def _jsonld(self) -> dict:
        for entry in self._metadata.get("json-ld", []):
            if entry.get("@type") == "House":
                return entry
        return {}

    @field
    def title(self) -> str | None:
        return self._jsonld.get("name") or self.css("title::text").get()

    @field
    def url(self) -> str | None:
        match = re.search(
            r'<link[^>]+rel="canonical"[^>]+href="([^"]+)"', self.response.text
        )
        if match:
            return match.group(1)
        return str(self.response.url)

    @field
    def listing_id_vivanuncios(self) -> str | None:
        script_text = " ".join(self.css("script::text").getall())
        match = re.search(r'postingId\s*=\s*"(\d+)"', script_text)
        if match:
            return match.group(1)
        page_url = str(self.response.url)
        match = re.search(r"(\d+)/?$", page_url)
        if match:
            return match.group(1)
        return None

    @field
    def contact_phone(self) -> str | None:
        return self._jsonld.get("telephone")

    @field
    def agency_name(self) -> str | None:
        name = self.css(
            'a[class*="publisherCard-module__info-name"]::text'
        ).get()
        if name:
            return name.strip()
        script_text = " ".join(self.css("script::text").getall())
        match = re.search(r'"name"\s*:\s*"([^"]+)"', script_text)
        if match:
            return match.group(1)
        return None

    @field
    def contact_methods_available(self) -> list[str] | None:
        methods = []
        if self.css("#contactFormSubmit").get():
            methods.append("email_form")
        if self.css("#contactFormWhatsapp").get():
            methods.append("whatsapp_button")
        if self.css("#getPublisherData").get():
            methods.append("phone_button")
        return methods or None

    @field
    def price(self) -> str | None:
        script_text = " ".join(self.css("script::text").getall())
        match = re.search(r"'precioVenta'\s*:\s*\"([^\"]+)\"", script_text)
        if not match:
            return None
        currency, _, amount = match.group(1).partition(" ")
        if not amount:
            return match.group(1)
        formatted_amount = re.sub(r"(?<=\d)(?=(\d{3})+(?!\d))", ",", amount)
        return f"{currency} {formatted_amount}"

    @field
    def location(self) -> str | None:
        address = self._jsonld.get("address")
        if not isinstance(address, dict):
            return None
        street_address = address.get("streetAddress")
        address_region = address.get("addressRegion")
        address_locality = address.get("addressLocality")
        if not (street_address and address_region and address_locality):
            return None
        locality = address_locality.split(",")[0]
        return f"{street_address}, {address_region}, {locality}"

    @field
    def number_of_bedrooms(self) -> int | None:
        value = self._jsonld.get("numberOfBedrooms")
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @field
    def floor_size_m2(self) -> int | None:
        floor_size = self._jsonld.get("floorSize")
        if not isinstance(floor_size, dict):
            return None
        value = floor_size.get("value")
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @field
    def days_published(self) -> str | None:
        text = self.css(
            'p[class*="userViews-module__post-antiquity-views"]::text'
        ).get()
        return text.strip() if text else None

    @field
    def property_image(self) -> str | None:
        return self.css('meta[property="og:image"]::attr(content)').get()
