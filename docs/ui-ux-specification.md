# UMS — Hybrid Enterprise SaaS UI/UX Design Specification

**Version:** 1.0  
**Target:** React / Next.js / TypeScript  
**Design direction:** Premium Light SaaS + Technical Operations Console  
**Primary brand:** Purple `#4B1978`  
**Backend integration:** Java / Spring Boot REST APIs  
**Status:** Proposed redesign specification

---

## 1. Product Vision

UMS (Unified Messaging System) is a centralized platform for managing, monitoring, and reconciling messages across business applications, delivery channels, and messaging vendors.

The redesigned interface must support both business and technical users without requiring them to navigate separate systems.

### Primary design objectives

1. Provide an immediate view of message-delivery performance and operational problems.
2. Reduce the time needed to find, investigate, and resolve failed messages.
3. Provide transparency into vendor usage, message costs, and financial reconciliation.
4. Make notification workflows and channel routing understandable.
5. Support high-volume transaction monitoring without overloading the browser.
6. Maintain a consistent, professional design throughout the application.

### Design principles

- **Operational first:** Important events and problems should be immediately visible.
- **Progressive disclosure:** Show summary information first, with detailed technical data one interaction away.
- **High information density:** Use compact tables and filters without creating a cramped appearance.
- **Consistent interaction:** Reuse the same filters, data tables, drawers, dialogs, and status indicators.
- **Safe operations:** Retry, configuration changes, workflow publishing, and reconciliation approval require appropriate permissions and audit records.
- **Premium simplicity:** Use strong typography, whitespace, and subtle visual emphasis instead of excessive borders, gradients, and oversized cards.

### Initial scope assumptions

The proposed UMS supports WhatsApp, Email, SMS, and Push, subject to actual implemented provider integrations.

The design includes operational monitoring, workflows, vendor costs, and reconciliation. These are proposed product capabilities; inclusion here does not imply they are already implemented in the backend.

---

## 2. Information Architecture

The sidebar should be organized around user tasks rather than database entities.

| Navigation group | Menu | Proposed route |
|---|---|---|
| Overview | Dashboard | `/dashboard` |
| Operations | Message Explorer | `/messages` |
| Operations | Delivery & Retry Queue | `/deliveries` |
| Operations | Channel Monitoring | `/channels` |
| Orchestration | Workflows | `/workflows` |
| Orchestration | Message Templates | `/templates` |
| Finance | Vendor Usage & Costs | `/finance/usage` |
| Finance | Cost Allocation | `/finance/allocation` |
| Finance | Reconciliation | `/finance/reconciliation` |
| Administration | Vendors & Integrations | `/settings/providers` |
| Administration | Applications & Business Units | `/settings/applications` |
| Administration | Access & Audit Logs | `/settings/audit` |

The sidebar should support expanded and icon-only collapsed modes. Preserve the last selected mode.

### Global application shell

**Sidebar — left**

- Brand identity and workspace name.
- Primary navigation grouped by function.
- Collapsible navigation sections.
- Active page indication with a subtle purple background.
- User profile, theme settings, and help access at the bottom.

**Top bar — fixed**

- Breadcrumb and page title.
- Workspace/business-unit selector, where authorized.
- Environment selector: Production / UAT / Development.
- Global search with keyboard shortcut.
- Notifications and user menu.

**Content area**

- Page heading and short contextual description.
- Persistent date range and applicable filters.
- Main content with 12-column responsive layout.
- Contextual detail drawer for investigation rather than excessive page navigation.

Production, UAT, and Development must have distinct, clearly readable environment labels. Dangerous actions should not be confused between environments.

---

## 3. Design System

### 3.1 Brand colors

| Token | Hex | Usage |
|---|---|---|
| `brand-primary` | `#4B1978` | Main buttons, selected navigation, primary chart series |
| `brand-secondary` | `#5D2E87` | Hover and secondary brand accents |
| `brand-violet` | `#7C3AED` | Highlights and technical data visualizations |
| `brand-subtle` | `#F3ECF9` | Selected backgrounds, tinted cards |
| `background` | `#F8F9FC` | Application workspace |
| `surface` | `#FFFFFF` | Tables, drawers, dialogs, cards |
| `text-primary` | `#18181B` | Main content |
| `text-secondary` | `#71717A` | Supporting labels |
| `border` | `#E4E4E7` | Subtle dividers |
| `success` | `#15803D` | Confirmed successful states |
| `warning` | `#B45309` | Delays and warnings |
| `danger` | `#DC2626` | Failures and critical actions |
| `information` | `#2563EB` | Informational states |

