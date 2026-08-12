from dataclasses import dataclass, field


@dataclass
class NavigationItem:
    items: list[dict] | None = None
    next_page: str | None = None
    subcategories: list[dict] | None = None


@dataclass
class PropertyItem:
    title: str | None = None
    url: str | None = None
    listing_id_vivanuncios: str | None = None
    contact_phone: str | None = None
    agency_name: str | None = None
    contact_methods_available: list[str] | None = None
    price: str | None = None
    location: str | None = None
    number_of_bedrooms: int | None = None
    floor_size_m2: int | None = None
    days_published: str | None = None
    property_image: str | None = None
    images: list[str] | None = None
