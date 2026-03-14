# HBL Deals & Discounts

Scrape, browse, and get notified about HBL credit card deals and discounts.

**Defaults:** Islamabad + HBL Platinum CreditCard (configurable via CLI flags).

## Features

- **On-demand scraping** — Two modes: fast (API-only, seconds) or full (browser + per-deal details)
- **Beautiful web dashboard** — Next.js + TailwindCSS site with search, day filters, grid/table views, and stats
- **CSV export** — Export deals to spreadsheet format
- **Email notifications** — Receive deal summaries via email (SMTP/Gmail)
- **WhatsApp notifications** — Receive deal summaries on WhatsApp (Twilio)
- **Private config** — All credentials (email, phone, API keys) stay in `.env` (gitignored)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config (for notifications — optional)
cp .env.example .env
# Edit .env with your email/WhatsApp credentials

# 3. Scrape deals (fast mode — API only, ~3 seconds)
npm run scrape:fast

# 4. Start the web dashboard
npm run dev
# Open http://localhost:3000
```

## Commands

| Command | Description |
|---|---|
| `npm run scrape:fast` | Fast scrape via API (merchant + discount %, ~3 sec) |
| `npm run scrape` | Full scrape with browser (adds valid days + max cap per merchant) |
| `npm run scrape:headed` | Full scrape with visible browser + debug screenshots |
| `npm run scrape:csv` | Fast scrape + export to CSV |
| `npm run scrape:notify` | Fast scrape + send email/WhatsApp notifications |
| `npm run notify` | Send notifications from existing data (no scraping) |
| `npm run dev` | Start the web dashboard at http://localhost:3000 |

### Custom City/Card

```bash
node scripts/run.js --fast --city "Lahore" --card "HBL FuelSaver CreditCard"
node scripts/run.js --fast --city "Karachi" --card "HBL GreenCard" --notify --csv
```

## Setup Notifications

### Email (Gmail)

1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Generate an app password for "Mail"
3. Add to `.env`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   EMAIL_TO=your-email@gmail.com
   ```

### WhatsApp (Twilio)

1. Sign up at [Twilio](https://www.twilio.com)
2. Set up [WhatsApp Sandbox](https://www.twilio.com/docs/whatsapp/sandbox)
3. Add to `.env`:
   ```
   TWILIO_ACCOUNT_SID=your-sid
   TWILIO_AUTH_TOKEN=your-token
   WHATSAPP_TO=+923001234567
   ```

## Project Structure

```
├── scripts/
│   ├── scrape.js      # Peekaboo API + Puppeteer scraper
│   ├── notify.js      # Email + WhatsApp notifications
│   └── run.js         # Orchestrator (scrape + notify + csv)
├── data/
│   └── deals.json     # Scraped deals (auto-generated)
├── src/
│   ├── app/           # Next.js pages & API routes
│   ├── components/    # React components (DealsTable, DealCard, FilterBar)
│   └── lib/           # Types + server utils
├── .env.example       # Environment template (safe to commit)
├── .env               # Your private config (gitignored)
└── package.json
```

## How the Scraper Works

The HBL deals page embeds an iframe from **Peekaboo.guru** which serves the actual deal data.

**Fast mode (`--fast`):** Calls the Peekaboo REST API directly to get all merchants with their max discount % in ~3 seconds. No browser needed.

**Full mode (default):** Uses Puppeteer with your system Chrome to:
1. Navigate the Peekaboo widget at `hbl-web.peekaboo.guru`
2. Select city (Islamabad) and card type (HBL Platinum CreditCard)
3. Load all merchants, then click each one to extract deal details (valid days, max cap)
4. Save everything to `data/deals.json`

## Tech Stack

- **Next.js 16** — React framework
- **TailwindCSS 4** — Styling
- **Puppeteer Core** — Browser automation (uses system Chrome, no download needed)
- **Peekaboo REST API** — Fast deal data retrieval
- **Nodemailer** — Email notifications
- **Twilio** — WhatsApp notifications