These are initial design tokens, not final accessibility-validated color pairs. Foreground/background combinations must pass contrast testing.

### 3.2 Typography

**Recommended font:** Inter or Geist Sans.

- Main page headings: 26–30 px, semibold.
- Section headings: 16–18 px, semibold.
- Primary body: 14 px.
- Table content: 13–14 px.
- Supporting labels: 12–13 px.
- KPI numbers: 26–32 px, semibold.
- IDs, timestamps, and technical payloads: monospace with tabular numbers.

Avoid extremely light font weights and oversized headings.

### 3.3 Sizing and spacing

- Expanded sidebar: 248 px.
- Collapsed sidebar: 68 px.
- Top navigation: 64 px high.
- Main content padding: 24–32 px desktop.
- Standard card radius: 12 px.
- Dialog/drawer radius: 12–16 px.
- Input/control height: 36–40 px for desktop.
- Data-table row height: 44–48 px standard; 40 px optional compact mode.
- Spacing scale: 4, 8, 12, 16, 24, 32, 48 px.

Use restrained shadows and subtle borders to distinguish surfaces.

### 3.4 Light and dark modes

**Light mode is the default.** Dark mode should be a first-class, fully tested theme rather than a simple CSS inversion.

Dark mode should use neutral charcoal surfaces with restrained purple accents. Charts, badges, table selection states, and focus indicators must maintain contrast.

Users should be able to choose Light, Dark, or System. Preserve their preference.

---

## 4. Screen Specification: Executive & Operations Dashboard

**Route:** `/dashboard`

**Primary references:** Dub analytics + Trigger.dev monitoring.

### Layout

**Header**

- Title: "Overview"
- Description: "Messaging activity, delivery performance, and operational health."
- Global date range selector.
- Business unit and application selectors.
- Optional refresh control with last-updated timestamp.

**First row — operational KPIs**

Display five compact KPI cards:

1. Total Message Requests.
2. Delivered Messages.
3. Delivery Success Rate.
4. Final Failed Messages.
5. Estimated Message Cost.

Each card should include its primary value, comparison against the previous equivalent period, and a small trend indicator.

The comparison period must be clearly labeled. Never represent absent data as zero.

**Second row — primary analytics**

Left, approximately 8 columns:

- Delivery volume trend.
- Channel segmentation.
- Toggle between request volume and delivery performance.
- Hourly/daily granularity depending on selected period.

Right, approximately 4 columns:

- Channel performance summary.
- WhatsApp, Email, SMS, and Push.
- Delivery rate and corresponding message volume.
- Clicking a channel applies a contextual filter.

**Third row — operational insight**

- Failed messages by error category.
- Provider status and degradation.
- Queue backlog and oldest queued message.
- Retry activity and pending exceptions.

**Fourth row — investigation**

A compact table containing recent critical failures:

| Column | Behavior |
|---|---|
| Time | Localized timestamp |
| Message ID | Click to open detail |
| Application | Source application |
| Channel | Icon and text |
| Provider | Vendor name |
| Error | Short categorized description |
| Action | View details |

### Dashboard interaction

Clicking "Failed Messages" should navigate to Message Explorer with failure and date filters already applied.

Clicking a provider health warning should open the corresponding Channel Monitoring page.

Charts must have meaningful tooltips, clear units, and accessible equivalent data.

### Metric calculation requirements

- Count logical messages separately from delivery attempts.
- Define the delivery-rate denominator explicitly.
- Use an agreed final-state policy for messages still processing.
- Avoid double-counting retry attempts.
- Distinguish vendor acceptance from confirmed recipient delivery.
- If a channel does not support a delivery/read confirmation, display "Not available" rather than treating the message as failed.

