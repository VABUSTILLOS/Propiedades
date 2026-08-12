from vivanuncios_com_mx.items import PropertyItem
from web_poet import BrowserPage, Returns, handle_urls


@handle_urls("vivanuncios.com.mx")
class PropertyPage(BrowserPage, Returns[PropertyItem]):
    pass
