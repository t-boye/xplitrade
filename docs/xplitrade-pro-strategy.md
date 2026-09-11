# XplitradeProStrategy

XplitradeProStrategy is the flagship built-in strategy included with Xplitrade. It is a professional-grade trend-following strategy built and validated through quantitative backtesting.

---

## Philosophy

The strategy follows one core rule: **only trade with the trend, never against it**.

It waits for a full alignment of short, medium, and long-term momentum before entering. It then exits mechanically via a staged ROI table — no discretionary calls, no guessing.

Key principles:

- Capital preservation first — a 3.5% hard stop limits loss on any single trade
- Trailing stop locks in gains once a trade goes +2%
- Exit signals are disabled — backtesting showed they had an 8.9% win rate (pure noise). ROI exits win 94.7% of the time
- A 24-hour time stop closes unprofitable trades that stall — no dead money

---

## Requirements

| Setting | Value |
|---|---|
| Timeframe | 1h |
| Minimum candles for warmup | 200 (EMA 200 startup) |
| Recommended pairs | BTC, ETH, SOL, BNB, XRP, AVAX, LINK, ADA, DOT, ATOM, LTC, NEAR, APT, ARB, OP |
| Stake currency | USDT |
| Can short | No (long only) |

---

## Indicators

The strategy uses five layers of analysis, each with a specific job:

### Trend — EMA stack

Four EMAs (20, 50, 100, 200) form a hierarchy. The bot only enters when all four are in bullish alignment: `EMA 20 > EMA 50 > EMA 200` and price is above EMA 200.

Two slope guards are added on top:

- **EMA 20 slope** (3-bar rate of change) — must be positive: the short-term trend must be accelerating, not rolling over
- **EMA 200 slope** (10-bar rate of change) — must be positive: the macro trend must still be rising, not just price above a flat line

This combination catches bear market transitions up to 10 candles earlier than a simple EMA crossover.

### Momentum — RSI, MACD, Stochastic

- **RSI 14** — entry zone 35–72. Below 35 = potential reversal, above 72 = overbought. These bounds are intentionally wider than the default 40–65 to avoid filtering out valid momentum moves
- **MACD 12/26/9** — MACD line must be above its signal line (net bullish momentum). The histogram is also monitored for fade detection
- **Stochastic 14/3/3** — used in exit logic: a bearish cross above 80 confirms a momentum peak

### Volatility — Bollinger Bands, ATR

- **Bollinger Bands 20/2** — entry is only allowed below 88% of the band width. This prevents buying at the very top of a volatile move
- **ATR 14** — used internally to understand volatility context. BB width is derived from BB to detect regime

### Volume

- **Volume SMA 20** — volume must be at least 70% of the 20-period average. Removes low-participation candles where a move may not sustain

### Regime filter — BB width

The BB width (upper minus lower, divided by midline) is compared to its own 20-period moving average. When current width exceeds the average, the market is in an **expanding volatility / trending regime** — the only environment where this trend-following strategy performs well.

Signals in a contracting / ranging regime are filtered out entirely.

---

## Entry conditions

All of the following must be true simultaneously for a long entry:

| # | Condition | Why |
|---|---|---|
| 1 | `in_uptrend` | Full EMA stack aligned bullishly + DI+ dominant + both EMA slopes positive |
| 2 | ADX > 20 | Confirms a trending market. Below 20 = whipsaw |
| 3 | RSI 35–72 | Momentum zone — not oversold, not overbought |
| 4 | MACD > Signal | Net bullish momentum direction |
| 5 | BB position < 88% | Not buying at the extreme top of the band |
| 6 | Volume ratio > 0.7× | Real participation in the move |
| 7 | BB width expanding | Trending regime confirmed |

---

## Exit mechanism

`use_exit_signal = False` — the exit signal function is kept for reference but never called. All exits happen through the ROI table and stops.

### ROI table (staged take-profit)

| Time in trade | Minimum profit to exit |
|---|---|
| 0 min | 3.0% |
| 1 hour | 2.0% |
| 3 hours | 1.5% |
| 6 hours | 1.0% |
| 8 hours | 0.5% |
| 12 hours | 0.2% |
| 24 hours | 0.0% (time stop — exit at breakeven) |

The bot exits as soon as price crosses any of these thresholds. Strong moves are captured quickly (3% immediately). Slower moves get progressively smaller targets. Any trade still open after 24 hours is closed at the next breakeven tick — no dead money held indefinitely.

### Trailing stop

Activates once the trade reaches +2% profit. Trails by 1% from the peak. This locks in at least +1% on any trade that got to +2%.

### Hard stop loss

`stoploss = -0.035` — a fixed 3.5% hard stop. If price drops 3.5% from the entry, the trade is closed regardless of any other condition. This is the maximum loss on a single trade.