---

## 5. Screen Specification: Message Explorer

**Route:** `/messages`

**Primary reference:** Trigger.dev execution list.

This should be the main daily operational screen.

### Layout

Use a full-width data table with a slim filter toolbar instead of a dashboard full of cards.

**Toolbar**

- Global message search.
- Date/time range.
- Status.
- Channel.
- Provider.
- Application/business unit.
- Advanced filters.
- Saved views.
- Column visibility.
- Export, permission-controlled.

Search should support exact identifiers such as Message ID, Correlation ID, External Reference, and Provider Message ID.

Recipient and message-content searches require separate security controls.

**Data table**

| Column | Expected behavior |
|---|---|
| Message ID | Copyable, opens detail |
| Created At | Date/time with timezone context |
| Application | Source system |
| Channel | Icon plus label |
| Provider | Vendor |
| Recipient | Masked by default |
| Status | Consistent semantic status |
| Attempts | Number of delivery attempts |
| Latency | Duration to relevant delivery milestone |
| Cost | Estimated or final with currency label |
| Actions | View, inspect, retry when permitted |

Default sorting should show newest messages first.

### Message detail drawer

Clicking a row opens a right-side drawer approximately 520–640 px wide, without losing the current filters or table position.

The drawer contains:

**Tab 1: Summary**

- Message ID.
- Source application.
- Recipient (masked).
- Channel and provider.
- Current delivery state.
- Request/correlation identifiers.
- Workflow and template references.
- Created and last-updated timestamps.

**Tab 2: Delivery Timeline**

A vertical event timeline:

- Request accepted.
- Queued.
- Dispatch attempted.
- Provider accepted or rejected.
- Delivery confirmation, when supported.
- Retry, timeout, expiration, or final failure.
- Read confirmation, where supported.

Show actual event timestamps and durations. Events can arrive out of order; the UI must preserve their factual event times.

**Tab 3: Attempts & Errors**

- Individual attempt IDs.
- Provider response codes.
- Normalized error category.
- Retry eligibility.
- Previous attempts.
- Relevant sanitized error details.

**Tab 4: Payload & Audit**

- Masked payload preview.
- Template version.
- Request metadata.
- Authorized audit history.
- Copy permitted technical identifiers.

Payload viewing must be restricted by permissions and data-classification policy.

### Retry UX

Retry is a potentially consequential operation, not an ordinary table shortcut.

The interface must:

1. Check permission and message eligibility.
2. Show the selected message and number of previous attempts.
3. Warn about duplicate-message risk where provider state is uncertain.
4. Require confirmation when appropriate.
5. Submit an idempotent retry request.
6. Show the newly created attempt and auditable outcome.

Do not immediately mark a message as delivered because a retry API request succeeded.

---

## 6. Screen Specification: Channel Monitoring

**Route:** `/channels`

**Primary reference:** Trigger.dev monitoring.

### Channel overview

Provide one compact summary for each enabled channel:

- Configured providers.
- Operational/Degraded/Unavailable/Unknown status.
- Request and delivery volume.
- Delivery success rate.
- Failure rate.
- Delivery latency p95.
- Oldest pending/queued message.
- Webhook processing delay, where applicable.

Each channel opens a detailed monitoring page or context panel.

### Provider monitoring

Display:

- Provider integration name and configuration status.
- Queue throughput.
- API acceptance/rejection statistics.
- Error category distribution.
- Timeout and rate-limit events.
- Last successful integration request.
- Webhook freshness.
- Fallback provider configuration, if enabled.

Health must be calculated from actual observations and a documented measurement window. Do not show a green "Healthy" state just because no monitoring data exists.

### Incident interaction

When degradation is detected:

- Show the affected channel/provider and observed window.
- Explain the detected symptoms.
- Link directly to affected messages.
- Provide recommended investigation steps.
- Display fallback status.
- Restrict provider switching or configuration changes to authorized roles.

---

## 7. Screen Specification: Workflow Builder

**Routes:** `/workflows`, `/workflows/[id]`

**Primary reference:** Novu workflow editor.

Use a visual node-based editor with a step-property panel.

### Workflow list

Columns:

