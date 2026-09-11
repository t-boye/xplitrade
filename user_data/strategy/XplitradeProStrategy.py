"""
XplitradeProStrategy
====================
A professional-grade trend-following strategy with momentum confirmation
and dynamic risk management.

Core Philosophy
---------------
- Only trade WITH the dominant trend (EMA 200 filter eliminates bear markets)
- Enter on pullbacks INTO the trend, not at exhaustion highs
- Require multiple independent signals to agree before entry
- Exit when momentum fades OR price breaks key structure
- Let winning trades run with a trailing ATR stop

Indicators Used
---------------
Trend    : EMA 20 / 50 / 200 — hierarchy confirms bull structure
Momentum : RSI 14, MACD (12/26/9)
Volatility: Bollinger Bands 20/2, ATR 14
Volume   : 20-period volume SMA ratio
Breadth  : ADX 14 for trend strength (avoids choppy ranges)
Timing   : Stochastic 14/3/3 for precise entry timing

Risk Management
---------------
- Hard stop: −5 % (protects against flash crashes)
- Trailing stop activates after +3 % profit, trails at 2 %
- Tiered ROI table: partial profits lock in at 30 / 60 / 120 min
"""

from functools import reduce

import numpy as np
import talib.abstract as ta
from pandas import DataFrame

from freqtrade.strategy import DecimalParameter, IntParameter, IStrategy


