# XPLITRADE — Master Project Document

> *"Winners don't lose money. They manage risk so precisely that loss becomes a controlled variable, not a fate."*

---

## I. VISION & PHILOSOPHY

### What is Xplitrade?

**Xplitrade** is a professional-grade, self-hosted algorithmic crypto trading engine.
It is not a gambling tool. It is a **precision instrument** built on the principle that
consistent, compounding returns beat any high-risk, high-reward gamble — every time.

The name stands for **Exploit + Trade** — exploiting market inefficiencies with
discipline, data, and zero emotional bias.

---

### Trading Philosophy — The No-Loss Mindset

> *A perfectionist trader does not chase wins. They eliminate scenarios for loss.*

#### Core Principles

| Principle | Rule |
|---|---|
| **Capital Preservation First** | Never risk more than 1–2% of total portfolio per trade. The goal is to still be in the game tomorrow. |
| **Risk-Reward Discipline** | Only enter trades where Risk:Reward ≥ 1:3. If the setup doesn't offer at least 3× the reward vs. the risk, skip it. |
| **Stoploss is Sacred** | A stoploss is not optional. Every trade has one. No exceptions. Removing a stoploss is how accounts get blown. |
| **Position Sizing is Everything** | Bet size determines survival. A 10% loss requires an 11.1% gain to recover. A 50% loss requires 100%. Size down, always. |
| **Win Rate ≠ Profitability** | A 40% win rate with 1:3 R:R is more profitable than 70% win rate with 1:1. Focus on expectancy, not win%. |
| **No Revenge Trades** | After a losing trade: pause, review, recalibrate. Never immediately re-enter to "get it back". |
| **Data Over Emotion** | Every decision must be backed by backtest data, not gut feel. If you can't backtest it, don't live-trade it. |
| **Compounding is the Real Edge** | 1% daily compounds to 3,778% annually. Consistent small wins destroy sporadic big wins. |

---

### The Economist's Framework

As an algorithmic trader, you are running a **probabilistic business**, not playing a game.

#### Market Structure Understanding

```
Market Phases:
  TRENDING    → Trend-following strategies (EMA crossovers, momentum)
  RANGING     → Mean-reversion strategies (RSI, Bollinger Bands)
  VOLATILE    → Reduce position sizes; widen stops or stay flat
  ILLIQUID    → Avoid entirely; slippage will destroy edge
```

#### Expected Value (EV) Formula

```
EV = (Win Rate × Average Win) - (Loss Rate × Average Loss)

Example (target):
  Win Rate:      45%
  Average Win:   3% per trade
  Average Loss:  1% per trade

EV = (0.45 × 3%) - (0.55 × 1%) = 1.35% - 0.55% = +0.80% per trade

On 100 trades: +80% expected return — with only a 45% win rate.
```

#### The Three Pillars of Non-Loss Trading

1. **ENTRY PRECISION** — Only enter at high-probability setups (confluence of signals).
   Never chase entries. Wait for price to come to your level.

2. **EXIT DISCIPLINE** — Know your exit BEFORE you enter. Set both profit target and
   stoploss in the config. No manual overrides in live trading.

3. **RISK CONTROL** — Use `max_open_trades`, `stake_amount`, and `stoploss` to cap
   maximum drawdown at all times. The system enforces this — not willpower.

---

### Winner Mentality Operating Rules

```
RULE 1  →  No trade is better than a bad trade. Flat is a position.
RULE 2  →  The best traders lose the least, not win the most.
RULE 3  →  Never go full-port on a single pair. Diversify across 5–15 pairs minimum.
RULE 4  →  Dry-run EVERYTHING for ≥30 days before live. No exceptions.
RULE 5  →  Review every trade. Journal wins and losses with equal attention.
RULE 6  →  Correlating pairs amplify loss. BTC/ETH/BNB often move together — size accordingly.
RULE 7  →  Liquidity crisis = exit all. When market-wide panic hits, cash is king.
RULE 8  →  The algo is the edge. Trust the backtest. Don't override live trades.
RULE 9  →  Fees compound against you. Account for 0.1–0.2% round-trip in all backtests.
RULE 10 →  Consistency > explosiveness. 5% monthly, every month, beats 50% one month then -40%.
```

---

### Risk Management Parameters (Recommended Config)

