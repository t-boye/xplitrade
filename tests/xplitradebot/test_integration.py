import time
from unittest.mock import MagicMock

import pytest
from sqlalchemy import select

from xplitrade.enums import ExitCheckTuple, ExitType, TradingMode
from xplitrade.persistence import Trade
from xplitrade.persistence.models import Order
from xplitrade.rpc.rpc import RPC
from tests.conftest import EXMS, get_patched_xplitradebot, log_has_re, patch_get_signal


def test_may_execute_exit_stoploss_on_exchange_multi(default_conf, ticker, fee, mocker) -> None:
    """
    Tests workflow of selling stoploss_on_exchange.
    Sells
    * first trade as stoploss
    * 2nd trade is kept
    * 3rd trade is sold via sell-signal
    """
    default_conf["max_open_trades"] = 3
    default_conf["exchange"]["name"] = "binance"

    stoploss = {"id": 123, "info": {}}
    stoploss_order_open = {
        "id": "123",
        "timestamp": 1542707426845,
        "datetime": "2018-11-20T09:50:26.845Z",
        "lastTradeTimestamp": None,
        "symbol": "BTC/USDT",
        "type": "stop_loss_limit",
        "side": "sell",
        "price": 1.08801,
        "amount": 91.07468123,
        "cost": 0.0,
        "average": 0.0,
        "filled": 0.0,
        "remaining": 0.0,
        "status": "open",
        "fee": None,
        "trades": None,
    }
    stoploss_order_closed = stoploss_order_open.copy()
    stoploss_order_closed["status"] = "closed"
    stoploss_order_closed["filled"] = stoploss_order_closed["amount"]

    # Sell first trade based on stoploss, keep 2nd and 3rd trade open
    stop_orders = [stoploss_order_closed, stoploss_order_open.copy(), stoploss_order_open.copy()]
    stoploss_order_mock = MagicMock(side_effect=stop_orders)
    # Sell 3rd trade (not called for the first trade)
    should_sell_mock = MagicMock(side_effect=[[], [ExitCheckTuple(exit_type=ExitType.EXIT_SIGNAL)]])

    def patch_stoploss(order_id, *args, **kwargs):
        slo = stoploss_order_open.copy()
        slo["id"] = order_id
        slo["status"] = "canceled"
        return slo

    cancel_order_mock = MagicMock(side_effect=patch_stoploss)
    mocker.patch.multiple(
        EXMS,
        fetch_ticker=ticker,
        get_fee=fee,
        amount_to_precision=lambda s, x, y: y,
        price_to_precision=lambda s, x, y: y,
    )

    mocker.patch.multiple(
        "xplitrade.xplitradebot.XplitradeBot",
        create_stoploss_order=MagicMock(return_value=True),
        _notify_exit=MagicMock(),
    )
    mocker.patch("xplitrade.strategy.interface.IStrategy.should_exit", should_sell_mock)
    wallets_mock = mocker.patch("xplitrade.wallets.Wallets.update")
    mocker.patch("xplitrade.wallets.Wallets.get_free", return_value=1000)
    mocker.patch("xplitrade.wallets.Wallets.check_exit_amount", return_value=True)

    xplitrade = get_patched_xplitradebot(mocker, default_conf)
    mocker.patch.multiple(
        xplitrade.exchange,
        create_stoploss=stoploss,
        fetch_stoploss_order=stoploss_order_mock,
        cancel_stoploss_order_with_result=cancel_order_mock,
    )
    xplitrade.strategy.order_types["stoploss_on_exchange"] = True
    # Switch ordertype to market to close trade immediately
    xplitrade.strategy.order_types["exit"] = "market"
    xplitrade.strategy.confirm_trade_entry = MagicMock(return_value=True)
    xplitrade.strategy.confirm_trade_exit = MagicMock(return_value=True)
    patch_get_signal(xplitrade)

    # Create some test data
    xplitrade.enter_positions(3)
    assert xplitrade.strategy.confirm_trade_entry.call_count == 3
    xplitrade.strategy.confirm_trade_entry.reset_mock()
    assert xplitrade.strategy.confirm_trade_exit.call_count == 0
    wallets_mock.reset_mock()

    trades = Trade.session.scalars(select(Trade)).all()
    # Make sure stoploss-order is open and trade is bought
    for idx, trade in enumerate(trades):
        stop_order = stop_orders[idx]
        stop_order["id"] = f"stop{idx}"
        oobj = Order.parse_from_ccxt_object(stop_order, trade.pair, "stoploss")
        oobj.ft_is_open = True

        trade.orders.append(oobj)
        assert len(trade.open_sl_orders) == 1

    n = xplitrade.exit_positions(trades)
    assert n == 2
    assert should_sell_mock.call_count == 2
    assert xplitrade.strategy.confirm_trade_entry.call_count == 0
    assert xplitrade.strategy.confirm_trade_exit.call_count == 1
    xplitrade.strategy.confirm_trade_exit.reset_mock()

    # Only order for 3rd trade needs to be cancelled
    assert cancel_order_mock.call_count == 1
    assert stoploss_order_mock.call_count == 3
    # Wallets must be updated between stoploss cancellation and selling, and will be updated again
    # during update_trade_state
    assert wallets_mock.call_count == 4

    trade = trades[0]
    assert trade.exit_reason == ExitType.STOPLOSS_ON_EXCHANGE.value
    assert not trade.is_open

    trade = trades[1]
    assert not trade.exit_reason
    assert trade.is_open

    trade = trades[2]
    assert trade.exit_reason == ExitType.EXIT_SIGNAL.value
    assert not trade.is_open