- Workflow name.
- Workflow key.
- Business unit/application.
- Channels used.
- Active version.
- Status.
- Last modified.
- Owner.

Support Draft, Active, Inactive, and Archived states as appropriate to the backend model.

### Workflow editor

**Left panel — available steps**

- Trigger.
- Condition.
- Channel delivery.
- Delay.
- Fallback.
- End.

**Center — workflow canvas**

- Zoom, pan, and fit-to-screen.
- Drag-and-drop nodes.
- Visible connection direction.
- Clear success/error paths.
- Validation indicators.
- Unsaved changes indicator.

**Right panel — selected node properties**

- Channel.
- Provider routing policy.
- Message template.
- Variables.
- Condition configuration.
- Retry policy reference.
- Timeout.
- Fallback behavior.

### Example scenario

`Trigger: Loan Payment Reminder`

→ Check contact eligibility and consent

→ Select preferred delivery channel

→ Send WhatsApp message

→ On defined delivery failure, evaluate SMS fallback

→ End and record final result.

The fallback decision must use channel-specific event semantics. A missing "read" event must not automatically trigger a duplicate send.

### Workflow safety

- Save changes as a draft.
- Provide test/simulation using non-production recipients.
- Validate required parameters and unreachable nodes.
- Require appropriate review/approval before production publishing.
- Publish a versioned, immutable workflow definition.
- Maintain an audit trail.
- Allow rollback by activating a previously approved version.

Already-running messages should retain the workflow version used when they were initiated, unless explicitly governed otherwise.

---

## 8. Screen Specification: Vendor Usage & Costs

**Route:** `/finance/usage`

**Primary reference:** Dub analytics + Trigger.dev usage.

This screen is designed for finance, procurement, and operations.

### KPI summary

- Total usage units.
- Estimated accrued cost.
- Provider-reported cost.
- Invoiced cost.
- Cost per message/unit.
- Budget utilization, where budgets exist.

**Important:** Estimated, accrued, provider-reported, and invoiced values are different financial measures. Their labels and calculation methods must remain distinct.

### Analytical views

- Daily usage and cost trends.
- Spend by vendor.
- Spend by channel.
- Spend by source application.
- Spend by business unit.
- Unit-price trend.
- Budget versus actual.

### Vendor cost table

| Column | Description |
|---|---|
| Vendor | Provider name |
| Channel | Supported channel |
| Usage Units | Billable units based on tariff |
| Rate | Effective unit price |
| Estimated Cost | Internally calculated |
| Provider Cost | Vendor-reported, if available |
| Variance | Difference against internal estimate |
| Currency | Billing currency |
| Period | Usage/billing period |

Support IDR as a display and reporting currency where appropriate, without assuming all vendors bill in IDR.

### Cost allocation

Provide configurable allocation dimensions:

- Legal entity.
- Business unit.
- Source application.
- Campaign or message purpose.
- Channel.
- Provider.
- Cost center.

Allocation rules should support effective dates, versioning, and approval.

Do not assume every message has one billable unit. Different providers may charge by message, conversation, template category, segment, or other contractual units.

---

## 9. Screen Specification: Financial Reconciliation

**Route:** `/finance/reconciliation`

This is a dedicated reconciliation workbench, not just another chart page.

### Reconciliation overview

Provide four summary groups:

1. Internal usage records.
2. Provider usage records.
3. Vendor invoices.
4. Reconciliation exceptions.

### Reconciliation lifecycle

**Stage 1 — Import**

- Select vendor and billing period.
- Import or retrieve provider usage/invoice data.
- Validate format, currency, identifiers, and period.
- Display import errors without silently discarding records.

**Stage 2 — Match**

Compare internal usage with provider usage using appropriate normalized identifiers, event times, and contract-specific billing rules.

**Stage 3 — Investigate**

Classify differences:

- Matched.
- Missing internal record.
- Missing provider record.
- Duplicate charge.
- Usage quantity mismatch.
- Unit-rate mismatch.
- Currency/FX mismatch.
- Unpriced record.
- Pending settlement or delayed provider data.

**Stage 4 — Review and Approve**

