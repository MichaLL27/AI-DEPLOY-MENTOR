# AI Deploy Mentor

A service that helps transform AI-generated or low-code projects into production-ready deployments with automated QA checks and one-click deployment.

## Features

- **Project Registration**: Register projects from various sources (GitHub, Replit, ZIP, or other URLs)
- **Automated QA**: Run quality assurance checks on your projects before deployment
- **One-Click Deploy**: Deploy your projects to production with simulated Vercel/Render integration
- **Status Tracking**: Visual progress timeline showing registration → QA → deployment status
- **Modern Dashboard**: Clean, developer-focused UI built with React and Tailwind CSS

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter

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
| POST | `/api/projects/:id/run-qa` | Run QA checks on a project |
| POST | `/api/projects/:id/deploy` | Deploy a project to production |

## Request/Response Examples

### Create Project

```json
POST /api/projects
{
  "name": "My Test App",
  "sourceType": "github",
  "sourceValue": "https://github.com/user/repo"
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

## Development

The project uses in-memory storage for MVP. Future integrations planned:

- **QA Service**: OpenAI API for AI-powered code analysis
- **Deploy Service**: Vercel and Render APIs for real deployments
- **Storage**: PostgreSQL for persistent data

## Environment Variables

```env
PORT=5000
OPENAI_API_KEY=your-openai-key-here
VERCEL_TOKEN=your-vercel-token-here
RENDER_TOKEN=your-render-token-here
```

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Open http://localhost:5000 in your browser