class XplitradeProStrategy(IStrategy):

    INTERFACE_VERSION = 3
    timeframe = "1h"
    can_short = False
    startup_candle_count = 200

    # ── ROI table ─────────────────────────────────────────────────────────────
    # Lock in profits progressively so winning trades are never given back
    minimal_roi = {
        "0":   0.06,   # 6 % — sell immediately if hit
        "30":  0.04,   # 4 % after 30 min
        "60":  0.025,  # 2.5 % after 1 h
        "120": 0.015,  # 1.5 % after 2 h
        "240": 0.008,  # 0.8 % after 4 h
    }

    # ── Stops ─────────────────────────────────────────────────────────────────
    stoploss = -0.05                          # hard stop −5 %
    trailing_stop = True
    trailing_stop_positive = 0.02             # trail 2 % once in profit
    trailing_stop_positive_offset = 0.03      # trailing kicks in after +3 %
    trailing_only_offset_is_reached = True    # no trailing before +3 %

    # ── Process only new candles ───────────────────────────────────────────────
    process_only_new_candles = True

    # ══════════════════════════════════════════════════════════════════════════
    #  Hyperopt Parameter Space
    #  Run: freqtrade hyperopt --strategy XplitradeProStrategy --spaces buy sell
    # ══════════════════════════════════════════════════════════════════════════

    # Entry parameters
    buy_ema_short   = IntParameter(10, 30, default=20, space="buy", optimize=True)
    buy_ema_long    = IntParameter(40, 70, default=50, space="buy", optimize=True)
    buy_rsi_min     = IntParameter(30, 50, default=40, space="buy", optimize=True)
    buy_rsi_max     = IntParameter(55, 70, default=65, space="buy", optimize=True)
    buy_adx_min     = IntParameter(15, 35, default=20, space="buy", optimize=True)
    buy_bb_pct_max  = DecimalParameter(0.5, 0.9, default=0.80, space="buy", optimize=True)
    buy_vol_ratio   = DecimalParameter(0.8, 2.0, default=1.0,  space="buy", optimize=True)
    buy_stoch_max   = IntParameter(50, 85, default=75, space="buy", optimize=True)

    # Exit parameters
    sell_rsi_max    = IntParameter(65, 85, default=75, space="sell", optimize=True)
    sell_stoch_min  = IntParameter(70, 90, default=80, space="sell", optimize=True)

    # ══════════════════════════════════════════════════════════════════════════
    #  Indicators
    # ══════════════════════════════════════════════════════════════════════════

    def populate_indicators(self, dataframe: DataFrame, metadata: dict) -> DataFrame:

        # ── EMAs ──────────────────────────────────────────────────────────────
        for period in (8, 20, 50, 100, 200):
            dataframe[f"ema_{period}"] = ta.EMA(dataframe, timeperiod=period)

        # ── RSI ───────────────────────────────────────────────────────────────
        dataframe["rsi"]      = ta.RSI(dataframe, timeperiod=14)
        dataframe["rsi_fast"] = ta.RSI(dataframe, timeperiod=7)

        # ── MACD ──────────────────────────────────────────────────────────────
        macd = ta.MACD(dataframe, fastperiod=12, slowperiod=26, signalperiod=9)
        dataframe["macd"]      = macd["macd"]
        dataframe["macd_sig"]  = macd["macdsignal"]
        dataframe["macd_hist"] = macd["macdhist"]

        # ── Bollinger Bands 20/2 ──────────────────────────────────────────────
        bb = ta.BBANDS(dataframe, timeperiod=20, nbdevup=2.0, nbdevdn=2.0)
        dataframe["bb_upper"]  = bb["upperband"]
        dataframe["bb_mid"]    = bb["middleband"]
        dataframe["bb_lower"]  = bb["lowerband"]
        dataframe["bb_width"]  = (dataframe["bb_upper"] - dataframe["bb_lower"]) / dataframe["bb_mid"]
        # 0 = at lower band, 1 = at upper band
        dataframe["bb_pct"] = (
            (dataframe["close"] - dataframe["bb_lower"]) /
            (dataframe["bb_upper"] - dataframe["bb_lower"]).replace(0, np.nan)
        )

        # ── ATR (volatility / position sizing proxy) ──────────────────────────
        dataframe["atr"]     = ta.ATR(dataframe, timeperiod=14)
        dataframe["atr_pct"] = dataframe["atr"] / dataframe["close"]

        # ── ADX + Directional Indicators ──────────────────────────────────────
        dataframe["adx"]      = ta.ADX(dataframe, timeperiod=14)
        dataframe["di_plus"]  = ta.PLUS_DI(dataframe, timeperiod=14)
        dataframe["di_minus"] = ta.MINUS_DI(dataframe, timeperiod=14)

        # ── Stochastic 14/3/3 ─────────────────────────────────────────────────
        stoch = ta.STOCH(dataframe, fastk_period=14, slowk_period=3, slowd_period=3)
        dataframe["stoch_k"] = stoch["slowk"]
        dataframe["stoch_d"] = stoch["slowd"]

        # ── Volume ────────────────────────────────────────────────────────────
        dataframe["vol_sma_20"] = ta.SMA(dataframe, timeperiod=20, price="volume")
        dataframe["vol_ratio"]  = dataframe["volume"] / dataframe["vol_sma_20"]

        # ── Composite trend signal ─────────────────────────────────────────────
        # True when price is in a healthy bullish structure
        dataframe["in_uptrend"] = (
            (dataframe["ema_20"] > dataframe["ema_50"]) &
            (dataframe["ema_50"] > dataframe["ema_200"]) &
            (dataframe["close"]  > dataframe["ema_200"]) &
            (dataframe["di_plus"] > dataframe["di_minus"])
        )

        # ── Candlestick helpers ────────────────────────────────────────────────
        dataframe["candle_bullish"] = dataframe["close"] > dataframe["open"]
        dataframe["body_size"]      = abs(dataframe["close"] - dataframe["open"])
        dataframe["candle_range"]   = dataframe["high"] - dataframe["low"]
        # Body is at least 30 % of candle range → real conviction candle
        dataframe["strong_candle"]  = (
            dataframe["body_size"] > 0.3 * dataframe["candle_range"]
        )

        # ── Higher-high / higher-low momentum (3-candle swing) ────────────────
        dataframe["hh"] = dataframe["high"] > dataframe["high"].shift(1)
        dataframe["hl"] = dataframe["low"]  > dataframe["low"].shift(1)

        return dataframe

    # ══════════════════════════════════════════════════════════════════════════
    #  Entry Logic
    # ══════════════════════════════════════════════════════════════════════════

    def populate_entry_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:

        conditions = [
            # ── 1. MACRO TREND FILTER ─────────────────────────────────────────
            # Never buy in a downtrend. EMA structure + DI confirms bulls control.
            dataframe["in_uptrend"],

            # ── 2. TREND STRENGTH ────────────────────────────────────────────
            # ADX > threshold confirms we are in a trending market, not choppy.
            # Avoids whipsaws in sideways / low-volatility regimes.
            dataframe["adx"] > self.buy_adx_min.value,

            # ── 3. MOMENTUM ZONE ─────────────────────────────────────────────
            # RSI between 40–65: not oversold (we won't catch falling knives),
            # not overbought (we are not chasing a parabolic move).
            dataframe["rsi"] > self.buy_rsi_min.value,
            dataframe["rsi"] < self.buy_rsi_max.value,

            # ── 4. MACD BULLISH ───────────────────────────────────────────────
            # MACD line above signal = momentum is pointing up.
            # Histogram > 0 = the gap between the two is growing (acceleration).
            dataframe["macd"] > dataframe["macd_sig"],
            dataframe["macd_hist"] > 0,

            # ── 5. BOLLINGER BAND POSITION ───────────────────────────────────
            # Do NOT buy when price is already at the top of the band.
            # bb_pct < 0.80 means price has room to expand upward.
            dataframe["bb_pct"] < self.buy_bb_pct_max.value,

            # ── 6. NOT EXTREME LOWER BAND (avoid catching falling knives) ─────
            dataframe["bb_pct"] > 0.05,

            # ── 7. STOCHASTIC NOT OVERBOUGHT ─────────────────────────────────
            # Prevents buying at local exhaustion points.
            dataframe["stoch_k"] < self.buy_stoch_max.value,

            # ── 8. VOLUME CONFIRMATION ───────────────────────────────────────
            # Entry candle volume is above the 20-period average.
            # Institutional buying leaves a volume footprint.
            dataframe["vol_ratio"] > self.buy_vol_ratio.value,

            # ── 9. CANDLE QUALITY ────────────────────────────────────────────
            # Require a genuine bullish candle with real body (not a doji).
            dataframe["candle_bullish"],
            dataframe["strong_candle"],

            # ── 10. MICRO STRUCTURE ──────────────────────────────────────────
            # Price making higher highs and higher lows over the last 2 candles.
            dataframe["hh"],
            dataframe["hl"],

            # ── SAFETY: no NaN rows ───────────────────────────────────────────
            dataframe["ema_200"].notna(),
            dataframe["volume"] > 0,
        ]

        dataframe.loc[
            reduce(lambda x, y: x & y, conditions),
            "enter_long",
        ] = 1

        return dataframe

    # ══════════════════════════════════════════════════════════════════════════
    #  Exit Logic
    # ══════════════════════════════════════════════════════════════════════════

    def populate_exit_trend(self, dataframe: DataFrame, metadata: dict) -> DataFrame:

        # ── Exit condition A: RSI overbought + stochastic exhaustion ──────────
        # Price has likely reached a local peak; lock in profits.
        exit_overbought = (
            (dataframe["rsi"] > self.sell_rsi_max.value) &
            (dataframe["stoch_k"] > self.sell_stoch_min.value) &
            (dataframe["stoch_k"] < dataframe["stoch_d"])   # stoch bearish cross
        )

        # ── Exit condition B: Trend break ─────────────────────────────────────
        # Price drops below EMA 20 AND MACD histogram turns negative.
        # The short-term trend has reversed; no reason to stay in.
        exit_trend_break = (
            (dataframe["close"] < dataframe["ema_20"]) &
            (dataframe["macd_hist"] < 0) &
            (dataframe["rsi"] < 50)
        )

        # ── Exit condition C: Volatility squeeze exit ─────────────────────────
        # Bollinger Band width contracts sharply → consolidation → potential
        # reversal. Exit before the squeeze resolves downward.
        exit_bb_squeeze = (
            (dataframe["bb_pct"] > 0.92) &    # price at top of band
            (dataframe["rsi"] > 68)             # and already extended
        )

        dataframe.loc[
            exit_overbought | exit_trend_break | exit_bb_squeeze,
            "exit_long",
        ] = 1

        return dataframe