```json
{
  "max_open_trades": 10,
  "stake_currency": "USDT",
  "stake_amount": "unlimited",
  "tradable_balance_ratio": 0.99,
  "fiat_display_currency": "USD",
  "dry_run": true,
  "dry_run_wallet": 1000,
  "cancel_open_orders_on_exit": true,

  "stoploss": -0.05,
  "trailing_stop": true,
  "trailing_stop_positive": 0.02,
  "trailing_stop_positive_offset": 0.05,
  "trailing_only_offset_is_reached": true,

  "minimal_roi": {
    "60": 0.03,
    "30": 0.05,
    "15": 0.08,
    "0":  0.12
  },

  "unfilledtimeout": {
    "entry": 10,
    "exit": 10,
    "exit_timeout_count": 0,
    "unit": "minutes"
  }
}
```

---

## II. ARCHITECTURE OVERVIEW

```
xplitrade/
├── xplitrade/               ← Core engine (Python package)
│   ├── commands/            ← CLI command handlers
│   ├── configuration/       ← Config loading & validation
│   ├── config_schema/       ← JSON schema validation
│   ├── data/                ← Market data download & conversion
│   ├── enums/               ← Shared enumerations
│   ├── exchange/            ← Exchange connectors (30+ exchanges via CCXT)
│   ├── freqai/              ← ML-powered signal generation (sub-brand kept)
│   ├── ft_types/            ← Type definitions
│   ├── leverage/            ← Futures/margin helpers
│   ├── loggers/             ← Logging setup
│   ├── mixins/              ← Shared behaviour mixins
│   ├── optimize/            ← Hyperopt & backtesting engine
│   ├── persistence/         ← SQLAlchemy trade database
│   ├── plugins/             ← Pairlist, protections plugins
│   ├── resolvers/           ← Dynamic module loading
│   ├── rpc/                 ← Telegram, Discord, API server (FastAPI)
│   ├── strategy/            ← Strategy base class & interface
│   ├── templates/           ← Strategy starter templates
│   └── util/                ← Utilities, date helpers, migrations
│
├── ft_client/               ← Standalone REST API client
│   └── xplitrade_client/    ← Python client library
│
├── config_examples/         ← Example configuration files
├── docker/                  ← Docker image variants
├── docs/                    ← Full documentation
└── tests/                   ← Test suite (pytest)
```

---

## III. RENAME EXECUTION PLAN
### From `xplitrade` → `xplitrade`

---

### Scope Summary

| Category | File Count | Status |
|---|---|---|
| Python source files (`.py`) | 405 | ⬜ Pending |
| Markdown docs (`.md`) | 91 | ⬜ Pending |
| YAML workflows/compose (`.yml`) | 13 | ⬜ Pending |
| JSON config examples (`.json`) | 11 | ⬜ Pending |
| TOML package configs (`.toml`) | 2 | ⬜ Pending |
| Docker files | 8 | ⬜ Pending |
| Shell / PowerShell scripts | 3 | ⬜ Pending |
| **Total** | **~533** | |

---

### Replacement Strings

| Old | New | Applies To |
|---|---|---|
| `xplitrade` | `xplitrade` | package name, imports, CLI |
| `Xplitrade` | `Xplitrade` | display name, class prefixes |
| `FREQTRADE` | `XPLITRADE` | env vars, uppercase constants |
| `xplitrade_client` | `xplitrade_client` | ft_client sub-package |
| `XplitradeException` | `XplitradeException` | exception class name |
| `xplitrade-client` | `xplitrade-client` | pip/CLI package name |
| `xplitradeorg` | `xplitradeorg` | Docker image org |
| `xplitrade_commit` | `xplitrade_commit` | CI version file |
| `xplitrade_basedir` | `xplitrade_basedir` | variable name in `__init__.py` |

### Things to KEEP unchanged

| Item | Reason |
|---|---|
| `freqai` / `FreqAI` | Separate ML sub-brand |
| `freqtrade.io` URLs | Upstream docs — not our domain |
| `github.com/freqtrade/...` URLs | Upstream repo links |
| `xplitrade@protonmail.com` | Upstream author email |
| `tradesv3.sqlite` | Database file name |
| `qtpylib` vendor | Third-party vendor |

---

### Phase 1 — Python Package Internals

