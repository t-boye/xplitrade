import json
import os
from pathlib import Path

import ccxt


key = os.environ.get("XPLITRADE__EXCHANGE__KEY")
secret = os.environ.get("XPLITRADE__EXCHANGE__SECRET")

proxy = os.environ.get("CI_WEB_PROXY")

exchange = ccxt.binance(
    {
        "apiKey": key,
        "secret": secret,
        "httpsProxy": proxy,
        "options": {"defaultType": "swap"},
    }
)
_ = exchange.load_markets()

lev_tiers = exchange.fetch_leverage_tiers()

# Assumes this is running in the root of the repository.
file = Path("xplitrade/exchange/binance_leverage_tiers.json")
json.dump(dict(sorted(lev_tiers.items())), file.open("w"), indent=2)
