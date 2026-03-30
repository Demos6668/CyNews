# CyNews

**Cybersecurity Threat Intelligence & News Aggregation Platform**

A real-time SOC (Security Operations Center) dashboard that aggregates cybersecurity news, threat intelligence, and advisories from 50+ sources. Built with a dark, professional SOC-style interface.

---

## Features

- **Real-time Dashboard** - SOC overview with threat level gauge, stats cards, severity distribution charts, and live activity stream
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
- Node.js 24+
- pnpm 9+
- PostgreSQL 15+

### Setup

```bash
# Clone the repository
git clone https://github.com/Demos6668/CyNews.git
cd CyNews

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# Push database schema
pnpm --filter @workspace/db run push

# Seed with demo data
pnpm --filter @workspace/scripts run seed

# Start development servers
pnpm --filter @workspace/api-server run dev    # API on :8080
pnpm --filter @workspace/cyfy-news run dev     # Frontend on :5173
```

### Docker

```bash
docker compose up -d
```

This starts PostgreSQL, the API server, and serves the built frontend.

### Live Feeds

```bash
# One-time fetch from all sources
pnpm --filter @workspace/scripts run live-feed

# Continuous updates every 15 minutes
pnpm --filter @workspace/scripts run live-feed:watch
```

The API server also runs the feed scheduler automatically (every 15 min).

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
pnpm --filter @workspace/api-spec run codegen    # Regenerate API types
pnpm --filter @workspace/db run push              # Push DB schema
pnpm --filter @workspace/scripts run seed         # Seed demo data
pnpm --filter @workspace/scripts run live-feed    # Fetch real data
pnpm run typecheck                                # Full typecheck
pnpm run build                                    # Build all packages
```

## License

MIT