- [ ] 1.1 Bulk-replace `from xplitrade.` → `from xplitrade.` in all `.py` files
- [ ] 1.2 Bulk-replace `import xplitrade.` → `import xplitrade.`
- [ ] 1.3 Bulk-replace `from xplitrade_client.` → `from xplitrade_client.`
- [ ] 1.4 Bulk-replace `XplitradeException` → `XplitradeException`
- [ ] 1.5 Bulk-replace `xplitrade_basedir` / `xplitrade_commit` variable names
- [ ] 1.6 Bulk-replace `getLogger("xplitrade")` → `getLogger("xplitrade")`
- [ ] 1.7 Bulk-replace `FREQTRADE__` → `XPLITRADE__` (env var prefixes)
- [ ] 1.8 Bulk-replace display strings `"Xplitrade"` → `"Xplitrade"` in `.py`
- [ ] 1.9 Update root `pyproject.toml`
- [ ] 1.10 Update `ft_client/pyproject.toml`

### Phase 2 — Directory Renames

- [ ] 2.1 Rename `xplitrade/` → `xplitrade/`
- [ ] 2.2 Rename `ft_client/xplitrade_client/` → `ft_client/xplitrade_client/`

### Phase 3 — Docker Files

- [ ] 3.1 Update `Dockerfile` (directory `/xplitrade` → `/xplitrade`)
- [ ] 3.2 Update `docker/Dockerfile.*` variants
- [ ] 3.3 Update `docker-compose.yml`
- [ ] 3.4 Update `docker/docker-compose-*.yml`

### Phase 4 — GitHub Workflows & CI

- [ ] 4.1 Update `.github/workflows/*.yml` display names and env vars

### Phase 5 — Config Examples & JSON Schema

- [ ] 5.1 Update `config_examples/*.json`
- [ ] 5.2 Update `build_helpers/schema.json`

### Phase 6 — Documentation

- [ ] 6.1 Bulk-replace `Xplitrade` → `Xplitrade` in `docs/*.md`
- [ ] 6.2 Update `README.md`
- [ ] 6.3 Update `CONTRIBUTING.md`

### Phase 7 — Remaining Files

- [ ] 7.1 `setup.ps1`, shell scripts
- [ ] 7.2 `.github/` templates and FUNDING
- [ ] 7.3 `build_helpers/*.py`
- [ ] 7.4 `.readthedocs.yml`, `.pylintrc`

### Phase 8 — Strategy Templates

- [ ] 8.1 Update docstrings and class references in `xplitrade/templates/`

### Phase 9 — Verification

- [ ] `grep -r "from xplitrade" .` → 0 results
- [ ] `grep -r "import xplitrade" .` → 0 results
- [ ] `grep -r "xplitrade_client" .` → 0 results
- [ ] `pyproject.toml` → `name = "xplitrade"`
- [ ] `python -c "import xplitrade; print(xplitrade.__version__)"` works
- [ ] `xplitrade --help` works after `pip install -e .`
- [ ] `XplitradeException` importable
- [ ] Env var prefix = `XPLITRADE__`

---

## IV. TESTING ROADMAP

### Phase A — Interface & Smoke Test (immediate)
1. Install with `pip install -e .` after rename
2. Run `xplitrade --help` — verify CLI works
3. Run `xplitrade trade --config config_examples/config_full.example.json --dry-run`
4. Access the Web UI at `http://localhost:8080`
5. Verify Telegram bot handshake (if configured)

### Phase B — Backtesting Validation
```bash
xplitrade download-data --exchange binance --pairs BTC/USDT ETH/USDT --timeframe 1h --days 365
xplitrade backtesting --strategy SampleStrategy --timerange 20240101-20250101
xplitrade backtesting-show
```

### Phase C — Paper Trading (30-day minimum)
- Run with `"dry_run": true` for at minimum 30 days
- Monitor via Web UI
- Target: positive expectancy on >100 trades before going live

### Phase D — Live Validation (small stake)
- Start with 5% of intended capital
- Monitor for 2 weeks
- Scale up only after consistent results

---

## V. UI REDESIGN ROADMAP (Phase 2 of Project)

The current UI (`freqUI`) is functional but generic. The Xplitrade UI redesign will:

### Design Goals
- **Professional trading terminal aesthetic** — dark theme, data-dense, Bloomberg-inspired
- **Real-time P&L dashboard** — live equity curve, drawdown meter, win/loss ratio
- **Trade management panel** — force-buy, force-sell, emergency stop — one click
- **Risk dashboard** — current exposure %, open trade heatmap, correlation view
- **Strategy performance cards** — per-strategy equity curves, Sharpe ratio, max DD

### Tech Stack (planned)
- Frontend: React + TypeScript (existing base)
- Charts: TradingView Lightweight Charts
- Design system: Custom dark theme over existing component base
- Real-time: WebSocket (existing API server)

---

*Document maintained alongside active development. Update phase checkboxes as work completes.*
