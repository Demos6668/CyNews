# CYFY News Board

## Overview

CYFY News Board is an internal cybersecurity threat intelligence, advisories, and news aggregation platform. It features a dark SOC-style interface with two main segments: Local and Global threats/news.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/cyfy-news)
- **Styling**: Tailwind CSS v4 with custom dark theme
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **UI Libraries**: Lucide React (icons), Framer Motion (animations), Recharts (charts), date-fns

## Color Palette

- Primary teal: #0095AF
- Accent amber: #FFB74B
- Dark navy: #1A2332
- Background dark: #0D1117
- Card background: #161B22
- Danger red: #F85149
- Warning yellow: #F0C000
- Success green: #3FB950

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   └── cyfy-news/          # React + Vite frontend (served at /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (seed, etc.)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Tables

- `news_items` - Threat intelligence, news, and advisory items with severity, scope (local/global), category, IOCs, mitigations, bookmarks
- `advisories` - CVE advisories with CVSS scores, affected products, vendor info, patch status, workarounds

## API Endpoints

- `GET /api/healthz` - Health check
- `GET /api/dashboard/stats` - Dashboard statistics (threat counts, threat level, recent activity)
- `GET /api/news` - Paginated news list with filters (scope, severity, category, type, status)
- `GET /api/news/:id` - News item detail
- `GET /api/news/bookmarked` - Bookmarked items
- `POST /api/news/:id/bookmark` - Toggle bookmark
- `GET /api/advisories` - Paginated advisories with filters (severity, vendor, status)
- `GET /api/advisories/:id` - Advisory detail
- `GET /api/threats` - Paginated threat intelligence items with filters (scope, severity, category, status)
- `GET /api/threats/:id` - Threat detail
- `GET /api/threats/export` - Export threats as CSV (with CSV injection protection)
- `GET /api/search?q=` - Global search across news and advisories

## Frontend Pages

- Dashboard (`/`) - SOC overview with threat gauge, stats, recent activity, threat distribution chart
- Local News (`/news/local`) - Local-scope news with severity filters and Local/Global toggle
- Global News (`/news/global`) - Global-scope news with geographic tags
- Advisories (`/advisories`) - CVE advisories with CVSS scores and patch status
- Threat Intel (`/threat-intel`) - Threat reports, IOCs, campaign tracking, export functionality
- Search (`/search`) - Global search results
- Settings (`/settings`) - Placeholder settings page

## Key Commands

- `pnpm --filter @workspace/api-spec run codegen` - Regenerate API hooks/schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` - Push DB schema changes
- `pnpm --filter @workspace/scripts run seed` - Seed database with sample data
- `pnpm run typecheck` - Full typecheck across all packages
