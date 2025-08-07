# Hong Kong Restaurant Database

A public, login-free web application that lists every licensed General Restaurant in Hong Kong. The app highlights new entries and allows users to filter by district, name, and licence-expiry date.

## Features

- 📋 Complete list of licensed general restaurants in Hong Kong (~12,545 records)
- 🆕 Highlights new restaurants (added within last 30 days)
- 🔍 Search by restaurant name (fuzzy search)
- 📍 Filter by district
- 📅 Sort by licence expiry date or newest entries
- 🔄 Weekly automatic updates via cron job
- 📱 Fully responsive design

## Tech Stack

- **Backend**: Node.js + TypeScript + Fastify
- **Frontend**: React 18 + Vite + TailwindCSS + TanStack Table
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Render (with Blueprint)
- **Data Source**: Hong Kong FEHD licensing database

## Prerequisites

- Node.js 18+ and npm/pnpm
- Supabase account and project
- Render account (for deployment)
- Git with SSH key configured

## Database Setup

Create the following tables in your Supabase project:

```sql
-- Restaurants table
CREATE TABLE restaurants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT,
  address TEXT,
  licence_no TEXT UNIQUE,
  licence_type TEXT,
  valid_til DATE,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  new_flag BOOLEAN DEFAULT TRUE
);

-- System status table
CREATE TABLE system (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_restaurants_district ON restaurants(district);
CREATE INDEX idx_restaurants_new_flag ON restaurants(new_flag);
CREATE INDEX idx_restaurants_valid_til ON restaurants(valid_til);
CREATE INDEX idx_restaurants_name ON restaurants(name);
```

## Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd new-restaurant-database-hk
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Supabase credentials:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_anon_key
   PORT=3000
   NODE_ENV=development
   ```

4. **Run the development servers**
   
   Backend (Terminal 1):
   ```bash
   npm run dev
   ```
   
   Frontend (Terminal 2):
   ```bash
   cd client && npm run dev
   ```

5. **Initial data seeding**
   
   Preview mode (first 1,000 records):
   ```bash
   npm run crawl:init
   ```
   
   Or via API:
   ```bash
   curl -X POST http://localhost:3000/jobs/crawl
   ```

## Deployment to Render

### One-Click Deploy

1. Fork this repository to your GitHub account
2. Connect your GitHub account to Render
3. Click "New" → "Blueprint" in Render dashboard
4. Select this repository
5. Add environment variables:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_KEY`: Your Supabase anon key
6. Deploy!

### Manual Deploy

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Use these settings:
   - Build Command: `npm install && npm run build && cd client && npm install && npm run build`
   - Start Command: `npm start`
   - Environment: Node
   - Add environment variables (SUPABASE_URL, SUPABASE_KEY)

### Post-Deployment Setup

1. **Initial preview crawl** (first 1,000 records):
   ```bash
   curl -X POST https://your-app.onrender.com/jobs/crawl
   ```

2. **Verify the data** in your app

3. **Full crawl** (remaining ~11,545 records):
   ```bash
   curl -X POST https://your-app.onrender.com/jobs/crawl?full=true
   ```

4. **Set up the cron job** (automatic weekly updates):
   - The cron job will automatically run every Monday at 02:00 HKT
   - It only runs after the system status is "seeded"

## API Endpoints

### Public Endpoints

- `GET /api/restaurants` - Get restaurants with filtering
  - Query params: `district`, `search`, `sort`, `limit`, `offset`
- `GET /api/districts` - Get list of all districts
- `GET /health` - Health check endpoint

### Admin Endpoints

- `POST /jobs/crawl` - Run crawler in preview mode (1,000 records)
- `POST /jobs/crawl?full=true` - Run full crawler (all records)
- `GET /jobs/status` - Check crawler status

## Project Structure

```
.
├── src/                    # Backend source code
│   ├── index.ts           # Main server file
│   ├── lib/               # Database connection
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── scripts/           # Utility scripts
│   └── utils/             # Helper functions
├── client/                # Frontend React app
│   ├── src/
│   │   ├── api/          # API client
│   │   ├── components/   # React components
│   │   └── types/        # TypeScript types
│   └── vite.config.ts    # Vite configuration
├── render.yaml           # Render Blueprint config
├── cron-job.yaml        # Cron job configuration
└── package.json         # Project dependencies
```

## Scripts

- `npm run dev` - Start backend dev server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript compiler check
- `npm run crawl:init` - Run initial data crawl

## License

ISC

## Contributing

Pull requests are welcome! Please ensure:
- Code passes TypeScript strict mode
- ESLint checks pass
- Prettier formatting is applied
- No console.log statements in production code