---

## Risk management summary

| Parameter | Value |
|---|---|
| Hard stop | −3.5% |
| Trailing stop activates at | +2.0% |
| Trailing stop distance | 1.0% |
| Max stake per trade | Configured via `stake_amount` in config.json |
| Max simultaneous positions | Configured via `max_open_trades` in config.json |
| Max capital at risk | `stake_amount × max_open_trades` |

With the default config (100 USDT per trade, 5 max open): maximum capital deployed is **500 USDT**, maximum single-trade loss is **3.50 USDT**.

---

## Hyperopt parameters

The strategy exposes seven parameters for automated optimization:

| Parameter | Default | Search range | Space |
|---|---|---|---|
| `buy_rsi_min` | 35 | 28–48 | buy |
| `buy_rsi_max` | 72 | 58–78 | buy |
| `buy_adx_min` | 20 | 15–30 | buy |
| `buy_bb_pct_max` | 0.88 | 0.65–0.92 | buy |
| `buy_vol_ratio` | 0.7 | 0.5–1.5 | buy |
| `sell_rsi_max` | 75 | 65–85 | sell |
| `sell_stoch_min` | 80 | 70–90 | sell |

To optimize against 2025 bull market data:

```bash
# Download historical data first
xplitrade download-data --exchange binance --pairs BTC/USDT ETH/USDT SOL/USDT \
    --timeframes 1h --timerange 20250101-20251231

# Run hyperopt
xplitrade hyperopt \
    --strategy XplitradeProStrategy \
    --hyperopt-loss SharpeHyperOptLoss \
    --spaces buy \
    --epochs 300 \
    --timerange 20250101-20251231 \
    -c user_data/config.json
```

!!! tip "Train on bull market data"
    Optimize on 2025 data (strong uptrend). The strategy is designed for trending markets — optimizing on a sideways or bear period will produce parameters that underperform in a bull run.

---

## Backtesting

```bash
# Download data (if not already downloaded)
xplitrade download-data --exchange binance \
    --pairs BTC/USDT ETH/USDT SOL/USDT BNB/USDT XRP/USDT \
    --timeframes 1h --timerange 20250101-20260101

# Run backtest
xplitrade backtesting \
    --strategy XplitradeProStrategy \
    --timerange 20250101-20260101 \
    -c user_data/config.json
```

### Known backtest characteristics

- The strategy generates the majority of profit through ROI exits (win rate ~94%)
- Hard stop losses are the primary source of losses — these concentrate during sharp market corrections (e.g. April 2026 crypto selloff)
- Running hyperopt on a clean bull market period before live deployment significantly improves the stop-to-ROI ratio

---

## Pair recommendations

The strategy performs best on high-liquidity, high-volume pairs that trend strongly during bull markets.

**Tier 1 (always include):**
`BTC/USDT`, `ETH/USDT`, `SOL/USDT`, `BNB/USDT`

**Tier 2 (add when capital allows):**
`XRP/USDT`, `AVAX/USDT`, `LINK/USDT`, `ADA/USDT`

**Tier 3 (optional expansion):**
`DOT/USDT`, `ATOM/USDT`, `LTC/USDT`, `NEAR/USDT`, `APT/USDT`, `ARB/USDT`, `OP/USDT`

!!! warning "Avoid low-cap pairs"
    The strategy relies on volume ratios and BB width. Low-cap pairs with thin order books produce unreliable signals and erratic fills. Stick to the pairs above.

---

## Strategy file location

The strategy file is at:

```
user_data/strategies/XplitradeProStrategy.py
```

This file is gitignored by default — it is never pushed to any public repository. Keep it private.

---

## Frequently asked questions

**Why is `use_exit_signal = False`?**

Backtesting revealed that exit signals (RSI overbought, EMA break, MACD fade) had an 8.9% win rate across 157 exits. They were closing profitable trades early and then watching price continue upward. Disabling them and letting the ROI table handle exits improved the win rate from ~40% to ~94%.

**Why is the hard stop −3.5% and not tighter?**

Tightening to −2.5% was tested. It caused more stops to fire (48 vs 34) during the same period because normal 1h volatility exceeded the tighter threshold. A −3.5% stop correctly filters actual trend failures from normal noise.

**Why does the strategy need 200 warmup candles?**

EMA 200 requires 200 candles of price data before it produces a valid value. Any signal before that point would be based on an incomplete indicator and could produce false entries. The `startup_candle_count = 200` setting ensures the bot skips those candles automatically.

**Can I use this on futures / short trades?**

`can_short = False` — the strategy is long-only. It is designed for spot trading on Binance. Adapting it to futures would require separate stop-loss and position sizing logic appropriate for leveraged positions.
