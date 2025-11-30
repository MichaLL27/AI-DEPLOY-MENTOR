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

## Android Wrapper Generation

AI Deploy Mentor can generate a minimal Android Studio project that wraps your deployed web app in a WebView.

### How it works

1. Deploy your project to get a live URL
2. Click **"Generate Android App"** on the project detail page
3. The app generates an Android Studio project structure
4. Download the ZIP file containing the Android project
5. Open it in Android Studio
6. Customize package name and app signing
7. Build and upload to Google Play Store

### Generated Android Project Structure

The generated project includes:

- Complete Android project with Gradle build system
- MainActivity with WebView loading your deployed URL
- AndroidManifest.xml with internet permissions
- Layout files with WebView configuration
- Build configurations for Android API 24+

### Customization Steps

1. **Change Package Name**: Edit `build.gradle` in the app folder
2. **Add App Icon**: Replace `res/mipmap/ic_launcher.png`
3. **Sign for Release**: Generate a keystore and configure signing in Gradle
4. **Configure Permissions**: Modify `AndroidManifest.xml` if needed
5. **Build APK/AAB**: Use Android Studio's build menu

The WebView:
- Has JavaScript enabled for full web functionality
- Supports DOM storage and databases
- Is configured for modern web applications

### Android Deployment

After building:

1. Generate a signed APK or App Bundle (AAB)
2. Test on emulator or device
3. Upload to Google Play Store or other app stores
4. Users can now install your web app as a native Android app

For detailed Android Studio documentation, visit: https://developer.android.com/studio

## iOS Wrapper Generation

AI Deploy Mentor can generate a minimal Xcode project that wraps your deployed web app in a WKWebView.

### How it works

1. Deploy your project to get a live URL
2. Click **"Generate iOS App"** on the project detail page
3. The app generates an Xcode project structure
4. Download the ZIP file containing the iOS project
5. Open it in Xcode on a Mac
6. Configure your Apple Developer account and signing
7. Build and upload to App Store Connect / TestFlight

### Generated iOS Project Structure

The generated project includes:

- Complete Xcode project with Swift source files
- WKWebView configured to load your deployed URL
- AppDelegate and SceneDelegate for app lifecycle
- Info.plist with proper configuration
- Main.storyboard for UI layout
- Support for iOS 13.0 and later

### Customization Steps

1. **Change Bundle Identifier**: Update in Xcode project settings
2. **Add App Icon**: Replace in Assets.xcassets
3. **Configure Code Signing**: Set your development team
4. **Customize Display Name**: Edit Info.plist
5. **Test on Device/Simulator**: Build and run in Xcode

The WKWebView:
- Supports JavaScript for full web functionality
- Allows inline media playback
- Loads your deployed URL on app launch

### App Store Submission

After customization:

1. Select "Generic iOS Device" as the target
2. Product → Archive
3. Distribute App → App Store Connect
4. Upload to TestFlight or App Store
5. Users can install your web app as a native iOS app

**Note**: You must have an Apple Developer account and code signing certificates configured.

For detailed Xcode documentation, visit: https://developer.apple.com/xcode/