@pytest.mark.parametrize(
    "balance_ratio,result1",
    [
        (1, 200),
        (0.99, 198),
    ],
)
def test_forcebuy_last_unlimited(default_conf, ticker, fee, mocker, balance_ratio, result1) -> None:
    """
    Tests workflow unlimited stake-amount
    Buy 4 trades, forcebuy a 5th trade
    Sell one trade, calculated stake amount should now be lower than before since
    one trade was sold at a loss.
    """
    default_conf["max_open_trades"] = 5
    default_conf["force_entry_enable"] = True
    default_conf["stake_amount"] = "unlimited"
    default_conf["tradable_balance_ratio"] = balance_ratio
    default_conf["dry_run_wallet"] = 1000
    default_conf["exchange"]["name"] = "binance"
    default_conf["telegram"]["enabled"] = True
    mocker.patch("xplitrade.rpc.telegram.Telegram", MagicMock())
    mocker.patch.multiple(
        EXMS,
        fetch_ticker=ticker,
        get_fee=fee,
        amount_to_precision=lambda s, x, y: y,
        price_to_precision=lambda s, x, y: y,
    )

    mocker.patch.multiple(
        "xplitrade.xplitradebot.XplitradeBot",
        create_stoploss_order=MagicMock(return_value=True),
        _notify_exit=MagicMock(),
    )
    should_sell_mock = MagicMock(
        side_effect=[[], [ExitCheckTuple(exit_type=ExitType.EXIT_SIGNAL)], [], [], []]
    )
    mocker.patch("xplitrade.strategy.interface.IStrategy.should_exit", should_sell_mock)

    xplitrade = get_patched_xplitradebot(mocker, default_conf)
    rpc = RPC(xplitrade)
    xplitrade.strategy.order_types["stoploss_on_exchange"] = True
    # Switch ordertype to market to close trade immediately
    xplitrade.strategy.order_types["exit"] = "market"
    patch_get_signal(xplitrade)

    # Create 4 trades
    n = xplitrade.enter_positions(5)
    assert n == 4

    trades = Trade.session.scalars(select(Trade)).all()
    assert len(trades) == 4
    assert xplitrade.wallets.get_trade_stake_amount("XRP/BTC", 5) == result1

    rpc._rpc_force_entry("TKN/BTC", None)

    trades = Trade.session.scalars(select(Trade)).all()
    assert len(trades) == 5

    for trade in trades:
        assert pytest.approx(trade.stake_amount) == result1

    trades = Trade.get_open_trades()
    assert len(trades) == 5
    bals = xplitrade.wallets.get_all_balances()

    n = xplitrade.exit_positions(trades)
    assert n == 1
    trades = Trade.get_open_trades()
    # One trade sold
    assert len(trades) == 4
    # stake-amount should now be reduced, since one trade was sold at a loss.
    assert xplitrade.wallets.get_trade_stake_amount("XRP/BTC", 5) < result1
    # Validate that balance of sold trade is not in dry-run balances anymore.
    bals2 = xplitrade.wallets.get_all_balances()
    assert bals != bals2
    assert len(bals) == 6
    assert len(bals2) == 5
    assert "LTC" in bals
    assert "LTC" not in bals2


