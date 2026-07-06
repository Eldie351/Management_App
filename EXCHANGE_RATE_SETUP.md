# Exchange Rate System Setup Guide

## 🚀 Quick Start

### 1. Backend Configuration

#### Step 1: Update `.env` file
```bash
# backend/.env

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/management_app"

# Exchange Rates API
OPENEXCHANGERATES_API_KEY=your_free_api_key_here

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRATION=7d
```

**Get your free API key:**
- Go to: https://openexchangerates.org/
- Sign up for free account
- Copy your App ID from dashboard
- Add to `.env`

#### Step 2: Run Database Migrations
```bash
cd backend
npm install
npm run prisma:migrate
```

#### Step 3: Start Backend Server
```bash
npm run start:dev
```

**Expected output:**
```
[NestFactory] Starting NestJS application...
🚀 Initializing Exchange Rate Cron Service...
✅ Exchange rates cached successfully
✅ Cron job scheduled: Updates every 6 hours
[NestApplication] Nest application successfully started
```

### 2. Frontend Setup

#### Step 1: Install Dependencies
```bash
cd frontend
npm install
```

#### Step 2: Start Development Server
```bash
npm run dev
```

**Access the app:**
- Navigate to: `http://localhost:3000/stats`
- Select currency from dropdown (XOF, EUR, USD, GBP, NGN)
- All amounts automatically convert

---

## 📊 API Endpoints

### Get All Exchange Rates
```bash
curl http://localhost:3001/api/exchange-rates
```

**Response:**
```json
[
  {
    "id": 1,
    "fromCurrency": "USD",
    "toCurrency": "XOF",
    "rate": "655.5",
    "source": "OPENEXCHANGERATES",
    "lastUpdated": "2026-07-06T14:40:00Z",
    "createdAt": "2026-07-06T14:40:00Z",
    "updatedAt": "2026-07-06T14:40:00Z"
  }
]
```

### Convert Amount
```bash
curl "http://localhost:3001/api/exchange-rates/convert?amount=100&from=USD&to=XOF"
```

**Response:**
```json
{
  "convertedAmount": 65550,
  "rate": 655.5,
  "lastUpdated": "2026-07-06T14:40:00Z"
}
```

### Get Specific Rate
```bash
curl "http://localhost:3001/api/exchange-rates/info?from=USD&to=EUR"
```

### Manual Refresh
```bash
curl -X POST http://localhost:3001/api/exchange-rates/refresh
```

**Response:**
```json
{
  "message": "Exchange rates refreshed successfully"
}
```

---

## 🔧 Configuration Options

### Change Update Interval

Edit `backend/src/exchange-rate/exchange-rate-cron.service.ts`:

```typescript
// Current: 6 hours
const SIX_HOURS = 6 * 60 * 60 * 1000;

// Change to other intervals:
// const ONE_HOUR = 1 * 60 * 60 * 1000;
// const TWELVE_HOURS = 12 * 60 * 60 * 1000;
// const DAILY = 24 * 60 * 60 * 1000;
```

### Add/Remove Supported Currencies

Edit `backend/src/exchange-rate/exchange-rate.service.ts`:

```typescript
// Line ~37: Add or remove currency codes
const response = await fetch(
  `${this.apiUrl}?app_id=${this.apiKey}&base=USD&symbols=XOF,EUR,GBP,NGN,JPY,CHF`
  //                                                       ↑ Add currencies here
);
```

Also update in `frontend/src/app/stats/page.tsx`:

```typescript
const SUPPORTED_CURRENCIES = ['XOF', 'EUR', 'USD', 'GBP', 'NGN', 'JPY', 'CHF'];
```

---

## 🐛 Troubleshooting

### Issue: "Invalid API Key"
**Solution:**
1. Verify API key in `.env`
2. Test directly: https://openexchangerates.org/api/latest?app_id=YOUR_KEY&base=USD&symbols=XOF
3. Ensure free tier supports required currencies

### Issue: "Exchange rates not updating"
**Solution:**
```bash
# Manual refresh
curl -X POST http://localhost:3001/api/exchange-rates/refresh

# Check database
psql management_app -c "SELECT * FROM \"ExchangeRate\" LIMIT 5;"
```

