"""Idex exchange subclass"""

import logging

from xplitrade.exchange import Exchange
from xplitrade.exchange.exchange_types import FtHas


logger = logging.getLogger(__name__)


class Idex(Exchange):
    """
    Idex exchange class. Contains adjustments needed for Xplitrade to work
    with this exchange.
    """

    _ft_has: FtHas = {
        "ohlcv_candle_limit": 1000,
    }