def test_dca_buying(default_conf_usdt, ticker_usdt, fee, mocker) -> None:
    default_conf_usdt["position_adjustment_enable"] = True

    xplitrade = get_patched_xplitradebot(mocker, default_conf_usdt)
    mocker.patch.multiple(
        EXMS,
        fetch_ticker=ticker_usdt,
        get_fee=fee,
    )

    patch_get_signal(xplitrade)
    xplitrade.enter_positions(1)

    assert len(Trade.get_trades().all()) == 1
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 1
    assert pytest.approx(trade.stake_amount) == 60
    assert trade.open_rate == 2.0
    # No adjustment
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 1
    assert pytest.approx(trade.stake_amount) == 60

    # Reduce bid amount
    ticker_usdt_modif = ticker_usdt.return_value
    ticker_usdt_modif["bid"] = ticker_usdt_modif["bid"] * 0.995
    mocker.patch(f"{EXMS}.fetch_ticker", return_value=ticker_usdt_modif)

    # additional buy order
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 2
    for o in trade.orders:
        assert o.status == "closed"
    assert pytest.approx(trade.stake_amount) == 120

    # Open-rate averaged between 2.0 and 2.0 * 0.995
    assert trade.open_rate < 2.0
    assert trade.open_rate > 2.0 * 0.995

    # No action - profit raised above 1% (the bar set in the strategy).
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 2
    assert pytest.approx(trade.stake_amount) == 120
    assert trade.orders[0].amount == 30
    assert pytest.approx(trade.orders[1].amount) == 60 / ticker_usdt_modif["bid"]

    assert pytest.approx(trade.amount) == trade.orders[0].amount + trade.orders[1].amount
    assert trade.nr_of_successful_buys == 2
    assert trade.nr_of_successful_entries == 2

    # Sell
    patch_get_signal(xplitrade, enter_long=False, exit_long=True)
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert trade.is_open is False
    assert trade.orders[0].amount == 30
    assert trade.orders[0].side == "buy"
    assert pytest.approx(trade.orders[1].amount) == 60 / ticker_usdt_modif["bid"]
    # Sold everything
    assert trade.orders[-1].side == "sell"
    assert trade.orders[2].amount == trade.amount

    assert trade.nr_of_successful_buys == 2
    assert trade.nr_of_successful_entries == 2


def test_dca_short(default_conf_usdt, ticker_usdt, fee, mocker) -> None:
    default_conf_usdt["position_adjustment_enable"] = True

    xplitrade = get_patched_xplitradebot(mocker, default_conf_usdt)
    mocker.patch.multiple(
        EXMS,
        fetch_ticker=ticker_usdt,
        get_fee=fee,
        amount_to_precision=lambda s, x, y: round(y, 4),
        price_to_precision=lambda s, x, y: y,
    )

    patch_get_signal(xplitrade, enter_long=False, enter_short=True)
    xplitrade.enter_positions(1)

    assert len(Trade.get_trades().all()) == 1
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 1
    assert pytest.approx(trade.stake_amount) == 60
    assert trade.open_rate == 2.02
    assert trade.orders[0].amount == trade.amount
    # No adjustment
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 1
    assert pytest.approx(trade.stake_amount) == 60

    # Reduce bid amount
    ticker_usdt_modif = ticker_usdt.return_value
    ticker_usdt_modif["ask"] = ticker_usdt_modif["ask"] * 1.004
    mocker.patch(f"{EXMS}.fetch_ticker", return_value=ticker_usdt_modif)

    # additional buy order
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 2
    for o in trade.orders:
        assert o.status == "closed"
    assert pytest.approx(trade.stake_amount) == 120

    # Open-rate averaged between 2.0 and 2.0 * 1.015
    assert trade.open_rate >= 2.02
    assert trade.open_rate < 2.02 * 1.015

    # No action - profit raised above 1% (the bar set in the strategy).
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 2
    assert pytest.approx(trade.stake_amount) == 120
    assert trade.orders[1].amount == round(60 / ticker_usdt_modif["ask"], 4)

    assert trade.amount == trade.orders[0].amount + trade.orders[1].amount
    assert trade.nr_of_successful_entries == 2

    # Buy
    patch_get_signal(xplitrade, enter_long=False, exit_short=True)
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert trade.is_open is False
    # assert trade.orders[0].amount == 30
    assert trade.orders[0].side == "sell"
    assert trade.orders[1].amount == round(60 / ticker_usdt_modif["ask"], 4)
    # Sold everything
    assert trade.orders[-1].side == "buy"
    assert trade.orders[2].amount == trade.amount

    assert trade.nr_of_successful_entries == 2
    assert trade.nr_of_successful_exits == 1