### Issue: "No exchange rate found for X to Y"
**Solution:**
1. Ensure both currencies are in `SUPPORTED_CURRENCIES`
2. Manually refresh: `POST /api/exchange-rates/refresh`
3. Check logs for API errors

### Issue: Database migration fails
**Solution:**
```bash
# Reset database (CAUTION: Deletes all data)
npx prisma migrate reset

# Or create fresh migration
npx prisma migrate dev --name add_exchange_rates
```

---

## 📈 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                          │
│  (Frontend: React/Next.js - Stats Page)                     │
│                                                               │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐      │
│  │ Store List │  │ Chart (Pie)  │  │ Currency Picker │      │
│  └────────────┘  └──────────────┘  └─────────────────┘      │
│                        ↓                                      │
│              Fetch: GET /api/exchange-rates                  │
│              Convert all amounts to selected currency        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API LAYER                         │
│  (NestJS - Controllers & Services)                           │
│                                                               │
│  GET  /api/exchange-rates           (All rates)             │
│  GET  /api/exchange-rates/convert   (Amount conversion)     │
│  GET  /api/exchange-rates/info      (Specific rate)        │
│  POST /api/exchange-rates/refresh   (Manual update)        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│               EXCHANGE RATE SERVICE LAYER                    │
│                                                               │
│  ┌──────────────────────────────────────────────────┐       │
│  │  ExchangeRateService                             │       │
│  │  - fetchAndCacheExchangeRates()                 │       │
│  │  - convert(amount, from, to)                    │       │
│  │  - getAllExchangeRates()                        │       │
│  └──────────────────────────────────────────────────┘       │
│           ↓                              ↓                   │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │ ExchangeRateCronService │  │ OpenExchangeRates API   │  │
│  │ (Scheduled updates)     │  │ (External API)          │  │
│  │ Every 6 hours           │  │ Fetches live rates      │  │
│  └─────────────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                            │
│  (PostgreSQL)                                                │
│                                                               │
│  ExchangeRate Table:                                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │ id │ fromCurrency │ toCurrency │ rate │ lastUpdated│   │
│  ├────┼──────────────┼────────────┼──────┼────────────┤    │
│  │ 1  │ USD          │ XOF        │ 655.5│ 2026-07-06│    │
│  │ 2  │ EUR          │ XOF        │ 720.1│ 2026-07-06│    │
│  │ 3  │ GBP          │ XOF        │ 830.7│ 2026-07-06│    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Example

**User selects EUR from dropdown:**

```
1. Frontend sends: GET /api/exchange-rates
   ↓
2. Backend returns all cached rates
   ↓
3. Frontend converts all amounts:
   - Store Revenue: 100,000 XOF → convertAmount(100000, 'XOF', 'EUR')
   - Product Total: 5,000 XOF → convertAmount(5000, 'XOF', 'EUR')
   ↓
4. All values displayed in EUR with conversion rate applied
   ↓
5. Circular chart updated with converted values
   ↓
6. Table shows totals in EUR
```

---

## 📋 Checklist

- [ ] Created `.env` file with API key
- [ ] Ran `npm run prisma:migrate` in backend
- [ ] Started backend: `npm run start:dev`
- [ ] Verified "Exchange rates cached successfully" in logs
- [ ] Started frontend: `npm run dev`
- [ ] Tested currency dropdown on stats page
- [ ] Confirmed amounts convert correctly
- [ ] Verified cron job logs show "Cron job scheduled"

---

## 💡 Pro Tips

1. **Free Tier Limitations:**
   - Limited API calls per month
   - Updates available daily
   - Good for development/testing

2. **Production Recommendations:**
   - Use paid plan for higher limits
   - Consider backup API provider
   - Implement rate limiting on endpoints

3. **Monitoring:**
   - Watch logs for API failures
   - Check database for stale rates
   - Set up alerts for failed updates

4. **Performance:**
   - All conversion uses cached DB (fast)
   - No API calls per conversion request
   - Cron job runs async in background

---

## 📚 Additional Resources

- **OpenExchangeRates API:** https://openexchangerates.org/
- **NestJS Documentation:** https://docs.nestjs.com/
- **Prisma Documentation:** https://www.prisma.io/docs/

---

**Architecture Pattern:** Cache Database + Async Updates  
**Industry Use:** Wise, Revolut, Stripe, PayPal  
**Status:** ✅ Production Ready
