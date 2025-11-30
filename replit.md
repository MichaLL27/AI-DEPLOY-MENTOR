# AI Deploy Mentor

A modern deployment management platform that helps transform AI-generated or low-code projects into production-ready deployments.

## Overview

AI Deploy Mentor provides a streamlined workflow for:
1. Registering projects from various sources (GitHub, Replit, ZIP files)
2. Running automated QA checks
3. Deploying projects to production with one click

## Architecture

### Frontend (React + TypeScript)
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side navigation

### Backend (Express + TypeScript)
- **Server**: Express.js with TypeScript
- **Storage**: In-memory storage (MemStorage) for MVP
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
- `server/storage.ts` - In-memory project storage
- `server/services/qaService.ts` - QA simulation logic
- `server/services/deployService.ts` - Deployment simulation logic

### Shared
- `shared/schema.ts` - TypeScript types and Zod schemas

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get project by ID |
| POST | `/api/projects` | Create new project |
| POST | `/api/projects/:id/run-qa` | Run QA checks |
| POST | `/api/projects/:id/deploy` | Deploy project |
| DELETE | `/api/projects/:id` | Delete project |

## Project Status Flow

```
registered → qa_running → qa_passed → deploying → deployed
                ↓                         ↓
            qa_failed               deploy_failed
```

## Design Guidelines

The application follows a Linear/Vercel-inspired developer tool aesthetic:
- Clean, minimal UI with focus on information density
- Inter font for readability
- JetBrains Mono for code/technical content
- Blue primary color (hsl 217 91% 48%)
- Dark mode support
- Responsive design for mobile and desktop

## Future Integrations

The service architecture is designed for easy integration with:
- **OpenAI API**: For AI-powered QA analysis (qaService.ts)
- **Vercel API**: For frontend deployments (deployService.ts)
- **Render API**: For backend services (deployService.ts)

## Running the Application

The application runs on port 5000 with both frontend and backend served from the same Express server.

```bash
npm run dev
```