Authorized users review exceptions, record explanations, and approve a reconciliation batch.

**Stage 5 — Close or Export**

Generate a reconciliation report with totals, variance, unresolved exceptions, approvals, and audit metadata.

### Reconciliation details

For each discrepancy show:

- Internal message/delivery attempt reference.
- Provider transaction or billing identifier.
- Internal and vendor billable quantities.
- Effective pricing rule.
- Internal estimated cost.
- Provider billed cost.
- Difference and currency.
- Variance category.
- Explanation and resolution status.
- Assigned owner and approval history.

### Financial integrity requirements

- Use decimal arithmetic rather than floating-point calculations for monetary values.
- Preserve rate versions and billing-period context.
- Apply documented currency conversion and rounding policies.
- Keep imported raw records immutable.
- Make reconciliation reruns idempotent.
- Require approval for manual adjustments.
- Prevent silently overwriting approved reconciliation results.
- Retain reconciliation lineage to the source records.
- Differentiate true charge differences from timing and provider-reporting delays.

A reconciliation should not be marked fully matched solely because total amounts agree; individual mismatches could cancel each other.

---

## 10. User Roles and Permissions

Suggested roles, subject to the organization's actual authorization model:

| Role | Primary access |
|---|---|
| Viewer | Dashboard and permitted read-only operational data |
| Operator | Message investigation and approved operational actions |
| Technical Admin | Provider monitoring and technical configuration |
| Workflow Manager | Workflow drafting, testing, and authorized publishing |
| Finance | Vendor usage, allocation, reconciliation |
| Auditor | Read-only evidence, history, and audit records |
| Platform Admin | Managed configuration and access administration |

Implement authorization on backend APIs, not only by hiding frontend buttons.

Apply row-level/business-unit access restrictions to message logs, recipient information, vendor costs, and reconciliation results.

---

## 11. Shared Component Architecture

Develop reusable components rather than page-specific copies.

### Application components

- `AppSidebar`
- `AppHeader`
- `WorkspaceSwitcher`
- `EnvironmentIndicator`
- `GlobalCommandSearch`
- `PageHeader`
- `PermissionGuard`

### Dashboard components

- `MetricCard`
- `TrendChart`
- `ChannelPerformancePanel`
- `ProviderHealthIndicator`
- `FailureBreakdown`
- `LastUpdatedIndicator`

### Operational components

- `ServerDataTable`
- `FilterToolbar`
- `SavedViewSelector`
- `StatusBadge`
- `MessageDetailDrawer`
- `DeliveryTimeline`
- `RetryConfirmationDialog`
- `TechnicalPayloadViewer`

### Workflow components

- `WorkflowCanvas`
- `WorkflowNode`
- `WorkflowStepPalette`
- `WorkflowPropertyPanel`
- `WorkflowValidationSummary`
- `WorkflowVersionSelector`

### Finance components

- `MoneyDisplay`
- `VendorCostTable`
- `CostAllocationEditor`
- `ReconciliationSummary`
- `VarianceTable`
- `ReconciliationDetailDrawer`
- `ApprovalHistory`

### Technology mapping

| Responsibility | Suggested library |
|---|---|
| Accessible UI primitives | shadcn/ui |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Server-data grids | TanStack Table |
| Optional large-grid virtualization | TanStack Virtual |
| Data fetching and caching | TanStack Query |
| Charts | Tremor Raw or Recharts |
| Node-based workflow canvas | React Flow |
| Form handling | React Hook Form + Zod |
| Lightweight UI state | React state / Zustand where genuinely needed |
| Dates/timezones | A dedicated date/time utility library |

Avoid duplicating state across URL parameters, React Query, and global stores. Each type of state should have one owner.

---

## 12. Next.js Frontend Architecture

Use Next.js App Router with a feature-oriented structure.

Suggested organization:

