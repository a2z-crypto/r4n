# Design Guidelines: Cron Job Management Platform

## Design Approach

**Selected Approach**: Design System with Modern Developer Tool Inspiration

Drawing from Linear's exceptional UI patterns and Material Design's data visualization principles, optimized for technical users who value clarity, efficiency, and information density.

**Key Design Principles**:
- Information hierarchy: Critical job status always visible
- Scan-optimized layouts: Quick recognition of job states
- Minimal cognitive load: Clear visual language for success/failure/running states
- Purposeful density: Maximize useful information without clutter

## Typography System

**Font Families** (Google Fonts):
- Primary: Inter (weights: 400, 500, 600, 700)
- Monospace: JetBrains Mono (weights: 400, 500) - for cron expressions, code snippets

**Type Scale**:
- Page titles: text-3xl font-bold (30px)
- Section headers: text-xl font-semibold (20px)
- Card titles: text-base font-semibold (16px)
- Body text: text-sm (14px)
- Metadata/timestamps: text-xs (12px)
- Cron expressions: font-mono text-sm

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 3, 4, 6, 8, 12, and 16
- Micro spacing (between related items): space-y-2, gap-2
- Component padding: p-4, p-6
- Section spacing: space-y-8, mb-12
- Page margins: px-6 md:px-8

**Grid System**:
- Dashboard: 3-column grid on desktop (grid-cols-3), 1-column on mobile
- Job cards: 2-column on tablet (md:grid-cols-2), single column mobile
- Execution history: Full-width table layout

## Application Structure

### Navigation & Header
- Fixed top navigation bar (h-16) with app logo, search bar, and user menu
- Left sidebar (w-64) with navigation: Dashboard, Active Jobs, History, Settings
- Sidebar collapsible on smaller screens

### Main Dashboard Layout
Three-panel layout:
1. **Stats Overview** (top): 4 metric cards showing Total Jobs, Active, Failed (24h), Next Execution
2. **Active Jobs Grid** (center): Card-based grid displaying all scheduled jobs
3. **Recent Activity** (bottom): Compact list of last 10 executions

### Job Card Components
Compact cards (min-h-32) containing:
- Job name (font-semibold, truncate)
- Cron expression in monospace with human-readable translation below
- Status badge (small pill shape, uppercase text-xs)
- Next run time with relative timestamp
- Quick action buttons: Edit, Run Now, Enable/Disable toggle
- Visual indicator: left border (w-1) showing job status

### Workflow Builder Interface
Split view layout:
- **Left Panel** (w-80): Draggable node library organized by category
- **Center Canvas** (flex-1): Infinite canvas for node placement with grid background
- **Right Panel** (w-96): Node configuration form when node selected

**Node Design**:
- Rounded rectangles (rounded-lg) with connection points
- Icon + label layout, compact size (min-w-40)
- Visual connectors: curved lines between nodes
- Selected state: subtle border glow effect

### Execution History View
Table layout with:
- Column headers: Job Name, Status, Start Time, Duration, Actions
- Row height: h-12 for comfortable scanning
- Alternating row backgrounds for readability
- Expandable rows showing full output/error logs
- Filter toolbar above table: Date range, Status filter, Search

### Cron Expression Editor
Split display:
- Visual segment builder (top): Separate inputs for minute, hour, day, month, weekday
- Raw expression input (bottom): Monospace text field with syntax validation
- Live preview: "Next 5 run times" list updating as user edits

## Component Library

### Buttons
- Primary: Solid with rounded-md, font-medium, px-4 py-2
- Secondary: Border with transparent background
- Danger: For delete actions
- Icon buttons: square (w-8 h-8), rounded-md

### Status Badges
Small pills (px-2 py-1, rounded-full, text-xs, font-medium):
- Running: Animated pulse effect
- Success: Static
- Failed: Static
- Paused: Muted treatment

### Form Inputs
- Standard height: h-10
- Rounded corners: rounded-md
- Label above input: text-sm font-medium, mb-2
- Monospace for code/expression inputs

### Modal Overlays
- Centered modal (max-w-2xl) with backdrop blur
- Modal header: sticky with close button
- Modal content: max-h-[80vh] with scroll
- Modal actions: sticky footer with button group

### Data Visualization
- Execution timeline: Horizontal bar chart showing job runs over 24h
- Success rate: Circular progress indicator
- Activity heatmap: Calendar view for historical executions

## Images

**No large hero image** - this is a productivity dashboard focused on functionality.

**Icon Usage**: Use Heroicons (outline style) via CDN throughout the interface for:
- Navigation items
- Action buttons
- Status indicators
- Empty states

**Empty State Illustrations**: Simple SVG illustrations for:
- No jobs created yet
- No execution history
- Search with no results

Each illustration should be centered (max-w-xs mx-auto) with explanatory text below.

## Animations

Minimal, performance-focused animations:
- Fade-in for modal overlays (duration-200)
- Slide-in for sidebar on mobile (duration-300)
- Pulse animation for "running" status only
- Smooth transitions for hover states (transition-colors duration-150)

**No complex animations** - maintain snappy, responsive feel for technical users.