@pytest.mark.parametrize("leverage", [1, 2])
def test_dca_order_adjust(default_conf_usdt, ticker_usdt, leverage, fee, mocker) -> None:
    default_conf_usdt["position_adjustment_enable"] = True
    default_conf_usdt["trading_mode"] = "futures"
    default_conf_usdt["margin_mode"] = "isolated"

    xplitrade = get_patched_xplitradebot(mocker, default_conf_usdt)
    mocker.patch.multiple(
        EXMS,
        fetch_ticker=ticker_usdt,
        get_fee=fee,
        amount_to_precision=lambda s, x, y: y,
        price_to_precision=lambda s, x, y: y,
    )
    mocker.patch(f"{EXMS}._dry_is_price_crossed", return_value=False)
    mocker.patch(f"{EXMS}.get_max_leverage", return_value=10)
    mocker.patch(f"{EXMS}.get_funding_fees", return_value=0)
    mocker.patch(f"{EXMS}.get_maintenance_ratio_and_amt", return_value=(0, 0))

    patch_get_signal(xplitrade)
    xplitrade.strategy.custom_entry_price = lambda **kwargs: ticker_usdt["ask"] * 0.96
    xplitrade.strategy.leverage = MagicMock(return_value=leverage)
    xplitrade.strategy.minimal_roi = {0: 0.2}

    xplitrade.enter_positions(1)

    assert len(Trade.get_trades().all()) == 1
    trade: Trade = Trade.get_trades().first()
    assert len(trade.orders) == 1
    assert trade.has_open_orders
    assert pytest.approx(trade.stake_amount) == 60
    assert trade.open_rate == 1.96
    assert trade.stop_loss_pct == -0.1
    assert pytest.approx(trade.stop_loss) == trade.open_rate * (1 - 0.1 / leverage)
    assert pytest.approx(trade.initial_stop_loss) == trade.open_rate * (1 - 0.1 / leverage)
    assert trade.initial_stop_loss_pct == -0.1
    assert trade.leverage == leverage
    assert trade.stake_amount == 60
    # No adjustment
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 1
    assert trade.has_open_orders
    assert pytest.approx(trade.stake_amount) == 60

    # Cancel order and place new one
    xplitrade.strategy.adjust_entry_price = MagicMock(return_value=1.99)
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 2
    assert trade.has_open_orders
    # Open rate is not adjusted yet
    assert trade.open_rate == 1.96
    assert trade.stop_loss_pct == -0.1
    assert pytest.approx(trade.stop_loss) == trade.open_rate * (1 - 0.1 / leverage)
    assert pytest.approx(trade.initial_stop_loss) == trade.open_rate * (1 - 0.1 / leverage)
    assert trade.stake_amount == 60
    assert trade.initial_stop_loss_pct == -0.1

    # Fill order
    mocker.patch(f"{EXMS}._dry_is_price_crossed", return_value=True)
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 2
    assert not trade.has_open_orders
    # Open rate is not adjusted yet
    assert trade.open_rate == 1.99
    assert pytest.approx(trade.stake_amount) == 60
    assert trade.stop_loss_pct == -0.1
    assert pytest.approx(trade.stop_loss) == 1.99 * (1 - 0.1 / leverage)
    assert pytest.approx(trade.initial_stop_loss) == 1.96 * (1 - 0.1 / leverage)
    assert trade.initial_stop_loss_pct == -0.1
    assert pytest.approx(trade.orders[-1].stake_amount) == trade.stake_amount

    # 2nd order - not filling
    xplitrade.strategy.adjust_trade_position = MagicMock(return_value=120)
    mocker.patch(f"{EXMS}._dry_is_price_crossed", return_value=False)

    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 3
    assert trade.has_open_orders
    assert trade.open_rate == 1.99
    assert trade.orders[-1].price == 1.96
    assert trade.orders[-1].cost == 120 * leverage
    time.sleep(0.1)

    # Replace new order with diff. order at a lower price
    xplitrade.strategy.adjust_entry_price = MagicMock(return_value=1.95)
    xplitrade.strategy.adjust_exit_price = MagicMock(side_effect=ValueError)
    xplitrade.strategy.adjust_trade_position = MagicMock(return_value=None)
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 4
    assert trade.has_open_orders
    assert trade.open_rate == 1.99
    assert pytest.approx(trade.stake_amount) == 60
    assert trade.orders[-1].price == 1.95
    assert pytest.approx(trade.orders[-1].cost) == 120 * leverage
    assert xplitrade.strategy.adjust_entry_price.call_count == 1
    assert xplitrade.strategy.adjust_exit_price.call_count == 0

    # Fill DCA order
    xplitrade.strategy.adjust_trade_position = MagicMock(return_value=None)
    mocker.patch(f"{EXMS}._dry_is_price_crossed", return_value=True)
    xplitrade.strategy.adjust_entry_price = MagicMock(side_effect=ValueError)

    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 4
    assert not trade.has_open_orders
    assert pytest.approx(trade.open_rate) == 1.963153456
    assert trade.orders[-1].price == 1.95
    assert pytest.approx(trade.orders[-1].cost) == 120 * leverage
    assert trade.orders[-1].status == "closed"

    assert pytest.approx(trade.amount) == 91.689215 * leverage
    # Check the 2 filled orders equal the above amount
    assert pytest.approx(trade.orders[1].amount) == 30.150753768 * leverage
    assert pytest.approx(trade.orders[-1].amount) == 61.538461232 * leverage

    # Full exit
    mocker.patch(f"{EXMS}._dry_is_price_crossed", return_value=False)
    xplitrade.strategy.custom_exit = MagicMock(return_value="Exit now")
    xplitrade.strategy.adjust_entry_price = MagicMock(return_value=2.02)
    xplitrade.strategy.adjust_exit_price = MagicMock(side_effect=ValueError)
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 5
    assert trade.orders[-1].side == trade.exit_side
    assert trade.orders[-1].status == "open"
    assert trade.orders[-1].price == 2.02
    assert pytest.approx(trade.amount) == 91.689215 * leverage
    assert pytest.approx(trade.orders[-1].amount) == 91.689215 * leverage
    assert xplitrade.strategy.adjust_entry_price.call_count == 0
    assert xplitrade.strategy.adjust_exit_price.call_count == 0

    # Process again, should not adjust price
    xplitrade.process()
    trade = Trade.get_trades().first()

    assert trade.orders[-2].status == "closed"
    assert len(trade.orders) == 5
    assert trade.orders[-1].side == trade.exit_side
    assert trade.orders[-1].status == "open"
    assert trade.orders[-1].price == 2.02
    # Adjust entry price cannot be called - this is an exit order
    assert xplitrade.strategy.adjust_entry_price.call_count == 0
    assert xplitrade.strategy.adjust_exit_price.call_count == 1

    xplitrade.strategy.adjust_exit_price = MagicMock(return_value=2.03)

    # Process again, should adjust exit price
    xplitrade.process()
    trade = Trade.get_trades().first()

    assert trade.orders[-2].status == "canceled"
    assert len(trade.orders) == 6
    assert trade.orders[-1].side == trade.exit_side
    assert trade.orders[-1].status == "open"
    assert trade.orders[-1].price == 2.03
    assert xplitrade.strategy.adjust_entry_price.call_count == 0
    assert xplitrade.strategy.adjust_exit_price.call_count == 1


