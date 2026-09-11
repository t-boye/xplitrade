# Live Deployment Guide

This guide walks you through everything needed to go from a local install to a live, 24/7 running bot on a VPS with Telegram control and optional external signal support.

---

## Step 1 — Get a Binance API Key

!!! danger "Security — Spot trading only"
    Enable **Spot Trading** only. **Never enable withdrawals** — the bot never needs them, and enabling them creates an unnecessary security risk.

1. Go to **Binance → Account → API Management**
2. Click **Create API key** → label it `xplitrade-live`
3. **Restrict to your VPS IP address** — prevents use from any other machine
4. Set permissions:
    - ✅ Enable Reading
    - ✅ Enable Spot Trading
    - ❌ Enable Withdrawals (must be OFF)
5. Copy the **API Key** and **Secret** — you'll paste them into `user_data/config.json` under `exchange.key` and `exchange.secret`

---

## Step 2 — Create a Telegram Bot

Telegram gives you full mobile control over the bot (status, profit, emergency exit).

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` → name it `Xplitrade Bot` → set a username like `xplitrade_yourname_bot`
3. BotFather gives you a token in the format `7123456789:AAFxxxxxxxxxx` — copy it
4. **Get your Chat ID:**
    - Start a conversation with your new bot (send any message)
    - Open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in your browser
    - Find `"chat": {"id": 123456789}` — that number is your Chat ID
5. In `user_data/config.json`, set `"enabled": true` in the `telegram` block and paste your token and chat_id:

```json
"telegram": {
    "enabled": true,
    "token": "7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "chat_id": "123456789"
}
```

### Telegram commands

Once the bot is running, send these commands to your Telegram bot:

| Command | What it does |
|---|---|
| `/status` | Show all open trades |
| `/profit` | Cumulative P&L since start |
| `/balance` | Current wallet balance |
| `/trades` | List recent closed trades |
| `/forcesell all` | Emergency — close all open positions immediately |
| `/stop` | Stop the bot (does not close open trades) |
| `/start` | Restart the bot after /stop |

---

## Step 3 — Rent a VPS

Any Ubuntu 22.04 server works. **Minimum specs:** 1 vCPU / 1 GB RAM / 20 GB disk.

| Provider | Price | Specs | Notes |
|---|---|---|---|
| [Contabo VPS S](https://contabo.com) | ~$6/mo | 4 vCPU · 6 GB RAM | Best value, EU/US locations |
| [DigitalOcean](https://www.digitalocean.com) | ~$6/mo | 1 vCPU · 1 GB RAM | Easy UI, great docs |
| [Hetzner CX21](https://www.hetzner.com) | ~€4/mo | 2 vCPU · 4 GB RAM | Best price/performance in EU |
| [Vultr](https://www.vultr.com) | ~$6/mo | 1 vCPU · 1 GB RAM | Many datacenter locations |

!!! tip "Pick the right region"
    Choose a datacenter closest to your exchange. Binance infrastructure is primarily in Asia — EU and Southeast Asia datacenters give the lowest latency.

---

## Step 4 — Install Xplitrade on the VPS

SSH into your VPS as root or a sudo user, then run the following in order.

**1. Install system dependencies:**

```bash
sudo apt update && sudo apt install -y \
  python3.11 python3.11-venv python3.11-dev \
  build-essential git libta-lib0-dev
```

**2. Clone and install Xplitrade:**

```bash
cd ~
git clone https://github.com/tboye/xplitrade.git
cd xplitrade
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e .
```

**3. Copy your strategy and config from your local machine:**

```bash
# Run this on your LOCAL machine (Windows / Mac)
scp user_data/strategies/XplitradeProStrategy.py \
    root@YOUR_VPS_IP:~/xplitrade/user_data/strategies/

scp user_data/config.json \
    root@YOUR_VPS_IP:~/xplitrade/user_data/
```

**4. Test that it starts correctly:**

```bash
cd ~/xplitrade
source .venv/bin/activate
xplitrade trade -c user_data/config.json
# Press Ctrl+C after you see "Bot heartbeat" to confirm it works
```

---

## Step 5 — Run 24/7 with systemd

systemd ensures the bot starts automatically on reboot and restarts if it crashes.

**1. Install the service file:**

```bash
mkdir -p ~/.config/systemd/user
cp ~/xplitrade/xplitrade.service ~/.config/systemd/user/
systemctl --user daemon-reload
```

**2. Enable and start:**

```bash
systemctl --user enable xplitrade
systemctl --user start xplitrade
```

**3. Check status and follow live logs:**

```bash
# Live status
systemctl --user status xplitrade

# Follow live logs
journalctl --user -u xplitrade -f

# Last 100 lines
journalctl --user -u xplitrade -n 100
```

**4. Keep running after SSH logout (required once):**

```bash
sudo loginctl enable-linger $USER
```

---

## Step 6 — Go Live

!!! danger "Paper trade first"
    Run in dry_run for **at least 3 days** before going live. Watch the Telegram notifications — if any trades look wrong, fix the strategy before risking real money.

Make exactly one change in `config.json` on the VPS:

```bash
nano ~/xplitrade/user_data/config.json
# Change:  "dry_run": true  →  "dry_run": false
# Ctrl+O to save, Ctrl+X to exit
```

Restart the bot to apply:

```bash
systemctl --user restart xplitrade
journalctl --user -u xplitrade -f
# You should see: "DRY RUN is DISABLED" in the logs
```

With default config settings the bot will deploy a maximum of **500 USDT** (100 USDT × 5 open positions).

---

## Step 7 — External Signal Webhook (optional)

Xplitrade has a built-in signal webhook endpoint. Any script, alert service, or app can trigger a buy or sell by sending a POST request — no external API required.

**Enable it in `config.json`:**

```json
"webhook_signal": {
    "enabled": true,
    "secret": "CHANGE_THIS_TO_A_RANDOM_SECRET"
}
```

**Send a buy signal:**

```bash
curl -X POST http://YOUR_VPS_IP:8080/api/v1/webhook/signal \
  -H "Content-Type: application/json" \
  -H "X-Xplitrade-Token: CHANGE_THIS_TO_A_RANDOM_SECRET" \
  -d '{"action": "buy", "pair": "BTC/USDT", "tag": "my_signal"}'
```

**Send a sell signal:**

```bash
curl -X POST http://YOUR_VPS_IP:8080/api/v1/webhook/signal \
  -H "Content-Type: application/json" \
  -H "X-Xplitrade-Token: CHANGE_THIS_TO_A_RANDOM_SECRET" \
  -d '{"action": "sell", "pair": "BTC/USDT"}'
```

**Close all open positions (emergency):**

```bash
curl -X POST http://YOUR_VPS_IP:8080/api/v1/webhook/signal \
  -H "Content-Type: application/json" \
  -H "X-Xplitrade-Token: CHANGE_THIS_TO_A_RANDOM_SECRET" \
  -d '{"action": "close_all"}'
```

### Payload reference

| Field | Type | Required | Description |
|---|---|---|---|
| `action` | `"buy"` \| `"sell"` \| `"close_all"` | Yes | What to do |
| `pair` | string e.g. `"BTC/USDT"` | For buy/sell | Trading pair |
| `stake_amount` | float | No | USDT amount (defaults to config stake_amount) |
| `price` | float | No | Limit price (null = market order) |
| `tag` | string | No | Label shown in trade history |

!!! warning "Security"
    Use a strong random secret (32+ characters). If the API server listens on a public IP, also consider putting it behind an nginx reverse proxy with TLS.
