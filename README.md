# CyNews

**Cybersecurity Threat Intelligence & News Aggregation Platform**

A real-time cybersecurity threat intelligence dashboard that aggregates news, advisories, and threat data from 50+ sources. Built with a dark, professional SOC-style interface.

---

## Features

- **Real-time Dashboard** - Threat overview with threat level gauge, stats cards, severity distribution charts, and live activity stream
- **50+ Feed Sources** - Aggregates from The Hacker News, BleepingComputer, Dark Reading, Krebs on Security, SANS ISC, CISA KEV, and dozens more
- **CERT-In Advisories** - Dedicated page for Indian CERT advisories with severity filtering
- **Threat Intelligence** - Threat actor profiles, TTPs (MITRE ATT&CK), IOCs, malware families, and campaign tracking
- **CVE Advisories** - CVSS scores, affected products, vendor info, patch status, and workarounds
- **India Scope Detection** - AI-powered classification of India-related threats vs. global threats with state/sector detection
- **Cyber Relevance Filtering** - Automatically filters non-cybersecurity content from feeds
- **Export & Email** - Export advisories as HTML/CSV, generate email reports with customizable templates
- **WebSocket Live Updates** - Real-time push notifications when new threats arrive
- **RSS Feed Output** - `/api/news/rss` endpoint for integration with other tools
- **Multi-workspace Support** - Product-based threat matching across workspaces
- **Global Search** - Search across all news, threats, and advisories simultaneously

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 7, TypeScript 5.9 |
| **Styling** | Tailwind CSS v4, Radix UI, Framer Motion |
| **State** | TanStack React Query, Zustand |
| **Backend** | Express 5, Node.js 24 |
| **Database** | PostgreSQL, Drizzle ORM |
| **Validation** | Zod v4, drizzle-zod |
| **API Codegen** | Orval (from OpenAPI spec) |
| **Routing** | Wouter |
| **Security** | Helmet, express-rate-limit, CORS, input sanitization |
| **Monorepo** | pnpm workspaces |

## Project Structure

```
CyNews/
├── artifacts/
│   ├── api-server/          # Express API server (port 8080)
│   └── cyfy-news/           # React + Vite frontend
├── lib/
│   ├── api-spec/            # OpenAPI spec + Orval codegen
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod schemas
│   ├── db/                  # Drizzle ORM schema + connection
│   ├── feed-aggregator/     # RSS/API feed fetcher
│   ├── india-detector/      # India scope classifier
│   └── cyber-relevance-detector/  # Cyber content filter
├── scripts/                 # Seed, reclassify, live-feed CLI
├── docker-compose.yml
├── Dockerfile
└── pnpm-workspace.yaml
```

## Quick Start

### Prerequisites
- [Node.js 24+](https://nodejs.org/)
- [pnpm 9+](https://pnpm.io/installation)
- [Docker](https://docs.docker.com/get-docker/) (for PostgreSQL)

### One-Command Setup

```bash
git clone https://github.com/Demos6668/CyNews.git
cd CyNews
cp .env.example .env
pnpm run setup
pnpm dev
```

This installs dependencies, starts PostgreSQL in Docker, pushes the database schema, and launches both the API server (`:8080`) and frontend (`:5173`).

### Manual Setup (Step by Step)

```bash
# 1. Clone and install
git clone https://github.com/Demos6668/CyNews.git
cd CyNews
pnpm install

# 2. Configure environment
cp .env.example .env
# Defaults work out-of-the-box — edit only if needed

# 3. Start PostgreSQL
pnpm run db:up

# 4. Push database schema
pnpm run db:push:force

# 5. (Optional) Seed with demo data
pnpm --filter @workspace/scripts run seed

# 6. Start dev servers (API + frontend)
pnpm dev
```

Open http://localhost:5173 in your browser. The API server runs at http://localhost:8080.

### Docker (Production)

```bash
cp .env.example .env
# Edit POSTGRES_PASSWORD to a strong value for production
docker compose up -d
```

This starts PostgreSQL, builds and runs the API server, and serves the frontend — all in containers.

### Live Feeds

The API server runs the feed scheduler automatically every 15 minutes. To trigger a manual refresh:

```bash
curl -X POST http://localhost:8080/api/scheduler/refresh
```

Or run the standalone feed scripts:

```bash
# One-time fetch from all sources
pnpm --filter @workspace/scripts run live-feed

# Continuous updates every 15 minutes
pnpm --filter @workspace/scripts run live-feed:watch
```

### Troubleshooting

| Problem | Solution |
|---------|----------|
| `database "cynews" does not exist` | Run `pnpm run db:up` first — Docker creates the database automatically |
| `connection refused` on port 5432 | Make sure Docker is running: `docker ps` should show the `cynews-db-1` container |
| Port 5432 already in use | A local PostgreSQL is running — stop it or change the port in `.env` and `docker-compose.yml` |
| Schema push fails | Use `pnpm run db:push:force` for a clean push on a fresh database |
| API returns 500 errors | Check that the database has tables: run `pnpm run db:push:force` |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/healthz` | Health check |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/news` | Paginated news with filters |
| GET | `/api/news/:id` | News item detail |
| GET | `/api/news/rss` | RSS feed output |
| GET | `/api/news/bookmarked` | Bookmarked items |
| POST | `/api/news/:id/bookmark` | Toggle bookmark |
| GET | `/api/advisories` | Paginated advisories |
| GET | `/api/advisories/cert-in` | CERT-In advisories |
| GET | `/api/advisories/:id` | Advisory detail |
| GET | `/api/threats` | Paginated threat intel |
| GET | `/api/threats/:id` | Threat detail |
| GET | `/api/threats/export` | Export as CSV/JSON |
| GET | `/api/search?q=` | Global search |
| GET | `/api/export/templates` | Email templates |
| POST | `/api/export/preview` | Preview email export |
| POST | `/api/export/email` | Generate email export |
| WS | `/ws` | Real-time updates |

## Feed Sources

**News:** The Hacker News, BleepingComputer, Dark Reading, Krebs on Security, SecurityWeek, The Record, CyberScoop, SC Magazine, Infosecurity Magazine, and more

**Threat Intel:** Cisco Talos, Unit 42, Mandiant, Microsoft Security, Google TAG, CrowdStrike, SentinelOne, Recorded Future, Proofpoint, Kaspersky SecureList, and more

**Advisories:** CISA KEV, CERT-In, NVD, US-CERT

**Threat Feeds:** URLhaus, ThreatFox, Ransomware.live, Feodo Tracker

## Key Commands

```bash
pnpm dev                # Start API + frontend dev servers
pnpm run setup          # Full setup (install + DB + schema)
pnpm run db:up          # Start PostgreSQL container
pnpm run db:push        # Push DB schema (interactive)
pnpm run db:push:force  # Push DB schema (no prompts)
pnpm run dev:api        # Start API server only
pnpm run dev:frontend   # Start frontend only
pnpm run typecheck      # Full typecheck
pnpm run build          # Build all packages

# Less common
pnpm --filter @workspace/api-spec run codegen    # Regenerate API types
pnpm --filter @workspace/scripts run seed         # Seed demo data
pnpm --filter @workspace/scripts run live-feed    # Fetch real data
```

## License

MIT