@pytest.mark.parametrize("leverage", [1, 2])
@pytest.mark.parametrize("is_short", [False, True])
def test_dca_order_adjust_entry_replace_fails(
    default_conf_usdt, ticker_usdt, fee, mocker, caplog, is_short, leverage
) -> None:
    spot = leverage == 1
    if not spot:
        default_conf_usdt["trading_mode"] = "futures"
        default_conf_usdt["margin_mode"] = "isolated"
    default_conf_usdt["position_adjustment_enable"] = True
    default_conf_usdt["max_open_trades"] = 2
    xplitrade = get_patched_xplitradebot(mocker, default_conf_usdt)
    mocker.patch.multiple(
        EXMS,
        fetch_ticker=ticker_usdt,
        get_fee=fee,
        get_funding_fees=MagicMock(return_value=0),
    )

    # no order fills.
    mocker.patch(f"{EXMS}._dry_is_price_crossed", side_effect=[False, True])
    patch_get_signal(xplitrade, enter_short=is_short, enter_long=not is_short)
    xplitrade.enter_positions(2)

    trades = Trade.session.scalars(
        select(Trade)
        .where(Order.ft_is_open.is_(True))
        .where(Order.ft_order_side != "stoploss")
        .where(Order.ft_trade_id == Trade.id)
    ).all()
    assert len(trades) == 1

    mocker.patch(f"{EXMS}._dry_is_price_crossed", return_value=False)

    # Timeout to not interfere
    xplitrade.strategy.ft_check_timed_out = MagicMock(return_value=False)

    # Create DCA order for 2nd trade (so we have 2 open orders on 2 trades)
    # this 2nd order won't fill.

    xplitrade.strategy.adjust_trade_position = MagicMock(return_value=(20, "PeNF"))

    xplitrade.process()

    assert xplitrade.strategy.adjust_trade_position.call_count == 2
    trades = Trade.session.scalars(
        select(Trade)
        .where(Order.ft_is_open.is_(True))
        .where(Order.ft_order_side != "stoploss")
        .where(Order.ft_trade_id == Trade.id)
    ).all()
    assert len(trades) == 2

    # We now have 2 orders open
    xplitrade.strategy.adjust_entry_price = MagicMock(return_value=2.05)
    xplitrade.manage_open_orders()
    trades = Trade.session.scalars(
        select(Trade)
        .where(Order.ft_is_open.is_(True))
        .where(Order.ft_order_side != "stoploss")
        .where(Order.ft_trade_id == Trade.id)
    ).all()
    assert len(trades) == 2
    assert len(Order.get_open_orders()) == 2
    # Entry adjustment is called
    assert xplitrade.strategy.adjust_entry_price.call_count == 2

    # Attempt order replacement - fails.
    xplitrade.strategy.adjust_entry_price = MagicMock(return_value=1234)

    entry_mock = mocker.patch(
        "xplitrade.xplitradebot.XplitradeBot.execute_entry", return_value=False
    )
    msg = r"Could not replace order for.*"
    assert not log_has_re(msg, caplog)
    xplitrade.manage_open_orders()

    assert log_has_re(msg, caplog)
    assert entry_mock.call_count == 2
    assert len(Trade.get_trades().all()) == 1
    assert len(Order.get_open_orders()) == 0


