import logging

from xplitrade.exchange import Exchange
from xplitrade.exchange.exchange_types import FtHas


logger = logging.getLogger(__name__)


class Coinex(Exchange):
    """
    CoinEx exchange class. Contains adjustments needed for Xplitrade to work
    with this exchange.

    Please note that this exchange is not included in the list of exchanges
    officially supported by the Xplitrade development team. So some features
    may still not work as expected.
    """

    _ft_has: FtHas = {
        "l2_limit_range": [5, 10, 20, 50],
        "tickers_have_bid_ask": False,
        "tickers_have_quoteVolume": False,
    }
