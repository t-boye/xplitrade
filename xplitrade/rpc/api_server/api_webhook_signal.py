"""
Xplitrade Incoming Signal Webhook
==================================
POST /api/v1/webhook/signal

Lets any external source (TradingView, your own scripts, a mobile app) trigger
an entry or exit on the running bot without needing JWT auth — the caller just
has to know the secret token you set in config.json.

Config (add to config.json):
    "webhook_signal": {
        "enabled": true,
        "secret": "CHANGE_THIS_TO_A_RANDOM_SECRET"
    }

Payload:
    {
        "action":       "buy" | "sell" | "close_all",
        "pair":         "BTC/USDT",          (required for buy/sell)
        "stake_amount": 100,                 (optional, uses config default)
        "price":        null,                (optional, market order if null)
        "tag":          "tv_signal"          (optional label shown in logs)
    }

Authentication:
    Header: X-Xplitrade-Token: <your_secret>

Response 200  { "status": "ok", "detail": "..." }
Response 400  { "status": "error", "detail": "..." }
Response 401  { "detail": "Unauthorized" }
Response 503  { "detail": "Bot is not in trading mode" }
"""

import logging

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, field_validator

from xplitrade.enums import SignalDirection
from xplitrade.rpc.api_server.deps import get_config, get_rpc
from xplitrade.rpc.rpc import RPC, RPCException


logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request schema ────────────────────────────────────────────────────────────

class SignalAction(str):
    BUY = "buy"
    SELL = "sell"
    CLOSE_ALL = "close_all"


class WebhookSignalPayload(BaseModel):
    action: str
    pair: str | None = None
    stake_amount: float | None = None
    price: float | None = None
    tag: str | None = None

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        allowed = {"buy", "sell", "close_all"}
        if v.lower() not in allowed:
            raise ValueError(f"action must be one of {allowed}")
        return v.lower()


class WebhookSignalResponse(BaseModel):
    status: str
    detail: str


# ── Auth dependency ───────────────────────────────────────────────────────────

def verify_webhook_token(
    x_xplitrade_token: str | None = Header(default=None, alias="X-Xplitrade-Token"),
    config=Depends(get_config),
):
    webhook_cfg = config.get("webhook_signal", {})
    if not webhook_cfg.get("enabled", False):
        raise HTTPException(status_code=404, detail="Webhook signal endpoint is disabled.")

    expected = webhook_cfg.get("secret", "")
    if not expected:
        raise HTTPException(
            status_code=500,
            detail="webhook_signal.secret is not configured.",
        )

    if not x_xplitrade_token or x_xplitrade_token != expected:
        logger.warning("Webhook signal: unauthorized request (bad or missing token)")
        raise HTTPException(status_code=401, detail="Unauthorized")


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post(
    "/webhook/signal",
    response_model=WebhookSignalResponse,
    tags=["Signals"],
    summary="Receive an external trading signal",
    description=(
        "Trigger a bot action from any external source. "
        "Requires the `X-Xplitrade-Token` header to match `webhook_signal.secret` in config.json."
    ),
)
def webhook_signal(
    payload: WebhookSignalPayload,
    rpc: RPC = Depends(get_rpc),
    _auth=Depends(verify_webhook_token),
):
    tag = payload.tag or "webhook_signal"
    action = payload.action

    try:
        if action == "buy":
            if not payload.pair:
                raise HTTPException(status_code=400, detail="pair is required for action=buy")

            trade = rpc._rpc_force_entry(
                pair=payload.pair,
                price=payload.price,
                order_side=SignalDirection.LONG,
                order_type=None,
                stake_amount=payload.stake_amount,
                enter_tag=tag,
            )

            if trade:
                logger.info(f"Webhook signal: entered BUY {payload.pair} (tag={tag})")
                return {"status": "ok", "detail": f"Entered long {payload.pair} — trade id {trade.id}"}
            else:
                return {"status": "error", "detail": f"Could not enter {payload.pair} — check max_open_trades or balance"}

        elif action == "sell":
            if not payload.pair:
                raise HTTPException(status_code=400, detail="pair is required for action=sell")

            open_trades = rpc._rpc_trade_status()
            pair_trades = [t for t in open_trades if t["pair"] == payload.pair and not t["close_date"]]

            if not pair_trades:
                return {"status": "error", "detail": f"No open trade found for {payload.pair}"}

            closed = []
            for trade in pair_trades:
                rpc._rpc_force_exit(str(trade["trade_id"]), None, amount=payload.stake_amount, price=payload.price)
                closed.append(trade["trade_id"])
                logger.info(f"Webhook signal: exited trade {trade['trade_id']} for {payload.pair} (tag={tag})")

            return {"status": "ok", "detail": f"Closed trades {closed} for {payload.pair}"}

        elif action == "close_all":
            open_trades = rpc._rpc_trade_status()
            active = [t for t in open_trades if not t["close_date"]]

            if not active:
                return {"status": "ok", "detail": "No open trades to close"}

            closed = []
            for trade in active:
                rpc._rpc_force_exit(str(trade["trade_id"]), None)
                closed.append(trade["trade_id"])

            logger.info(f"Webhook signal: close_all closed {len(closed)} trades (tag={tag})")
            return {"status": "ok", "detail": f"Closed {len(closed)} trades: {closed}"}

    except RPCException as e:
        logger.error(f"Webhook signal RPC error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