- `src/app/(app)/`: protected application routes.
- `src/components/ui/`: shared design primitives.
- `src/components/layout/`: global application shell.
- `src/features/dashboard/`: dashboard-specific components and queries.
- `src/features/messages/`: message explorer, details, and actions.
- `src/features/channels/`: monitoring.
- `src/features/workflows/`: workflow list and editor.
- `src/features/finance/`: usage, allocation, reconciliation.
- `src/features/settings/`: integrations and administration.
- `src/lib/api/`: HTTP client and API error normalization.
- `src/lib/auth/`: session and permission helpers.
- `src/lib/format/`: currency, timestamps, and numeric formatting.
- `src/styles/`: design tokens and global styles.

### Frontend/backend separation

Next.js owns presentation, interaction, client-side validation, and supported server rendering.

Spring Boot remains responsible for authoritative business behavior:

- Message state transitions.
- Retry eligibility and idempotency.
- Provider integration.
- Workflow publication and validation.
- Cost calculations.
- Reconciliation.
- Audit logging.
- Authorization and data access restrictions.

Use existing APIs where possible. Add or extend contracts only when required by the new UI.

### Proposed read APIs

These are logical API requirements, not claims about existing endpoints.

- `GET /api/dashboard/summary`
- `GET /api/dashboard/trends`
- `GET /api/messages`
- `GET /api/messages/{id}`
- `GET /api/messages/{id}/events`
- `GET /api/messages/{id}/attempts`
- `GET /api/channels/health`
- `GET /api/providers/{id}/metrics`
- `GET /api/workflows`
- `GET /api/finance/usage`
- `GET /api/finance/reconciliation`

Proposed write operations include retry requests, workflow draft changes/publication, cost allocation updates, reconciliation execution, and reconciliation approval.

Actual naming, schemas, and permissions must be mapped to the existing backend contracts before implementation.

### Minimum message data contract

The frontend needs these logical fields, potentially from multiple API responses:

- `messageId`
- `correlationId`
- `sourceApplication`
- `businessUnit`
- `channel`
- `provider`
- `providerMessageId`
- `recipientMasked`
- `currentStatus`
- `createdAt`
- `updatedAt`
- `attemptCount`
- `workflowId`
- `workflowVersion`
- `estimatedCost`
- `currency`
- `events[]`
- `attempts[]`

Separate the logical message, individual delivery attempts, and timestamped delivery events.

This separation is essential for correct retries, operational metrics, cost calculation, and reconciliation.

---

## 13. Performance & Scalability

UMS must remain responsive with millions of messages and high-volume delivery events.

### Data access

- Use backend pagination, filtering, and sorting.
- Prefer cursor/keyset pagination for large chronological logs.
- Use indexed query fields for common operational searches.
- Perform aggregations on the backend.
- Avoid loading full message histories into dashboard pages.
- Query detail events only when the relevant message drawer opens.
- Use query caching with invalidation rules.
- Virtualize very large visible row sets when necessary.

### Refresh strategy

- Dashboard: configurable periodic refresh.
- Message Explorer: explicit refresh or controlled live-update mode.
- Channel monitoring: more frequent updates where needed.
- Reconciliation: display process status without repeatedly downloading full result sets.
- Workflow editing: maintain local draft state and explicit save behavior.

Prefer server-sent events or WebSocket updates where the backend supports them. Polling remains an acceptable fallback.

### Proposed performance targets

These are initial targets requiring validation with the actual environment.

- Initial application shell: responsive within approximately 2 seconds on the agreed reference environment.
- Typical filtered message query: p95 under 2 seconds.
- Message detail interaction: p95 under 1 second for cached/lightweight responses, with longer asynchronous event histories loaded separately.
- No browser-wide freeze during large-table scrolling or filtering.
- Dashboard charts should use downsampled/aggregated series where needed.

Measure frontend and backend latency independently.

### Local development considerations

For the current 8 GB Apple Silicon development environment:

- Run the existing Next.js application directly in Node.js.
- Use only the required local infrastructure services.
- Avoid self-hosting full Novu, Dub, or Trigger.dev platforms for visual references.
- Develop one feature at a time with mocked contracts when backend APIs are not ready.
- Keep heavy analytics and reconciliation workloads server-side.

---

## 14. Security, Accessibility, and Operational UX

### Security and privacy