@pytest.mark.parametrize("leverage", [1, 2])
def test_dca_exiting(default_conf_usdt, ticker_usdt, fee, mocker, caplog, leverage) -> None:
    default_conf_usdt["position_adjustment_enable"] = True
    spot = leverage == 1
    if not spot:
        default_conf_usdt["trading_mode"] = "futures"
        default_conf_usdt["margin_mode"] = "isolated"
    xplitrade = get_patched_xplitradebot(mocker, default_conf_usdt)
    assert xplitrade.trading_mode == TradingMode.FUTURES if not spot else TradingMode.SPOT
    mocker.patch.multiple(
        EXMS,
        fetch_ticker=ticker_usdt,
        get_fee=fee,
        amount_to_precision=lambda s, x, y: y,
        price_to_precision=lambda s, x, y: y,
        get_min_pair_stake_amount=MagicMock(return_value=10),
        get_funding_fees=MagicMock(return_value=0),
    )
    mocker.patch(f"{EXMS}.get_max_leverage", return_value=10)
    starting_amount = xplitrade.wallets.get_total("USDT")
    assert starting_amount == 1000

    patch_get_signal(xplitrade)
    xplitrade.strategy.leverage = MagicMock(return_value=leverage)
    xplitrade.enter_positions(1)

    assert len(Trade.get_trades().all()) == 1
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 1
    assert pytest.approx(trade.stake_amount) == 60
    assert trade.leverage == leverage
    assert pytest.approx(trade.amount) == 30.0 * leverage
    assert trade.open_rate == 2.0
    assert pytest.approx(xplitrade.wallets.get_free("USDT")) == starting_amount - 60
    if spot:
        assert pytest.approx(xplitrade.wallets.get_total("USDT")) == starting_amount - 60
    else:
        assert xplitrade.wallets.get_total("USDT") == starting_amount

    # Too small size
    xplitrade.strategy.adjust_trade_position = MagicMock(return_value=-59)
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 1
    assert pytest.approx(trade.stake_amount) == 60
    assert pytest.approx(trade.amount) == 30.0 * leverage
    assert log_has_re(
        r"Remaining amount of \d\.\d+.* would be smaller than the minimum of 10.", caplog
    )

    xplitrade.strategy.adjust_trade_position = MagicMock(return_value=(-20, "PES"))

    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 2
    assert trade.orders[-1].ft_order_side == "sell"
    assert trade.orders[-1].ft_order_tag == "PES"
    assert pytest.approx(trade.stake_amount) == 40
    assert pytest.approx(trade.amount) == 20 * leverage
    assert trade.open_rate == 2.0
    assert trade.is_open
    assert trade.realized_profit > 0.098 * leverage
    expected_profit = starting_amount - 40 + trade.realized_profit
    assert pytest.approx(xplitrade.wallets.get_free("USDT")) == expected_profit

    if spot:
        assert pytest.approx(xplitrade.wallets.get_total("USDT")) == expected_profit
    else:
        # total won't change in futures mode, only free / used will.
        assert xplitrade.wallets.get_total("USDT") == starting_amount + trade.realized_profit
    caplog.clear()

    # Sell more than what we got (we got ~20 coins left)
    # Doesn't exit, as the amount is too high.
    xplitrade.strategy.adjust_trade_position = MagicMock(return_value=-50)
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 2

    # Amount too low...
    xplitrade.strategy.adjust_trade_position = MagicMock(return_value=-(trade.stake_amount * 0.99))
    xplitrade.process()

    trade = Trade.get_trades().first()
    assert len(trade.orders) == 2

    # Amount exactly comes out as exactly 0
    xplitrade.strategy.adjust_trade_position = MagicMock(return_value=-trade.stake_amount)
    xplitrade.process()

    trade = Trade.get_trades().first()
    assert len(trade.orders) == 3

    assert trade.orders[-1].ft_order_side == "sell"
    assert pytest.approx(trade.stake_amount) == 40
    assert trade.is_open is False

    # use amount that would trunc to 0.0 once selling
    mocker.patch(f"{EXMS}.amount_to_contract_precision", lambda s, p, v: round(v, 1))
    xplitrade.strategy.adjust_trade_position = MagicMock(return_value=-0.01)
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert len(trade.orders) == 3
    assert trade.orders[-1].ft_order_side == "sell"
    assert pytest.approx(trade.stake_amount) == 40
    assert trade.is_open is False
    assert log_has_re(
        "Wanted to exit of -0.01 amount, but exit amount is now 0.0 due to exchange limits "
        "- not exiting.",
        caplog,
    )
    expected_profit = starting_amount - 60 + trade.realized_profit
    assert pytest.approx(xplitrade.wallets.get_free("USDT")) == expected_profit
    if spot:
        assert pytest.approx(xplitrade.wallets.get_total("USDT")) == expected_profit
    else:
        # total won't change in futures mode, only free / used will.
        assert xplitrade.wallets.get_total("USDT") == starting_amount + trade.realized_profit


