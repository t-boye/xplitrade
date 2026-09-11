# Xplitrade — Professional Crypto Trading Bot

> *"Exploit market inefficiencies with discipline, data, and zero emotional bias."*

Xplitrade is a professional-grade, self-hosted algorithmic crypto trading engine written in Python.
It supports all major exchanges, is controlled via Telegram or WebUI, and includes backtesting,
strategy optimization by machine learning, and risk-first money management tools.

---

## Philosophy

Xplitrade is built on one principle: **capital preservation before profit**.

- Every trade has a stoploss. No exceptions.
- Position sizing determines survival — size down to stay in the game.
- 1% daily compounding → 3,778% annually. Consistency beats explosiveness.
- Backtest everything. Never live-trade what you haven't validated.

See `RENAME_PLAN.md` for the full trading philosophy and risk framework.

---

## Supported Exchanges

### Spot
Binance · BingX · Bitget · Bitvavo · Bybit · Gate · HTX · Hyperliquid · Kraken · Kucoin · OKX · MyOKX

### Futures
Binance · Bitget · Bybit · Gate · Hyperliquid · Kraken · OKX

---

## Quick Start

### Docker (recommended)
```bash
docker compose up -d
```

### Native Install
```bash
python -m pip install -e .
xplitrade --help
```

---

## CLI Commands

```
xplitrade trade              Start live/dry-run trading
xplitrade backtesting        Run backtesting simulation
xplitrade download-data      Download OHLCV data from exchange
xplitrade hyperopt           Optimize strategy parameters
xplitrade new-strategy       Scaffold a new strategy file
xplitrade new-config         Scaffold a new config file
xplitrade webserver          Launch the web UI only
xplitrade plot-dataframe     Chart candles + indicators
xplitrade plot-profit        Chart cumulative profit
xplitrade list-exchanges     Show all supported exchanges
xplitrade -V                 Show version
```

---

## Features

- **30+ Exchange connectors** via CCXT — spot and futures
- **Dry-run mode** — paper trade with zero risk before going live
- **Backtesting engine** — test strategies against historical data
- **Hyperopt** — machine learning parameter optimization
- **FreqAI** — adaptive ML prediction models (self-training)
- **Trailing stoploss** — dynamic risk management built in
- **Telegram & Discord** — full bot control from your phone
- **Web UI** — real-time trade dashboard in browser
- **SQLite persistence** — full trade history, importable/exportable
- **Strategy templates** — get started in minutes

---

## Recommended Config (Risk-First)

```json
{
  "max_open_trades": 10,
  "stake_currency": "USDT",
  "stake_amount": "unlimited",
  "tradable_balance_ratio": 0.99,
  "dry_run": true,
  "dry_run_wallet": 1000,
  "stoploss": -0.05,
  "trailing_stop": true,
  "trailing_stop_positive": 0.02,
  "trailing_stop_positive_offset": 0.05,
  "trailing_only_offset_is_reached": true,
  "minimal_roi": {
    "60": 0.03,
    "30": 0.05,
    "0": 0.10
  }
}
```

---

## Telegram Commands

```
/start          Start the trader
/stop           Stop the trader
/status         List open trades
/profit         Show cumulative profit
/balance        Show account balance
/forceexit      Force-close a trade
/performance    Performance by pair
/daily          P&L per day
/help           Show all commands
/version        Show bot version
```

---

## Development Branches

| Branch | Purpose |
|---|---|
| `stable` | Latest stable release — use this in production |
| `develop` | Latest features — may contain breaking changes |
| `feat/*` | Feature branches — not for production use |

---

## Requirements

| Requirement | Minimum |
|---|---|
| Python | >= 3.11 |
| RAM | 2 GB |
| Disk | 1 GB |
| CPU | 2 vCPU |

Dependencies: `pip`, `git`, `TA-Lib` · Optional: Docker, virtualenv

---

## Disclaimer

This software is for educational and research purposes only. Do not risk money you are afraid to lose.
**USE THE SOFTWARE AT YOUR OWN RISK.** Always start in dry-run mode. The authors assume no
responsibility for your trading results.
