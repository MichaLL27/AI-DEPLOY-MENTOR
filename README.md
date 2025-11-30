# AI Deploy Mentor

A service that helps transform AI-generated or low-code projects into production-ready deployments with automated QA checks and one-click deployment.

## Features

- **Project Registration**: Register projects from various sources (GitHub, Replit, ZIP, or other URLs)
- **Automated QA**: AI-powered quality assurance checks using OpenAI GPT-5
- **Real or Simulated Deploy**: Deploy to Render (with API token) or use simulated Vercel-style URLs
- **Status Tracking**: Visual progress timeline showing registration → QA → deployment status
- **Modern Dashboard**: Clean, developer-focused UI built with React and Tailwind CSS
- **External Database**: Uses Neon PostgreSQL for persistent data storage

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **AI**: OpenAI GPT-5 via Replit AI Integrations
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter

## Database Setup (Neon)

AI Deploy Mentor uses an external Neon PostgreSQL database. To set up:

1. **Create a Neon account** at https://neon.tech
2. **Create a new project** in the Neon dashboard
3. **Copy the connection string** (looks like `postgresql://user:password@host.neon.tech/dbname?sslmode=require`)
4. **Set the environment variable** in your Replit app:
   ```
   DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
   ```
5. **Run migrations** to set up tables:
   ```bash
   npm run db:push
   ```

The app will automatically create the `projects` table with all required columns on first run.

## Render Deployment Integration (Optional)

To enable real Render deployments instead of simulated URLs:

1. **Get a Render API token** from https://dashboard.render.com/u/settings#api-keys
2. **Set the environment variable**:
   ```
   RENDER_API_TOKEN=your-api-token-here
   ```
3. **When registering a project**, provide your Render Service ID in the Advanced section
4. **Deployments will trigger real Render deploys** via the Render API

Without `RENDER_API_TOKEN` set, deployments will fall back to generating simulated Vercel-style URLs.

## API Endpoints

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Get a single project by ID |
| POST | `/api/projects` | Create a new project |
| DELETE | `/api/projects/:id` | Delete a project |

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/:id/run-qa` | Run AI-powered QA checks on a project |
| POST | `/api/projects/:id/deploy` | Deploy a project to production |
| GET | `/api/projects/:id/deploy-status` | Get deployment status and URL |

## Request/Response Examples

### Create Project (Basic)

```json
POST /api/projects
{
  "name": "My Test App",
  "sourceType": "github",
  "sourceValue": "https://github.com/user/repo"
}
```

### Create Project (With Render Integration)

```json
POST /api/projects
{
  "name": "My Test App",
  "sourceType": "github",
  "sourceValue": "https://github.com/user/repo",
  "renderServiceId": "srv-xxxxxxxxxxxx",
  "renderDashboardUrl": "https://dashboard.render.com/d/srv-xxxxxxxxxxxx"
}
```

### Project Response

```json
{
  "id": "uuid-string",
  "name": "My Test App",
  "sourceType": "github",
  "sourceValue": "https://github.com/user/repo",
  "status": "registered",
  "qaReport": null,
  "deployedUrl": null,
  "renderServiceId": null,
  "renderDashboardUrl": null,
  "lastDeployId": null,
  "lastDeployStatus": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Project Status Flow

```
registered → qa_running → qa_passed → deploying → deployed
                ↓                         ↓
            qa_failed               deploy_failed
```

## Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
AI_INTEGRATIONS_OPENAI_API_KEY=auto-configured-by-replit
AI_INTEGRATIONS_OPENAI_BASE_URL=auto-configured-by-replit

# Optional (for real Render deployments)
RENDER_API_TOKEN=your-render-api-token
RENDER_BASE_URL=https://api.render.com/v1  # defaults if not set
```

## Development

```bash
# Install dependencies
npm install

# Run database migrations
npm run db:push

# Start development server
npm run dev
```

Open http://localhost:5000 in your browser.

## Deployment Flow

1. **Register** a project with source URL
2. **Run QA** to analyze code quality with AI
3. **Deploy** to production:
   - If `RENDER_API_TOKEN` and `renderServiceId` are set: triggers real Render deploy
   - Otherwise: generates simulated Vercel-style URL
4. **Monitor** deployment status and access live URL

## Architecture Notes

- **Frontend**: Wouter for routing, TanStack Query for server state, shadcn/ui for components
- **Backend**: Express with TypeScript, modular service architecture
- **Database**: Drizzle ORM with automatic schema migrations
- **AI**: OpenAI GPT-5 for code analysis via Replit AI Integrations

All API communication is RESTful with JSON payloads.