- Mask recipient identifiers by default.
- Never expose provider credentials in browser responses.
- Sanitize provider error responses and payload previews.
- Restrict message-content access.
- Use server-enforced RBAC and business-unit scoping.
- Audit sensitive data access where required.
- Log workflow publication, manual retries, pricing changes, and reconciliation approvals.
- Never use visual hiding as the only authorization mechanism.

### Accessibility

Target WCAG 2.2 AA for the redesigned UI.

- Full keyboard navigation.
- Visible focus states.
- Accessible labels for all icon-only actions.
- Status meaning conveyed by text as well as color.
- Screen-reader-friendly tables and dialogs.
- Proper form errors and validation messages.
- Reduced-motion support.
- Adequate contrast in light and dark modes.

### Loading and error states

Every major screen should define:

- Loading skeleton.
- Empty dataset.
- No results after filtering.
- Permission denied.
- API failure.
- Partial data unavailable.
- Stale data warning.
- Successful operation with verification status.

A retry, workflow publication, or reconciliation approval must not display a final success state until the authoritative backend has confirmed the relevant transition.

### Responsive behavior

**Desktop 1440 px and above:** Expanded workspace, 12-column analytics grid, side drawers, dense tables.

**Laptop 1024–1439 px:** Collapsible sidebar, adjusted cards and filter toolbar, optional horizontal table scrolling.

**Tablet 768–1023 px:** Collapsed navigation, stacked analytics, overlay drawers.

**Mobile below 768 px:** Essential read-only monitoring and investigation prioritized. Complex workflow editing and bulk reconciliation should require an appropriately sized workspace unless an explicit mobile design is developed.

---

## 15. Delivery Priorities

| Phase | Scope | Priority |
|---|---|---|
| 1 — Foundation | Design tokens, shell, sidebar, top bar, theme, common states | P0 |
| 2 — Operations | Dashboard, Message Explorer, details, filters, timelines | P0 |
| 3 — Monitoring | Provider health, channel metrics, failures and retry UX | P0/P1 |
| 4 — Orchestration | Workflows, templates, validation and versioning | P1 |
| 5 — Finance | Vendor usage, cost allocation and reconciliation | P1 |
| 6 — Enhancement | Saved dashboards, advanced analytics, command actions | P2 |

Phases may overlap, but shared UI components and backend contracts should be stabilized before building many independent screens.

### Definition of Done

A redesigned screen is complete only when:

1. It follows the approved design tokens and layout behavior.
2. It supports loading, error, empty, and permission states.
3. Tables have working server-side filtering, sorting, and pagination.
4. Operational actions enforce authorization and auditability.
5. Statuses and metrics match documented backend definitions.
6. It passes keyboard and contrast checks.
7. Responsive behavior is tested.
8. Automated component/integration tests cover important states.
9. Critical flows have end-to-end tests.
10. No existing business logic or API contract is unintentionally broken.

### Acceptance scenarios

- An operator can find a failed transaction using Message ID and inspect every related delivery attempt.
- A technical user can identify a degrading vendor and navigate directly to affected messages.
- An authorized user can safely retry an eligible message without unintentionally triggering duplicate delivery.
- A workflow manager can simulate, validate, review, and publish a versioned workflow.
- A finance user can trace usage costs to the correct provider tariff and cost center.
- A reconciliation reviewer can investigate mismatched lines, record explanations, and approve results with an audit trail.
- A viewer cannot access sensitive payloads or perform restricted actions.
- A user can switch between light and dark modes without losing application state.

---

## 16. Open Decisions Before Implementation

The following items should be validated against the current UMS implementation:

- Exact supported messaging channels and vendors.
- Existing message-status model and webhook behavior.
- Current Spring Boot endpoints and response contracts.
- Whether workflows are already configurable or implemented in code.
- Actual pricing units, vendor rate cards, and invoice formats.
- Multi-tenant versus business-unit access requirements.
- Reconciliation sources and frequency.
- User roles and approval responsibilities.
- Production monitoring requirements and operational SLAs.

**Final design recommendation:** A purple-branded, premium light enterprise workspace with a compact operational data grid, powerful message investigation drawers, visual workflow orchestration, and dedicated finance/reconciliation workbenches. The same design system should support technical dark mode without splitting UMS into visually inconsistent applications.