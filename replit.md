# AI Deploy Mentor

A modern deployment management platform that helps transform AI-generated or low-code projects into production-ready deployments.

## Overview

AI Deploy Mentor provides a streamlined workflow for:
1. Registering projects from various sources (GitHub, Replit, ZIP files)
2. Running AI-powered QA checks using OpenAI GPT-5
3. Deploying projects to production with one click

## Architecture

### Frontend (React + TypeScript)
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side navigation

### Backend (Express + TypeScript)
- **Server**: Express.js with TypeScript
- **Database**: PostgreSQL (Neon-backed) with Drizzle ORM
- **AI Integration**: OpenAI GPT-5 via Replit AI Integrations
- **Services**: Modular service architecture for QA and deployment

## Key Files

### Frontend
- `client/src/App.tsx` - Main app with routing
- `client/src/pages/dashboard.tsx` - Main dashboard with project list
- `client/src/pages/project-detail.tsx` - Project detail view with actions
- `client/src/components/` - Reusable UI components
  - `project-card.tsx` - Project card with actions
  - `project-list.tsx` - Project list container
  - `status-badge.tsx` - Status indicator badges
  - `status-timeline.tsx` - Deployment progress timeline
  - `new-project-dialog.tsx` - Project creation form
  - `theme-toggle.tsx` - Dark/light mode toggle

### Backend
- `server/routes.ts` - API route handlers
- `server/storage.ts` - PostgreSQL database storage with Drizzle ORM
- `server/services/qaService.ts` - AI-powered QA using OpenAI GPT-5
- `server/services/deployService.ts` - Deployment simulation (ready for Vercel/Render API integration)

### Shared
- `shared/schema.ts` - Drizzle schema definitions, TypeScript types, and Zod schemas

## Database Schema

```sql
projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  source_type VARCHAR NOT NULL,  -- 'github', 'replit', 'zip', 'other'
  source_value VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'registered',
  qa_report TEXT,
  deployed_url VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
)
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get project by ID |
| POST | `/api/projects` | Create new project |
| POST | `/api/projects/:id/run-qa` | Run AI-powered QA checks (~15-20s) |
| POST | `/api/projects/:id/deploy` | Deploy project (simulated) |
| DELETE | `/api/projects/:id` | Delete project |

## Project Status Flow

```
registered → qa_running → qa_passed → deploying → deployed
                ↓                         ↓
            qa_failed               deploy_failed
```

## AI-Powered QA

The QA service uses OpenAI GPT-5 (via Replit AI Integrations) to analyze projects:
- Analyzes source URL format and accessibility
- Identifies project type and technology stack
- Detects potential security issues
- Provides deployment recommendations
- Generates structured report with PASS/FAIL verdict

QA reports include:
1. Project Overview
2. Source Analysis
3. Potential Issues & Recommendations
4. Security Considerations
5. Summary & Verdict

## Design Guidelines

The application follows a Linear/Vercel-inspired developer tool aesthetic:
- Clean, minimal UI with focus on information density
- Inter font for readability
- JetBrains Mono for code/technical content
- Blue primary color (hsl 217 91% 48%)
- Dark mode support
- Responsive design for mobile and desktop

## Environment Variables

Required (automatically configured by Replit):
- `DATABASE_URL` - PostgreSQL connection string
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key (via Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL

Optional (for real deployments):
- `VERCEL_TOKEN` - Vercel API access token
- `RENDER_API_KEY` - Render API key

## Future Integrations

The service architecture is designed for easy integration with:
- **Vercel API**: For frontend deployments (deployService.ts ready for integration)
- **Render API**: For backend services (deployService.ts ready for integration)
- **Webhook callbacks**: For deployment status notifications

## Running the Application

The application runs on port 5000 with both frontend and backend served from the same Express server.

```bash
npm run dev
```

Database migrations:
```bash
npm run db:push
```
