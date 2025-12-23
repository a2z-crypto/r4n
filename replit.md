# r4n - Cron Job Management Platform

## Overview

A full-stack web application for managing and monitoring scheduled cron jobs. The platform allows users to create, schedule, and monitor automated tasks that can make HTTP requests, trigger webhooks, or execute scripts on configurable schedules. Built with a modern React frontend and Express backend, featuring real-time job status tracking and execution history.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming (light/dark mode support)
- **Build Tool**: Vite with hot module replacement

The frontend follows a page-based structure with reusable components. Key pages include Dashboard, Jobs management, History, Templates, and Settings. The design system draws from Linear's UI patterns with a focus on information density and clear status indicators.

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Design**: RESTful JSON API under `/api` prefix
- **Authentication**: Replit Auth (OpenID Connect) via `server/replitAuth.ts`
- **Scheduling**: node-cron for job scheduling
- **Storage**: PostgreSQL via Drizzle ORM with interface abstraction (IStorage)

The server uses a modular structure with separate files for routes, storage, and static file serving. In development, Vite middleware handles the frontend; in production, pre-built static files are served.

### Authentication & Authorization
- **Authentication**: Replit Auth (OIDC) - users sign in via `/api/login`
- **Session Storage**: PostgreSQL via connect-pg-simple (7-day TTL)
- **Authorization**: Role-based access control (RBAC) with granular permissions
- **Roles**: admin, editor, viewer - each with predefined permission sets
- **First User**: New users are created automatically on first login; an admin must assign roles to grant permissions

### Data Models
Defined in `shared/schema.ts` using Zod for validation:
- **Jobs**: Scheduled tasks with cron expressions and action configurations
- **ExecutionLogs**: Historical record of job runs with status, duration, and output
- **Stats**: Aggregated metrics for dashboard display

Job actions support three types:
- HTTP requests (configurable method, headers, body)
- Webhooks (URL + payload)
- Scripts (JavaScript code execution)

### Database Configuration
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema Location**: `shared/schema.ts`
- **Migrations**: Output to `./migrations` directory
- **Connection**: Requires `DATABASE_URL` environment variable

Note: The current implementation uses PostgreSQL for persistent storage with full Drizzle ORM integration.

### Workflow System
The platform includes a workflow feature for chaining multiple jobs together:
- **Workflows**: Multi-step automated processes that chain HTTP requests, webhooks, or scripts
- **Variable Substitution**: Use `{{variableName}}` syntax to pass data between steps
- **Step Execution**: Each step creates its own execution log for auditability
- **Output Mapping**: Steps can store their output in named variables for use by subsequent steps

API endpoints:
- `GET/POST /api/workflows` - List and create workflows
- `GET/PATCH/DELETE /api/workflows/:id` - Manage individual workflows
- `POST /api/workflows/:id/run` - Execute a workflow manually
- `GET /api/workflow-executions` - List workflow execution history

### Campaign Management System
The platform includes a comprehensive campaign system for orchestrating multi-stage notification campaigns:
- **Campaigns**: Multi-step notification sequences with audience targeting
- **Schedule Types**: One-time, recurring (cron), or manual triggers
- **Audiences**: Static user lists, dynamic filters, or all users
- **Campaign Steps**: Sequential notifications with configurable delays
- **Throttling**: Rate limiting for email delivery (limit/interval)
- **Analytics**: Delivery rates, run history, and audience statistics

Campaign tables:
- **campaigns**: Campaign metadata, schedule, and throttle settings
- **campaign_audiences**: Target audience definitions per campaign
- **campaign_steps**: Notification steps with templates or custom content
- **campaign_runs**: Execution history with status tracking
- **campaign_recipients**: Per-recipient delivery status within runs

API endpoints:
- `GET/POST /api/campaigns` - List and create campaigns
- `GET/PATCH/DELETE /api/campaigns/:id` - Manage individual campaigns
- `POST /api/campaigns/:id/launch` - Start a campaign
- `POST /api/campaigns/:id/pause` - Pause a running campaign
- `GET/POST /api/campaigns/:id/audiences` - Manage campaign audiences
- `GET/POST /api/campaigns/:id/steps` - Manage campaign steps
- `GET /api/campaigns/:id/runs` - List campaign execution history
- `GET /api/campaign-runs/:id/recipients` - List recipients for a run

Permissions: campaigns:read, campaigns:create, campaigns:edit, campaigns:delete, campaigns:send

### Deeplink Management System
The platform includes a deeplink system for creating and tracking short URLs:
- **Short Links**: Create branded short URLs with custom codes
- **Custom Domains**: Map your own domains (e.g., link.yoursite.com) with DNS verification
- **Password Protection**: Optionally require password to access links
- **Expiration Dates**: Set links to expire after a specific date
- **Click Analytics**: Track total/unique clicks, devices, browsers, OS, and countries
- **Visitor Tracking**: Identify unique visitors via fingerprinting

Deeplink tables:
- **deeplink_domains**: Custom domains with DNS verification tokens
- **deeplinks**: Short links with destination URLs and metadata
- **deeplink_clicks**: Individual click events with device/geo data

API endpoints:
- `GET/POST /api/deeplinks` - List and create deeplinks
- `GET/PATCH/DELETE /api/deeplinks/:id` - Manage individual deeplinks
- `GET /api/deeplinks/:id/stats` - Get click statistics
- `GET /api/deeplinks/:id/clicks` - List click history
- `GET/POST /api/deeplink-domains` - List and create custom domains
- `DELETE /api/deeplink-domains/:id` - Remove custom domains
- `POST /api/deeplink-domains/:id/verify` - Verify domain ownership
- `POST /api/deeplink-domains/:id/set-primary` - Set primary domain
- `GET /l/:shortCode` - Public redirect endpoint with click tracking

Permissions: Uses jobs:read for access control

### Build System
- **Development**: `tsx` for TypeScript execution with Vite dev server
- **Production Build**: Custom build script using esbuild for server and Vite for client
- **Output**: Server bundle at `dist/index.cjs`, client assets at `dist/public`

## External Dependencies

### Core Runtime
- **PostgreSQL**: Database (via Drizzle ORM and `connect-pg-simple` for sessions)
- **node-cron**: Cron expression parsing and job scheduling

### Frontend Libraries
- **@tanstack/react-query**: Server state management
- **cronstrue**: Human-readable cron expression descriptions
- **date-fns**: Date formatting utilities
- **react-hook-form** + **zod**: Form handling with schema validation

### UI Framework
- **Radix UI**: Accessible component primitives (dialog, dropdown, tabs, etc.)
- **Tailwind CSS**: Utility-first styling
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### Development Tools
- **Vite**: Frontend build and dev server
- **esbuild**: Server bundling for production
- **TypeScript**: Type checking across the codebase
- **drizzle-kit**: Database schema management