@pytest.mark.parametrize("leverage", [1, 2])
@pytest.mark.parametrize("is_short", [False, True])
def test_dca_handle_similar_open_order(
    default_conf_usdt, ticker_usdt, is_short, leverage, fee, mocker, caplog
) -> None:
    default_conf_usdt["position_adjustment_enable"] = True
    default_conf_usdt["trading_mode"] = "futures"
    default_conf_usdt["margin_mode"] = "isolated"

    xplitrade = get_patched_xplitradebot(mocker, default_conf_usdt)
    mocker.patch.multiple(
        EXMS,
        fetch_ticker=ticker_usdt,
        get_fee=fee,
        amount_to_precision=lambda s, x, y: y,
        price_to_precision=lambda s, x, y: y,
    )
    mocker.patch(f"{EXMS}._dry_is_price_crossed", return_value=False)
    mocker.patch(f"{EXMS}.get_max_leverage", return_value=10)
    mocker.patch(f"{EXMS}.get_funding_fees", return_value=0)
    mocker.patch(f"{EXMS}.get_maintenance_ratio_and_amt", return_value=(0, 0))

    patch_get_signal(xplitrade, enter_short=is_short, enter_long=not is_short)
    xplitrade.strategy.custom_entry_price = lambda **kwargs: ticker_usdt["ask"] * 0.96
    xplitrade.strategy.leverage = MagicMock(return_value=leverage)
    xplitrade.strategy.custom_exit = MagicMock(return_value=False)
    xplitrade.strategy.minimal_roi = {0: 0.2}

    # Create trade and initial entry order
    xplitrade.enter_positions(1)

    assert len(Trade.get_trades().all()) == 1
    trade: Trade = Trade.get_trades().first()
    assert len(trade.orders) == 1
    assert trade.orders[-1].side == trade.entry_side
    assert trade.orders[-1].status == "open"

    assert trade.has_open_orders
    # Process - shouldn't do anything
    xplitrade.process()
    # Doesn't try to exit, as we're not in a position yet
    assert xplitrade.strategy.custom_exit.call_count == 0

    # Adjust with new price, cancel initial entry order and place new one
    xplitrade.strategy.adjust_entry_price = MagicMock(return_value=1.99)
    xplitrade.strategy.ft_check_timed_out = MagicMock(return_value=False)
    xplitrade.process()
    trade = Trade.get_trades().first()
    xplitrade.strategy.ft_check_timed_out = MagicMock(return_value=False)

    assert len(trade.orders) == 2
    assert len(trade.open_orders) == 1

    # Adjust with new amount, should cancel and replace existing order
    xplitrade.strategy.adjust_trade_position = MagicMock(
        return_value=21
    )  # -(trade.stake_amount * 0.5)
    xplitrade.process()
    trade = Trade.get_trades().first()

    assert len(trade.orders) == 3
    assert len(trade.open_orders) == 1

    # Fill entry order
    assert xplitrade.strategy.custom_exit.call_count == 0

    mocker.patch(f"{EXMS}._dry_is_price_crossed", return_value=True)
    xplitrade.process()

    trade = Trade.get_trades().first()
    assert trade.amount > 0

    assert xplitrade.strategy.custom_exit.call_count == 1
    xplitrade.strategy.custom_exit.reset_mock()

    # Should Create a new exit order
    xplitrade.exchange.amount_to_contract_precision = MagicMock(return_value=2)
    xplitrade.strategy.adjust_trade_position = MagicMock(return_value=-2)
    msg = r"Skipping cancelling stoploss on exchange for.*"

    mocker.patch(f"{EXMS}._dry_is_price_crossed", return_value=False)
    assert not log_has_re(msg, caplog)
    xplitrade.process()
    assert log_has_re(msg, caplog)

    trade = Trade.get_trades().first()

    assert trade.orders[-2].status == "closed"
    assert trade.orders[-1].status == "open"
    assert trade.orders[-1].side == trade.exit_side
    assert len(trade.orders) == 5
    assert len(trade.open_orders) == 1
    assert xplitrade.strategy.custom_exit.call_count == 1
    xplitrade.strategy.custom_exit.reset_mock()

    # Adjust with new exit amount, should cancel and replace existing exit order
    xplitrade.exchange.amount_to_contract_precision = MagicMock(return_value=3)
    xplitrade.strategy.adjust_trade_position = MagicMock(return_value=-3)
    xplitrade.process()
    trade = Trade.get_trades().first()
    # Even with open order, trying to exit...
    assert xplitrade.strategy.custom_exit.call_count == 1
    xplitrade.strategy.custom_exit.reset_mock()

    assert trade.orders[-2].status == "canceled"
    assert len(trade.orders) == 6
    assert len(trade.open_orders) == 1

    # Adjust with new exit price, should cancel and replace existing exit order
    xplitrade.strategy.custom_exit_price = MagicMock(return_value=1.95)
    xplitrade.process()
    # Even with open order, trying to exit...
    assert xplitrade.strategy.custom_exit.call_count == 1
    xplitrade.strategy.custom_exit.reset_mock()

    trade = Trade.get_trades().first()

    assert trade.orders[-2].status == "canceled"
    assert len(trade.orders) == 7
    assert len(trade.open_orders) == 1
    similar_msg = r"A similar open order was found for.*"

    assert not log_has_re(similar_msg, caplog)

    # Adjust with same params, should keep existing order as price and amount are similar
    xplitrade.strategy.custom_exit_price = MagicMock(return_value=1.95)
    xplitrade.process()
    trade = Trade.get_trades().first()
    assert log_has_re(similar_msg, caplog)

    assert len(trade.orders) == 7
    assert len(trade.open_orders) == 1
