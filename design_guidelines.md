# AI Deploy Mentor - Design Guidelines

## Design Approach

**Selected Approach:** Design System - Linear/Vercel-inspired developer tool aesthetic

**Rationale:** As a deployment management platform for developers, prioritize clarity, efficiency, and professional polish over decorative elements. Draw inspiration from Linear's typography and Vercel's dashboard layouts.

## Core Design Elements

### Typography
- **Primary Font:** Inter (Google Fonts) - clean, technical readability
- **Headings:** font-semibold to font-bold, tracking-tight
- **Body:** text-base (16px), font-normal, leading-relaxed
- **Code/Technical:** font-mono for project IDs, URLs, status codes
- **Hierarchy:**
  - H1: text-3xl md:text-4xl font-bold
  - H2: text-2xl font-semibold
  - H3: text-xl font-semibold
  - Body: text-base
  - Small/Meta: text-sm text-gray-600

### Layout System
**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16, 24
- Component padding: p-6 or p-8
- Section spacing: space-y-6 or space-y-8
- Card gaps: gap-6
- Container max-width: max-w-7xl mx-auto
- Generous whitespace between major sections: my-12 to my-24

### Component Library

**Navigation:**
- Top navigation bar with logo, main links, user profile/settings
- Fixed header with backdrop-blur for modern depth
- Minimal vertical nav for secondary pages if needed

**Dashboard/Main View:**
- Project list as primary component
- Table layout for desktop (project name, source, status, actions)
- Card layout for mobile responsiveness
- Each project row/card shows: name, source type icon, status badge, timestamp, action buttons

**Status Badges:**
- Pill-shaped badges (rounded-full px-3 py-1)
- Small, uppercase text (text-xs font-medium uppercase tracking-wide)
- Status states: registered, qa_running, qa_passed, deploying, deployed, failed states
- Each status gets semantic visual treatment (positioning, not colors per guidelines)

**Project Cards/Rows:**
- Clean borders (border border-gray-200)
- Hover states: subtle elevation or border emphasis
- Metadata display: source type, creation date, last updated
- Action buttons: "Run QA", "Deploy", "View Details"

**Forms (New Project):**
- Modal or dedicated page for project registration
- Single-column form layout (max-w-lg)
- Input groups with labels above inputs
- Label: text-sm font-medium mb-2
- Input fields: rounded-lg border px-4 py-2.5, focus:ring treatment
- Dropdown for sourceType selection
- Text input for name and sourceValue
- Large primary CTA button: "Register Project"

**Detail View:**
- Split layout for desktop: Project info (left) + QA Report/Deploy info (right)
- Section cards with clear headers
- Code blocks for QA reports (font-mono, bg-gray-50, p-4, rounded-lg)
- Deployment URL as prominent link with copy-to-clipboard icon
- Timeline/status progression indicator

**Buttons:**
- Primary: rounded-lg px-6 py-2.5 font-medium
- Secondary: outlined variant
- Icon buttons: square, rounded-lg, p-2
- Destructive actions: subtle red treatment in border/text

**Empty States:**
- Centered content when no projects exist
- Icon + message + primary CTA ("Create Your First Project")

**Loading States:**
- Skeleton loaders for tables/cards
- Spinner for in-progress QA/deploy operations
- Status badge pulsing animation for "running" states

### Icons
**Library:** Heroicons (via CDN)
- Minimal, consistent icon usage
- Icons for: source types (GitHub, Replit, etc.), status indicators, actions (play, deploy, trash)
- 20px or 24px sizes primarily

### Animations
**Minimal, purposeful only:**
- Smooth status transitions (0.3s ease)
- Skeleton loader shimmer
- Pulse animation for "running" statuses
- No decorative animations

### Accessibility
- Semantic HTML throughout
- ARIA labels for icon-only buttons
- Focus indicators on all interactive elements
- Status communicated via text + visual indicators

## Images
**No hero image needed.** This is a functional dashboard tool - lead directly with the project list/table or empty state prompting project creation.

## Key Design Principles
1. **Information First:** Every pixel serves the workflow
2. **Scannable Data:** Easy to distinguish project status at a glance
3. **Progressive Disclosure:** Details available on demand, not cluttering main view
4. **Professional Polish:** Reflects the production-ready nature of the service
5. **Developer-Friendly:** Familiar patterns from tools developers already use