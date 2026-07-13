# Production Readiness Checklist

**Project:** Winnmatt Supermarket POS  
**Generated:** July 11, 2026  
**Standards:** OWASP ASVS, OWASP Top 10, NIST, CIS Benchmarks, CNCF, Google SRE, Twelve-Factor App, WCAG 2.2 AA

---

## 1. Authentication

### Login
- [ ] [CRITICAL] Verify login endpoint returns 401 with generic message ("Invalid credentials") on both invalid username and invalid password — no user enumeration.
- [ ] [HIGH] Confirm login endpoint rate-limits to 5 attempts per IP per minute with exponential backoff after 3 consecutive failures.
- [ ] [CRITICAL] Verify account lockout triggers after 10 consecutive failed attempts with a minimum 15-minute lockout duration.
- [ ] [HIGH] Validate that login supports both username/email and phone number as identifiers.
- [ ] [MEDIUM] Confirm CAPTCHA or challenge appears after 3 failed login attempts from the same IP.

### Registration
- [ ] [CRITICAL] Verify registration requires email/phone verification before first login is permitted.
- [ ] [HIGH] Confirm registration prevents duplicate accounts with the same email or verified phone number.
- [ ] [HIGH] Validate registration enforces minimum password entropy (12+ characters, uppercase, lowercase, digit, special character).
- [ ] [MEDIUM] Verify registration logs all new account creation events with IP, timestamp, and user agent.
- [ ] [MEDIUM] Confirm registration endpoint uses the same rate-limiting as login (no distinction for attackers).

### MFA
- [ ] [CRITICAL] Verify TOTP-based MFA enrollment requires current password re-entry before setup.
- [ ] [HIGH] Confirm MFA recovery codes (8+ codes) are generated at enrollment and displayed exactly once with download option.
- [ ] [HIGH] Validate MFA enforcement for all admin/super_admin roles — cannot be disabled by the user.
- [ ] [MEDIUM] Verify SMS-based MFA uses a dedicated SMS provider API key (not shared with transactional SMS).
- [ ] [MEDIUM] Confirm MFA challenge timeout is 5 minutes; expired challenges require restart.

### Session Management
- [ ] [CRITICAL] Verify session tokens are stored as HTTP-only, Secure, SameSite=Lax cookies with a random non-guessable value (minimum 128 bits of entropy).
- [ ] [HIGH] Confirm session idle timeout is 30 minutes with mandatory re-authentication.
- [ ] [HIGH] Validate absolute session lifetime is 24 hours; new session must be created after expiry.
- [ ] [MEDIUM] Verify session cookies use `__Host-` prefix to prevent domain-wide cookie injection.
- [ ] [MEDIUM] Confirm session invalidation on logout clears server-side session state immediately.

### JWT
- [ ] [CRITICAL] Verify access tokens are signed with RS256 (asymmetric) using a dedicated per-environment key; never HS256 with a shared secret.
- [ ] [HIGH] Confirm access token lifetime is 15 minutes maximum; refresh tokens have 7-day lifetime with rotation.
- [ ] [HIGH] Validate JWT `aud` (audience) claim matches the intended application name; `iss` matches the issuing domain.
- [ ] [MEDIUM] Verify JWT parsing validates all standard claims (exp, nbf, iat, iss, aud) and rejects tokens with missing or invalid claims.
- [ ] [MEDIUM] Confirm revoked JWTs are checked against a server-side denylist (from logout, password change, or admin revoke).

### OAuth / Social Login
- [ ] [CRITICAL] Verify OAuth redirect URIs are strictly validated against a whitelist — no open redirect via wildcard patterns.
- [ ] [HIGH] Confirm OAuth state parameter is a cryptographically random nonce (min 128 bits) with one-time use enforcement.
- [ ] [HIGH] Validate social login only receives the minimum scopes requested (email, profile) — never offline_access unless explicitly needed.
- [ ] [MEDIUM] Verify account linking requires password re-entry before an existing account can be linked to a new social provider.
- [ ] [MEDIUM] Confirm PKCE is enforced for all OAuth flows (S256 challenge method).

### Password Storage
- [ ] [CRITICAL] Verify all passwords are hashed with bcrypt (cost factor 12+), Argon2id, or scrypt before storage.
- [ ] [HIGH] Confirm no password is ever logged, even in error messages or stack traces.
- [ ] [HIGH] Validate that password hashes use a unique per-password salt (minimum 16 bytes).
- [ ] [MEDIUM] Verify password history is retained for the last 10 passwords to prevent password reuse.

### Password Reset
- [ ] [CRITICAL] Verify password reset tokens are single-use, expire in 15 minutes, and are 128+ bits of cryptographic randomness.
- [ ] [HIGH] Confirm password reset emails are sent to the registered email address (never revealed in response — always "If that email exists, a reset link was sent").
- [ ] [HIGH] Validate that resetting a password invalidates all existing sessions and refresh tokens for that user.
- [ ] [MEDIUM] Verify password reset flow requires answering a registered security question or entering a one-time code sent via SMS.

### Email Verification
- [ ] [HIGH] Verify email verification tokens are single-use with 24-hour expiration.
- [ ] [HIGH] Confirm unverified emails cannot be used to login (email_verified_at must be non-null).
- [ ] [MEDIUM] Verify email change flow sends verification to both old and new addresses before committing the change.

### Account Recovery
- [ ] [CRITICAL] Verify account recovery requires at least two out of three factors (email, SMS, security questions) before granting access.
- [ ] [HIGH] Confirm account recovery is logged with IP, user agent, and timestamp; admin is notified via alert.
- [ ] [MEDIUM] Validate recovery codes are invalidated after single use and regenerated on each recovery cycle.

### Session Revocation
- [ ] [HIGH] Verify admin can revoke any active session for any user from the admin panel.
- [ ] [MEDIUM] Confirm "revoke all other sessions" feature exists in user settings and invalidates all sessions except the current one.
- [ ] [MEDIUM] Validate password change, email change, and role change each trigger automatic revocation of all sessions.

### Device Management
- [ ] [MEDIUM] Verify device fingerprint is stored with each session to detect session hijacking via IP/user-agent changes.
- [ ] [LOW] Confirm users can view and revoke individual devices from their profile under "Active Sessions."
- [ ] [LOW] Verify trusted device flag survives browser restart but expires after 30 days.

### Refresh Tokens
- [ ] [CRITICAL] Verify refresh token rotation: each refresh returns a new access token AND a new refresh token; the old refresh token is invalidated.
- [ ] [HIGH] Confirm refresh tokens are stored hashed (SHA-256) in the database; never in plaintext.
- [ ] [HIGH] Validate refresh token reuse detection triggers immediate invalidation of all tokens for that user.

### Remember Me
- [ ] [MEDIUM] Verify "Remember Me" uses a persistent cookie (30 days) with a separate token table; not an extended JWT lifetime.
- [ ] [MEDIUM] Confirm "Remember Me" tokens are single-use with rotation (similar to refresh tokens).
- [ ] [LOW] Validate that critical operations (password change, MFA settings, role changes) require fresh login even with Remember Me active.

### Concurrent Sessions
- [ ] [HIGH] Verify maximum concurrent sessions per user is enforced (5 for standard users, 3 for admin/super_admin).
- [ ] [MEDIUM] Confirm a warning is displayed when user reaches 80% of the concurrent session limit.
- [ ] [MEDIUM] Validate that the oldest session is terminated when a new session would exceed the limit.

---

## 2. Authorization

### RBAC
- [ ] [CRITICAL] Verify RBAC roles (super_admin, admin, manager, cashier, viewer) are enforced at every API endpoint — no client-side-only role checks.
- [ ] [HIGH] Confirm role hierarchy is enforced: super_admin > admin > manager > cashier > viewer with permission inheritance downward.
- [ ] [HIGH] Validate that cashier role cannot access financial reports, user management, or system configuration endpoints.
- [ ] [MEDIUM] Verify viewer role has read-only access across all domains with no mutation endpoints accessible.
- [ ] [MEDIUM] Confirm default role assignment on user creation is "cashier" unless explicitly elevated by an admin.

### ABAC
- [ ] [HIGH] Verify attribute-based policies check branch_id, department_id, and ownership before granting access to resources.
- [ ] [HIGH] Confirm a manager can only access data for branches they are assigned to — not all branches.
- [ ] [MEDIUM] Validate that attribute policies are evaluated server-side in a policy decision point (PDP), not in application code.
- [ ] [MEDIUM] Verify ABAC policies log every decision (allow/deny) with the full attribute context for audit.

### Ownership
- [ ] [CRITICAL] Verify data ownership checks prevent User A from viewing or modifying User B's records unless explicitly shared.
- [ ] [HIGH] Confirm "created_by" or "user_id" column exists on all user-scoped tables and is checked in every query.
- [ ] [HIGH] Validate that sharing a record (e.g., sale reassignment) requires explicit authorization from an admin.
- [ ] [MEDIUM] Verify ownership checks use the authenticated user's UUID from the session, never from request parameters.

### Permission Inheritance
- [ ] [HIGH] Verify permissions cascade: branch-level permissions automatically grant access to all departments and registers in that branch.
- [ ] [MEDIUM] Confirm that revoking a parent permission (e.g., branch access) cascades to all child permissions.
- [ ] [MEDIUM] Validate that explicit deny takes precedence over inherited allow (deny-override policy).

### Admin Protections
- [ ] [CRITICAL] Verify no API endpoint allows a user to elevate their own role or permissions.
- [ ] [HIGH] Confirm admin actions (role changes, user deletion, financial adjustments) require a second admin approval via audit log check.
- [ ] [HIGH] Validate that super_admin accounts cannot be deleted via the application interface — only via direct database (logged).
- [ ] [MEDIUM] Verify admin operations require re-authentication (password re-entry) for actions older than 15 minutes from login.

### Privilege Escalation
- [ ] [CRITICAL] Verify horizontal privilege escalation test: User A cannot access User B's data by modifying UUIDs in API requests.
- [ ] [CRITICAL] Verify vertical privilege escalation test: a cashier cannot access admin endpoints by modifying headers or tokens.
- [ ] [HIGH] Validate that all IDOR (Insecure Direct Object Reference) vectors are closed — every resource access checks ownership + role.

### Route Protection
- [ ] [CRITICAL] Verify every Next.js route (app router) has a server-side auth guard — no route is accessible without authentication.
- [ ] [HIGH] Confirm API routes under `/api/` use `authenticateRequest()` or `authenticateServerAction()` before any business logic.
- [ ] [MEDIUM] Validate that middleware catches unauthenticated requests and redirects to `/login` with the intended URL as a query param.
- [ ] [MEDIUM] Verify 404 is returned for unauthorized access to non-existent routes (not 401 or 403 which reveals information).

### API Authorization
- [ ] [HIGH] Verify every server action in `lib/*-actions.ts` calls `authenticateServerAction()` as the first executable line.
- [ ] [HIGH] Confirm role checks are performed at the function level, not just the calling component level.
- [ ] [MEDIUM] Validate that API responses for unauthorized access return 403 with a generic "Insufficient permissions" message.
- [ ] [MEDIUM] Verify batch/export operations respect the same authorization rules as individual operations.

### Database Authorization
- [ ] [CRITICAL] Verify Row-Level Security (RLS) is enabled on every Supabase table with policies enforcing user_id and role checks.
- [ ] [HIGH] Confirm RLS policies use `auth.uid()` and `auth.jwt()->>'role'` for authentication — never accept user_id from client requests.
- [ ] [HIGH] Validate that direct database connections (admin, service_role) are only used in server-side code, never in client queries.
- [ ] [MEDIUM] Verify that every Supabase query from client components uses the authenticated client (`supabaseAdmin` for server, not for client).

### Frontend Authorization
- [ ] [HIGH] Verify UI elements (buttons, links, tabs) conditionally render based on user role — but never rely on this for security.
- [ ] [MEDIUM] Confirm that hidden-but-present routes are guarded server-side (no "secret URL" access patterns).
- [ ] [MEDIUM] Validate that role-based navigation menus are generated server-side or hydrated from session, not stored in client state.

---

## 3. Input Validation

### Validation
- [ ] [CRITICAL] Verify all user-supplied input is validated against a server-side schema (Zod, Yup, or similar) — never trust client-side validation alone.
- [ ] [HIGH] Confirm that validation errors return structured error responses (field-level messages) without leaking server internals.
- [ ] [HIGH] Validate that all UUID parameters are checked for valid UUID v4 format before being used in queries.
- [ ] [MEDIUM] Verify that numeric inputs are range-checked (min/max) — no negative prices, zero quantity for sales, etc.

### Sanitization
- [ ] [CRITICAL] Verify all string input is sanitized to remove or encode HTML tags before storage (XSS prevention).
- [ ] [HIGH] Confirm that rich text fields (notes, descriptions) use a safe HTML library (DOMPurify) with a strict allowlist of tags.
- [ ] [MEDIUM] Validate that phone numbers are sanitized to E.164 format before storage (+2547XXXXXXXX for Kenya).

### Type Checking
- [ ] [HIGH] Verify API inputs are type-coerced and validated (string-as-number is rejected unless explicitly allowed).
- [ ] [HIGH] Confirm that boolean fields accept only `true`/`false` literal values (not "yes"/"no"/"1"/"0" strings).
- [ ] [MEDIUM] Validate that enum fields (status, type, role) are checked against a known allowlist — unknown values are rejected.

### Length Checking
- [ ] [CRITICAL] Verify all string fields have maximum length limits enforced server-side (prevent buffer overflow / DB truncation issues).
- [ ] [HIGH] Confirm that product names have a minimum length of 2 characters and maximum of 200 characters.
- [ ] [MEDIUM] Validate that notes and description fields have a 2000-character limit with character counting on the UI.

### File Validation
- [ ] [CRITICAL] Verify uploaded file types are validated by MIME type (not just extension) using server-side detection.
- [ ] [HIGH] Confirm file magic bytes are checked against the declared MIME type to prevent MIME-type spoofing.
- [ ] [MEDIUM] Validate that uploaded filenames are sanitized (remove path separators, null bytes, control characters).

### Upload Validation
- [ ] [HIGH] Verify upload size limits are enforced at both the reverse proxy (nginx/Cloudflare: 10MB) and application level (5MB).
- [ ] [HIGH] Confirm uploads are stored outside the web root with direct URL access blocked (served via signed URLs only).
- [ ] [MEDIUM] Validate that image uploads are resampled and recompressed server-side to strip EXIF metadata (prevent geo-location leakage).

### JSON Validation
- [ ] [CRITICAL] Verify JSON request bodies are validated against a strict schema — reject unknown properties (additionalProperties: false).
- [ ] [HIGH] Confirm deeply nested JSON objects are rejected beyond depth 5 to prevent stack exhaustion attacks.
- [ ] [MEDIUM] Validate that JSON parse errors return 400 with a "Malformed JSON" message (no stack traces).

### HTML Sanitization
- [ ] [HIGH] Verify all user-submitted HTML (if any) is sanitized server-side with DOMPurify's server-side library.
- [ ] [MEDIUM] Confirm that sanitized output is rendered using `dangerouslySetInnerHTML` only when absolutely necessary and reviewed.

### SQL Injection Prevention
- [ ] [CRITICAL] Verify all SQL queries use parameterized statements or ORM query builders — no string concatenation for dynamic SQL.
- [ ] [CRITICAL] Confirm that raw SQL queries (if any) use Supabase's `rpc()` with typed parameters, never `sql()` with interpolated strings.
- [ ] [HIGH] Validate that LIKE clauses escape user input properly (`%`, `_` characters) — use `ilike.%${sanitized}%` with sanitized input.
- [ ] [MEDIUM] Verify that dynamic table names are never derived from user input; use a fixed allowlist if necessary.

### XSS Prevention
- [ ] [CRITICAL] Verify all user-supplied data rendered in HTML is escaped by default (React's JSX auto-escaping, with caution for `dangerouslySetInnerHTML`).
- [ ] [HIGH] Confirm that CSP headers (see Security section) block inline scripts and `eval()` to prevent XSS exploitation.
- [ ] [HIGH] Validate that event handler props (`onClick`, `onMouseOver`, etc.) never receive user-supplied function strings.
- [ ] [MEDIUM] Verify that URL parameters rendered in the page are encoded to prevent reflected XSS.

### NoSQL Injection
- [ ] [HIGH] Verify that any MongoDB/NoSQL queries use parameterized builders; operator injection (`$gt`, `$ne`) is blocked.
- [ ] [MEDIUM] Confirm that NoSQL query inputs are type-checked before being passed to query builders.

### CSV Injection
- [ ] [HIGH] Verify CSV export prepends a single quote or tab to formulas starting with `=`, `+`, `-`, `@` to prevent formula injection.
- [ ] [MEDIUM] Confirm that CSV exports strip or encode newlines within cell values to prevent CSV injection via line breaks.

### Command Injection
- [ ] [CRITICAL] Verify no system shell commands are constructed from user input. If shell execution is required, use `execFile()` with arguments array (no `exec()` or `shell: true`).
- [ ] [HIGH] Confirm that child process spawns use absolute paths and are restricted to a specific allowlist of executables.

### SSRF
- [ ] [CRITICAL] Verify that any webhook/fetch-to-URL functionality validates URLs against an allowlist of permitted domains or IP ranges.
- [ ] [HIGH] Confirm that internal IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x, ::1) are blocked from app-initiated HTTP requests.
- [ ] [MEDIUM] Verify that redirect following in HTTP clients is disabled or restricted to same-host redirects.

### Open Redirect
- [ ] [CRITICAL] Verify that redirect URLs never accept user-supplied `?next=` or `?redirect=` parameters without validating against a whitelist.
- [ ] [HIGH] Confirm that `redirectTo` parameters are validated as relative paths (starts with `/`) or exact matches to allowed external URLs.

### Path Traversal
- [ ] [CRITICAL] Verify file read/write operations validate that the resolved path stays within the intended directory (realpath check).
- [ ] [HIGH] Confirm that `../` sequences and null bytes are stripped or rejected from file path parameters.
- [ ] [MEDIUM] Validate that file download endpoints serve files via an identifier (database ID), not a user-supplied filename.

---

## 4. API Security

### REST
- [ ] [CRITICAL] Verify all API endpoints enforce the correct HTTP method — POST for mutations, GET for reads, DELETE for deletions.
- [ ] [HIGH] Confirm that OPTIONS requests return allowed methods in the Allow header with no authentication required.
- [ ] [HIGH] Validate that unused HTTP methods (PUT, PATCH, TRACE, CONNECT) return 405 Method Not Allowed.
- [ ] [MEDIUM] Verify that all REST endpoints return consistent JSON envelope (`{ success, data, error }` or similar).

### GraphQL
- [ ] [HIGH] Verify GraphQL introspection is disabled in production.
- [ ] [HIGH] Confirm query depth limiting (max depth: 6) and query cost analysis are configured to prevent nested DoS attacks.
- [ ] [MEDIUM] Verify GraphQL batching is rate-limited to prevent batch brute-force attacks on authentication queries.

### Rate Limiting
- [ ] [CRITICAL] Verify rate limiting is configured for all API routes: 100 requests/minute for general endpoints, 10/minute for auth endpoints.
- [ ] [HIGH] Confirm rate limiting uses a sliding window algorithm (not fixed window) to prevent burst at window boundaries.
- [ ] [HIGH] Validate that rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are returned on all responses.
- [ ] [MEDIUM] Verify rate limiting key is based on a combination of IP + User ID (if authenticated) to prevent IP-based bypass via shared networks.
- [ ] [MEDIUM] Confirm that rate limit violations return 429 with a `Retry-After` header.

### API Keys
- [ ] [CRITICAL] Verify API keys (for webhook callers or external integrations) are stored hashed (SHA-256) in the database; plaintext only shown once on creation.
- [ ] [HIGH] Confirm API keys have a configurable expiration (default 90 days) and can be revoked individually.
- [ ] [MEDIUM] Verify that API key permissions are scoped to specific operations (read-only, write, admin) and enforced at each endpoint.

### Bearer Tokens
- [ ] [CRITICAL] Verify Bearer tokens are validated from the `Authorization: Bearer <token>` header — never from URL parameters or request bodies.
- [ ] [HIGH] Confirm that Bearer token parsing handles malformed tokens gracefully (no crashes, returns 401).
- [ ] [MEDIUM] Validate that tokens are not logged in plaintext in any server log, even in debug mode.

### Versioning
- [ ] [HIGH] Verify API versioning is implemented via URL prefix (`/api/v1/...`) or Accept header — never via body parameter.
- [ ] [MEDIUM] Confirm that deprecated API versions return a `Sunset` or `Deprecation` HTTP header with migration URL.
- [ ] [MEDIUM] Validate that at least one previous API version is maintained after a breaking change with a documented deprecation period.

### Idempotency
- [ ] [CRITICAL] Verify all payment and financial mutation endpoints support idempotency keys to prevent duplicate charges.
- [ ] [HIGH] Confirm idempotency keys are stored with TTL (24 hours) and the same key+endpoint returns the cached response.
- [ ] [MEDIUM] Validate that idempotency keys are at least 36 characters of cryptographic randomness.

### Pagination
- [ ] [HIGH] Verify all list endpoints implement cursor-based pagination (not offset-based) for performance and consistency.
- [ ] [HIGH] Confirm paginated responses include `next_cursor` and `has_more` fields — never expose raw DB sequence IDs.
- [ ] [MEDIUM] Validate that page size is capped (default 50, max 200) and attempts to exceed the limit return 400.
- [ ] [MEDIUM] Verify total-count queries for paginated endpoints are cached with TTL (60 seconds) to prevent count(*) overhead.

### Filtering
- [ ] [HIGH] Verify filter parameters (date ranges, statuses, branch IDs) are validated against allowed values — unknown filters are ignored or rejected.
- [ ] [MEDIUM] Confirm that filterable fields are enumerated in an allowlist — arbitrary column filtering is not permitted.
- [ ] [MEDIUM] Validate that date-range filters are bounded (max 1-year range) to prevent resource-exhaustion queries.

### Error Responses
- [ ] [CRITICAL] Verify error responses never expose stack traces, internal paths, database schemas, or query details.
- [ ] [HIGH] Confirm that 500 errors return a generic "An unexpected error occurred" message with a unique error reference ID.
- [ ] [MEDIUM] Validate that validation errors return 422 with a structured field-level error map (`{ errors: { field: ["message"] } }`).

### Timeouts
- [ ] [HIGH] Verify all external HTTP calls (payment gateways, SMS providers, email APIs) have a 10-second timeout.
- [ ] [HIGH] Confirm database queries have a statement timeout of 30 seconds (set via `statement_timeout` in PostgreSQL).
- [ ] [MEDIUM] Validate that serverless function execution timeout is set to the platform maximum minus 5 seconds (buffer for graceful shutdown).

### Request Size
- [ ] [HIGH] Verify request body size is limited to 1MB for JSON endpoints and 10MB for file upload endpoints.
- [ ] [MEDIUM] Confirm that requests exceeding the size limit return 413 Payload Too Large with a clear message.

### Response Size
- [ ] [HIGH] Verify large response payloads (exports, reports) are streamed or delivered via signed URL — never loaded entirely into memory.
- [ ] [MEDIUM] Confirm that JSON responses are compressed (gzip/brotli) at the reverse proxy level.

### Webhooks
- [ ] [CRITICAL] Verify webhook payloads include a signature header (HMAC-SHA256 with a per-endpoint secret) for authenticity verification.
- [ ] [HIGH] Confirm webhook receivers validate the signature before processing — invalid signatures are rejected with 401.
- [ ] [HIGH] Validate that webhook delivery retries with exponential backoff (3 retries: 30s, 2min, 10min) and dead-letter after 24 hours.
- [ ] [MEDIUM] Verify webhook endpoints are idempotent — same event ID delivered twice does not create duplicate records.
- [ ] [MEDIUM] Confirm webhook deliveries are logged with status code, response body, and duration for observability.

### Replay Protection
- [ ] [HIGH] Verify nonce/timestamp fields in critical API calls prevent replay of captured requests beyond a 5-minute window.
- [ ] [MEDIUM] Confirm that idempotency keys serve as replay protection for payment operations.

---

## 5. Frontend

### React
- [ ] [HIGH] Verify all components use functional components with hooks — no class components remain.
- [ ] [HIGH] Confirm that `useEffect` dependency arrays are complete and correct (ESLint `react-hooks/exhaustive-deps` passes with no warnings).
- [ ] [MEDIUM] Validate that expensive computations are memoized with `useMemo` and callbacks with `useCallback`.
- [ ] [MEDIUM] Verify that keys in `.map()` iterations are stable, unique identifiers (not array indices for dynamic lists).

### Next.js
- [ ] [HIGH] Verify all pages use proper data-fetching patterns — server components for initial data, client components for interactivity.
- [ ] [HIGH] Confirm that `useSearchParams()` is wrapped in `Suspense` boundaries to prevent static rendering bailout.
- [ ] [MEDIUM] Validate that dynamic imports use `next/dynamic` with `ssr: false` for heavy client-only components.
- [ ] [MEDIUM] Verify that `next.config.mjs` disables `reactStrictMode` only after confirming no double-render issues remain.

### Loading States
- [ ] [HIGH] Verify every page and data-fetching view has a loading skeleton or spinner — no blank screens during data loading.
- [ ] [HIGH] Confirm that loading states are shown immediately (optimistic UI) rather than waiting for the full response.
- [ ] [MEDIUM] Validate that skeleton components match the layout shape of the content they replace to reduce layout shift.

### Error Boundaries
- [ ] [CRITICAL] Verify error boundaries are placed around major UI sections — POS page, analytics, forms — to prevent a single crash from taking down the entire app.
- [ ] [HIGH] Confirm error boundaries display a user-friendly message with a "Retry" button that resets the error state.
- [ ] [MEDIUM] Validate that errors caught by boundaries are logged to the error tracking service (Sentry) with component stack trace.

### Suspense
- [ ] [HIGH] Verify all routes using `useSearchParams()` or `usePathname()` are wrapped in `<Suspense>` boundaries.
- [ ] [MEDIUM] Confirm that legacy `React.Suspense` is used for code-split components with meaningful fallback UIs.

### Accessibility
- [ ] [CRITICAL] Verify all form inputs have associated `<label>` elements with proper `htmlFor` attributes.
- [ ] [HIGH] Confirm all images have meaningful `alt` text (not empty for decorative, descriptive for informational).
- [ ] [HIGH] Validate that color is not the sole means of conveying information (add icons, patterns, or text labels).
- [ ] [MEDIUM] Verify that focus order follows the visual layout using tabIndex appropriately (ideally no tabIndex except for custom widgets).
- [ ] [MEDIUM] Confirm that all interactive elements are reachable via keyboard (no mouse-only interactions).

### Keyboard Navigation
- [ ] [HIGH] Verify all dropdowns, modals, and dialogs are navigable via keyboard (Tab, Enter, Escape, Arrow keys).
- [ ] [HIGH] Confirm that modal dialogs trap focus while open and restore focus to the trigger element on close.
- [ ] [MEDIUM] Validate that custom select/search components support Arrow Up/Down for item selection and Enter for confirmation.

### Responsive Design
- [ ] [HIGH] Verify the POS page renders correctly on mobile (768px breakpoint) with the mobile-optimized layout.
- [ ] [HIGH] Confirm that all data tables have horizontal scroll or column hiding on viewports below 1024px.
- [ ] [MEDIUM] Validate that touch targets are at least 44x44px on mobile (WCAG 2.5.8).
- [ ] [MEDIUM] Verify that sidebar overlays (not pushes) on mobile and desktop below 1280px.

### Dark Mode
- [ ] [MEDIUM] Verify both light and dark themes render all UI elements with readable contrast (4.5:1 for normal text, 3:1 for large text).
- [ ] [MEDIUM] Confirm that dark mode toggle persists across sessions via localStorage or user preference.
- [ ] [LOW] Validate that custom chart colors are adjusted for dark mode backgrounds.

### SEO
- [ ] [HIGH] Verify every page exports a `metadata` object with a unique `title` and `description`.
- [ ] [MEDIUM] Confirm that login, dashboard, and POS pages have appropriate `noindex` directives (private pages).
- [ ] [LOW] Validate that public-facing pages (landing, about) have proper OpenGraph tags.

### Metadata
- [ ] [HIGH] Verify all pages have a meaningful `<title>` element — no "Loading..." or default "Next.js" titles.
- [ ] [MEDIUM] Confirm that the manifest.json and favicon are configured and loading correctly.
- [ ] [LOW] Validate that PWA metadata (theme-color, background-color, display) are configured.

### Code Splitting
- [ ] [HIGH] Verify that heavy third-party libraries (recharts, framer-motion, stripe-js) are dynamically imported — not in the initial bundle.
- [ ] [HIGH] Confirm that route-level code splitting is working (each page has its own JS chunk verified via `next/bundle-analyzer`).
- [ ] [MEDIUM] Validate that vendor bundles are split — React, Supabase client, UI library each in separate chunks with long-term caching.

### Lazy Loading
- [ ] [HIGH] Verify images use `next/image` with `loading="lazy"` (default) for below-the-fold images.
- [ ] [MEDIUM] Confirm that non-critical components (modals, drawers, charts) are loaded lazily via `next/dynamic`.
- [ ] [MEDIUM] Validate that heavy list components use virtual scrolling (`react-window` or similar) for 100+ items.

### Hydration
- [ ] [HIGH] Verify no hydration mismatches exist — test with `suppressHydrationWarning` only on intentionally dynamic elements (theme, timestamps).
- [ ] [MEDIUM] Confirm that localStorage-dependent values are initialized in a `useEffect` (or `useSyncExternalStore`) to avoid hydration mismatch.
- [ ] [MEDIUM] Validate that timestamps and relative dates use a consistent timezone between server and client.

### Client Security
- [ ] [MEDIUM] Verify that sensitive tokens (API keys, service role keys) are never exposed in client-side bundle.
- [ ] [MEDIUM] Confirm that client-side environment variables are prefixed with `NEXT_PUBLIC_` and contain only non-sensitive data.
- [ ] [LOW] Validate that no credentials, secrets, or internal URLs are hardcoded in client components.

---

## 6. Backend

### Logging
- [ ] [CRITICAL] Verify structured JSON logging is implemented for all backend operations — no `console.log()` in production code.
- [ ] [HIGH] Confirm logs include correlation IDs (trace ID, request ID) to trace requests across services.
- [ ] [HIGH] Validate that PII (passwords, tokens, phone numbers, emails) is redacted from log output.
- [ ] [MEDIUM] Verify log levels are used consistently (ERROR for failures, WARN for degraded state, INFO for state changes, DEBUG for diagnostics).
- [ ] [MEDIUM] Confirm logs are shipped to a centralized log aggregation service (not stored on ephemeral containers).

### Validation
- [ ] [CRITICAL] Verify all server action inputs are validated with Zod schemas — TypeScript types alone are not runtime validation.
- [ ] [HIGH] Confirm that validation errors are caught and returned as structured error responses, never thrown as unhandled exceptions.
- [ ] [MEDIUM] Validate that UUIDs, dates, emails, and phone numbers have specific format validators (not just general string checks).

### Dependency Injection
- [ ] [MEDIUM] Verify that external service clients (Stripe, Resend, Africa's Talking, Supabase) are injectable for testing — not hardcoded.
- [ ] [MEDIUM] Confirm that module-layer adapters (`lib/modules/*`) accept dependencies via factory functions or config objects.

### Transactions
- [ ] [CRITICAL] Verify that multi-step financial operations (sale creation + inventory deduction + ledger entry) use database transactions.
- [ ] [HIGH] Confirm that transaction rollback on failure leaves the system in a consistent state — no partial writes.
- [ ] [HIGH] Validate that Supabase RPC functions handling transactions are idempotent or guarded by unique constraints.
- [ ] [MEDIUM] Verify that transactions have a timeout (30s default) to prevent long-held locks.

### Business Logic
- [ ] [HIGH] Verify all business rules (tax calculation, discount application, loyalty points, payment splitting) are unit-tested.
- [ ] [HIGH] Confirm that edge cases (zero-value sales, negative quantities, maximum discount caps) are handled with explicit validations.
- [ ] [MEDIUM] Validate that pricing calculations use integer math (cents/KSh smallest unit) — no floating-point rounding errors.

### Background Jobs
- [ ] [HIGH] Verify that long-running operations (report generation, bulk exports, email campaigns) run as background jobs — not in the request-response cycle.
- [ ] [HIGH] Confirm background jobs have timeout limits (15 minutes) and are automatically retried on failure.
- [ ] [MEDIUM] Validate that background jobs are idempotent — running the same job twice produces the same result.

### Queues
- [ ] [HIGH] Verify that a job queue system (Redis Bull, in-process, or Supabase Queue) is used for async work — no fire-and-forget `Promise`s.
- [ ] [HIGH] Confirm queue consumers handle poison messages (messages that repeatedly fail) — dead-letter queue after 3 retries.
- [ ] [MEDIUM] Validate that queue size is monitored (alert when queue depth exceeds 1000 messages).

### Retries
- [ ] [HIGH] Verify all external API calls (Resend, Africa's Talking, Stripe) have configurable retry logic with exponential backoff.
- [ ] [HIGH] Confirm retries are limited to 3 attempts with jitter to prevent thundering herd.
- [ ] [MEDIUM] Validate that idempotency keys are used for retried operations to prevent duplicate side effects.

### Timeouts
- [ ] [HIGH] Verify all HTTP clients (fetch, axios) have explicit timeout values — no infinite-wait calls.
- [ ] [MEDIUM] Confirm that timeouts are set appropriately per service (5s for fast APIs, 30s for report generation).
- [ ] [MEDIUM] Validate that timeout errors are caught, logged, and returned as 504 Gateway Timeout (not 500).

### Caching
- [ ] [HIGH] Verify frequently accessed but slowly changing data (products list, categories, tax rates) is cached with TTL.
- [ ] [HIGH] Confirm that cache invalidation triggers when underlying data changes (product updated → invalidate product cache).
- [ ] [MEDIUM] Validate that distributed cache (Redis) is used for session state and rate-limiting counters — local in-memory cache for read-heavy static data.
- [ ] [MEDIUM] Verify that cache keys include version numbers for safe cache busting on deployment.

### Race Conditions
- [ ] [CRITICAL] Verify that inventory deduction uses atomic operations (`UPDATE ... SET quantity = quantity - 1 WHERE quantity >= 1`) — not read-then-write.
- [ ] [HIGH] Confirm that reservation/locking is used for concurrent operations on the same resource (pessimistic or optimistic locking).
- [ ] [MEDIUM] Validate that sale creation includes a unique constraint on receipt_number to prevent duplicate receipt generation under load.

### Cron Jobs
- [ ] [HIGH] Verify scheduled tasks (daily sales reports, backup notifications, stock alert emails) are implemented as cron jobs.
- [ ] [HIGH] Confirm cron jobs are idempotent (running twice on the same day produces the same result).
- [ ] [MEDIUM] Validate that cron job executions are logged with start time, end time, and result status.
- [ ] [MEDIUM] Verify cron job schedules are configurable (not hardcoded) and documented.

---

## 7. Database

### Indexes
- [ ] [CRITICAL] Verify every foreign key column has an index to prevent sequential scans on JOIN operations.
- [ ] [HIGH] Confirm that query patterns identify missing indexes via `pg_stat_user_tables` and `pg_stat_statements` analysis.
- [ ] [HIGH] Validate that composite indexes exist for common multi-column WHERE clauses (e.g., `(branch_id, status)`, `(customer_id, created_at)`).
- [ ] [MEDIUM] Verify that full-text search columns use GIN indexes for `tsvector` queries.
- [ ] [MEDIUM] Confirm that partial indexes exist for frequently filtered queries (`WHERE status = 'active'`).

### Foreign Keys
- [ ] [CRITICAL] Verify all cross-table references use declared foreign keys with `ON DELETE RESTRICT` or `ON DELETE CASCADE` as appropriate.
- [ ] [HIGH] Confirm that no orphaned records exist — test with `DELETE FROM parent WHERE id = X` and verify child constraints prevent it.
- [ ] [MEDIUM] Validate that foreign key indexes are created automatically or explicitly defined in migrations.

### Constraints
- [ ] [CRITICAL] Verify all columns with unique requirements (email, receipt_number, SKU, phone) have unique constraints at the DB level.
- [ ] [HIGH] Confirm that CHECK constraints enforce business rules (quantity >= 0, price > 0, valid status enums).
- [ ] [HIGH] Validate that NOT NULL constraints are applied to all columns that must have values.
- [ ] [MEDIUM] Verify that default values are specified where applicable (created_at defaults to now(), status defaults to 'active').

### Backups
- [ ] [CRITICAL] Verify automated database backups run daily with a 30-day retention period.
- [ ] [HIGH] Confirm that backup files are encrypted at rest (AES-256) and stored in a separate geographic region from the primary database.
- [ ] [HIGH] Validate that backup monitoring alerts if no successful backup has completed in the last 48 hours.
- [ ] [MEDIUM] Verify that logical backups (pg_dump) and physical backups (WAL archiving/PITR) are both configured.

### Restore Testing
- [ ] [CRITICAL] Verify a full database restore is performed and validated in a staging environment monthly.
- [ ] [HIGH] Confirm that restore procedures are documented and tested by at least two team members.
- [ ] [MEDIUM] Validate that point-in-time recovery (PITR) is tested to restore to a specific transaction.

### Connection Pooling
- [ ] [HIGH] Verify that Supabase connection pooling (PgBouncer) is configured with a max pool size appropriate for the instance tier.
- [ ] [HIGH] Confirm that application connections use the pooler's transaction-mode (not session-mode) for web requests.
- [ ] [MEDIUM] Validate that idle connections are recycled after 10 minutes to prevent stale connection accumulation.

### Slow Queries
- [ ] [HIGH] Verify `pg_stat_statements` is enabled to identify slow queries (execution time > 100ms).
- [ ] [HIGH] Confirm that queries are optimized with proper indexes and query plans are reviewed for sequential scans on large tables.
- [ ] [MEDIUM] Validate that the `log_min_duration_statement` is set to 500ms to capture slow queries in logs.
- [ ] [MEDIUM] Verify that slow query alerts are configured in the monitoring system (PagerDuty/email for queries > 5s).

### Transactions
- [ ] [CRITICAL] Verify that all multi-table write operations use BEGIN/COMMIT/ROLLBACK transaction blocks.
- [ ] [HIGH] Confirm that transaction isolation level is set to READ COMMITTED (default) or REPEATABLE READ for critical operations.
- [ ] [MEDIUM] Validate that transactions are kept as short as possible — no user interaction within an open transaction.

### Soft Delete
- [ ] [HIGH] Verify that critical data (customers, products, sales) uses soft deletes with a `deleted_at` timestamp column.
- [ ] [HIGH] Confirm that queries by default filter `WHERE deleted_at IS NULL` — with an explicit opt-in to include deleted records.
- [ ] [MEDIUM] Validate that soft-deleted records are physically purged after a configurable retention period (90 days).

### Migrations
- [ ] [CRITICAL] Verify all schema changes are applied via versioned migration files in `supabase/migrations/` — no manual DDL.
- [ ] [HIGH] Confirm that migrations are tested against a staging database before production application.
- [ ] [HIGH] Validate that destructive migrations (DROP TABLE, DROP COLUMN) are reversible with a down migration.
- [ ] [MEDIUM] Verify that migration files are immutable once applied to production — no retroactive edits.

### Rollback
- [ ] [HIGH] Verify that every migration has a corresponding down migration for rollback.
- [ ] [HIGH] Confirm that rollback procedures are documented and tested in staging before being used in production.
- [ ] [MEDIUM] Validate that rollbacks are tested under load to ensure they complete within the maintenance window.

### Partitioning
- [ ] [HIGH] Verify that large tables (sales, stock_movements, audit_logs) are partitioned by date (monthly or quarterly partitions).
- [ ] [MEDIUM] Confirm that partition pruning works correctly — queries on recent data scan only the current partition.
- [ ] [MEDIUM] Validate that automated partition management (creating new partitions, detaching old ones) is scheduled as a cron job.

### Replication
- [ ] [HIGH] Verify that read replicas are configured if query load exceeds primary capacity (for analytics/reporting queries).
- [ ] [MEDIUM] Confirm that application read/write splitting is implemented — writes go to primary, analytics reads go to replicas.
- [ ] [MEDIUM] Validate that replication lag is monitored and alerts if lag exceeds 30 seconds.

---

## 8. Infrastructure

### Docker
- [ ] [HIGH] Verify Docker images use a specific base image tag (not `:latest`) and are rebuilt on a regular cadence (weekly).
- [ ] [HIGH] Confirm that Docker containers run as a non-root user with the minimum required capabilities.
- [ ] [MEDIUM] Validate that Docker images are scanned for vulnerabilities (Trivy/Snyk) in CI before deployment.
- [ ] [MEDIUM] Verify that multi-stage builds are used to minimize final image size (exclude dev dependencies, build tools).

### Containers
- [ ] [HIGH] Verify container resource limits (CPU, memory) are set — no single container can starve the host.
- [ ] [HIGH] Confirm that containers have health check endpoints (`HEALTHCHECK` instruction) that are monitored by the orchestrator.
- [ ] [MEDIUM] Validate that containers use ephemeral storage — all persistent data is stored in volumes or external services.
- [ ] [MEDIUM] Confirm that container logs are sent to stdout/stderr (Twelve-Factor App) — no log files inside containers.

### Reverse Proxy
- [ ] [CRITICAL] Verify that the reverse proxy (nginx, Cloudflare, Vercel edge) blocks requests with invalid or missing Host headers.
- [ ] [HIGH] Confirm that the reverse proxy enforces HTTPS with a valid TLS certificate (auto-renewed via Let's Encrypt or managed).
- [ ] [HIGH] Validate that HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) are set at the reverse proxy level.
- [ ] [MEDIUM] Verify that the reverse proxy limits request body size, connection timeout, and rate limits before requests reach the application.

### CDN
- [ ] [HIGH] Verify static assets (images, fonts, JS/CSS bundles) are served via CDN with cache headers and long TTL (1 year for fingerprinted assets).
- [ ] [MEDIUM] Confirm that CDN cache purging works and is integrated into the deployment pipeline.
- [ ] [MEDIUM] Validate that the CDN is configured to compress assets (brotli/gzip) and serve the correct Content-Encoding header.

### SSL/TLS
- [ ] [CRITICAL] Verify TLS 1.2 and 1.3 are the only enabled protocols — TLS 1.0 and 1.1 are disabled.
- [ ] [HIGH] Confirm that the TLS certificate uses a strong key (EC 256-bit or RSA 2048-bit minimum).
- [ ] [HIGH] Validate that HSTS header is set with `max-age=31536000; includeSubDomains; preload`.
- [ ] [MEDIUM] Verify that SSL termination health checks pass SSL Labs rating of A+.

### DNS
- [ ] [HIGH] Verify DNS records for the production domain are configured with DNSSEC.
- [ ] [HIGH] Confirm that SPF, DKIM, and DMARC records are configured for the sending email domain.
- [ ] [MEDIUM] Verify that subdomain takeovers are prevented by checking all DNS records point to active services.
- [ ] [MEDIUM] Validate that the production domain has a short TTL (300s) during launch for quick DNS changes.

### Environment Variables
- [ ] [CRITICAL] Verify that all environment variables are validated at application startup (lib/env.ts or Zod schema) — fail fast on missing required vars.
- [ ] [HIGH] Confirm that environment variables are injected via the platform's secrets manager (Vercel Environment Variables, GitHub Secrets) — never in code.
- [ ] [MEDIUM] Validate that default/local development values are documented in `.env.example` with no real secrets.
- [ ] [MEDIUM] Verify that `NODE_ENV=production` is set in all production environments.

### Secrets
- [ ] [CRITICAL] Verify that secrets are rotated at least every 90 days with a documented rotation procedure.
- [ ] [HIGH] Confirm that secrets are never logged, printed in error messages, or exposed in client-side code.
- [ ] [HIGH] Validate that service role keys and admin API keys are scoped to the minimum required permissions at the provider level.
- [ ] [MEDIUM] Verify that a secrets inventory is maintained with owner, rotation date, and access scope for each secret.

### Cloud Storage
- [ ] [CRITICAL] Verify cloud storage buckets (Supabase Storage, S3) have public access blocked by default — access via signed URLs only.
- [ ] [HIGH] Confirm that storage buckets have CORS policies restricting to the application domain.
- [ ] [MEDIUM] Validate that uploaded files are automatically scanned for malware (ClamAV or cloud provider's built-in scanner).
- [ ] [MEDIUM] Verify that storage lifecycle policies automatically delete files in temporary buckets after 7 days.

### Object Storage
- [ ] [HIGH] Verify that object storage has versioning enabled to recover from accidental overwrites or deletions.
- [ ] [MEDIUM] Confirm that storage costs are monitored with alerts set for 80% of the monthly budget.
- [ ] [LOW] Validate that archived objects (older than 90 days) are moved to cold storage tier for cost savings.

### Autoscaling
- [ ] [HIGH] Verify horizontal autoscaling is configured based on CPU/memory/request latency metrics — minimum 2 instances, maximum 10.
- [ ] [HIGH] Confirm that the autoscaling policy includes a cooldown period (300s) to prevent thrashing.
- [ ] [MEDIUM] Validate that load testing has been performed to verify the autoscaler responds correctly under traffic spikes.
- [ ] [MEDIUM] Verify that database connections scale with application instances — connection pool size is adjusted per instance count.

---

## 9. DevOps

### CI
- [ ] [CRITICAL] Verify CI pipeline runs linting, type checking, unit tests, and integration tests on every pull request.
- [ ] [HIGH] Confirm that CI fails on any TypeScript error, lint error, or test failure — no `allow-warnings` or `continue-on-error`.
- [ ] [HIGH] Validate that CI checks for secrets in code (truffleHog, git-secrets) to prevent accidental credential commits.
- [ ] [MEDIUM] Verify CI pipeline completes within 10 minutes — optimize slow steps with caching.
- [ ] [MEDIUM] Confirm that CI artifact caching (node_modules, .next/cache) is configured to reduce build time.

### CD
- [ ] [CRITICAL] Verify deployment to production requires a pull request merged to the main branch — no direct pushes to main.
- [ ] [HIGH] Confirm that the CD pipeline deploys to a staging environment first, runs smoke tests, then promotes to production.
- [ ] [HIGH] Validate that deployment notifications are sent to the team Slack/email channel on start, success, and failure.
- [ ] [MEDIUM] Verify that deployment status is visible in a shared dashboard (GitHub Deployments, Vercel Dashboard).

### GitHub Actions
- [ ] [HIGH] Verify that GitHub Actions workflows do not use `pull_request_target` with write permissions (token theft risk).
- [ ] [HIGH] Confirm that CI/CD secrets are stored as GitHub Actions secrets — never committed in workflow files.
- [ ] [MEDIUM] Validate that third-party actions are pinned to a specific commit SHA (not a version tag) for supply-chain security.
- [ ] [MEDIUM] Verify that workflow permissions are scoped to the minimum required (`contents: read`, `pull-requests: write`).

### Builds
- [ ] [HIGH] Verify that the production build (`npm run build`) completes without warnings or errors.
- [ ] [HIGH] Confirm that the build process generates source maps for production debugging but they are not publicly accessible.
- [ ] [MEDIUM] Validate that bundle size is analyzed on each build — alerts if any chunk exceeds 500KB (gzipped).

### Rollback
- [ ] [CRITICAL] Verify a one-click rollback procedure exists and is tested — can revert to the previous deployment within 5 minutes.
- [ ] [HIGH] Confirm that the rollback includes database migrations (reversible down migrations).
- [ ] [MEDIUM] Validate that rollback is tested in staging at least once per sprint.

### Feature Flags
- [ ] [HIGH] Verify that feature flags (not branch deployments) control access to in-development features.
- [ ] [HIGH] Confirm that feature flags can be toggled per environment, per branch, and per user without code changes or redeployment.
- [ ] [MEDIUM] Validate that stale feature flags are cleaned up after the feature is fully released (remove flag + conditional code).

### Blue-Green Deployment
- [ ] [HIGH] Verify that blue-green deployment is configured (or verifiable via Vercel's instant promotion) — zero-downtime deploys.
- [ ] [MEDIUM] Confirm that the inactive environment (blue or green) can receive traffic for pre-warming before cutover.

### Canary Releases
- [ ] [HIGH] Verify that canary releases can route a percentage of traffic (5%, 25%, 50%, 100%) to a new version.
- [ ] [HIGH] Confirm that error rate and latency monitoring is in place to automatically roll back a canary that degrades metrics.
- [ ] [MEDIUM] Validate that canary releases are verified by manual QA before full roll-out.

### Preview Deployments
- [ ] [MEDIUM] Verify that every pull request gets an ephemeral preview deployment for manual QA review.
- [ ] [MEDIUM] Confirm that preview deployments use a separate database (or schema) to avoid interfering with production data.
- [ ] [LOW] Validate that preview deployments are automatically cleaned up after the pull request is merged or closed.

---

## 10. Monitoring

### Metrics
- [ ] [CRITICAL] Verify that key business metrics (sales per minute, active users, payment success rate) are collected and visualized.
- [ ] [HIGH] Confirm that system metrics (CPU, memory, request latency, error rate) are collected with 1-minute granularity.
- [ ] [HIGH] Validate that metrics are retained for at least 90 days for trend analysis (30 days for raw data, 90 days for rolled-up).
- [ ] [MEDIUM] Verify that custom business metrics (inventory turnover, average order value, shift closure rate) are defined and tracked.

### Logs
- [ ] [CRITICAL] Verify that all application logs are shipped to a centralized log management system (Logtail, Grafana Loki, or similar).
- [ ] [HIGH] Confirm logs are searchable with full-text indexing and structured field filtering (by level, service, user_id, trace_id).
- [ ] [HIGH] Validate that log retention is configured (30 days for debug/info, 90 days for warnings, 1 year for errors and audit logs).
- [ ] [MEDIUM] Verify that log ingress is rate-limited to prevent log flooding from crashing the logging pipeline.

### Distributed Tracing
- [ ] [HIGH] Verify that distributed tracing is implemented across the stack — frontend → API → database/external services.
- [ ] [HIGH] Confirm that every request has a unique trace ID propagated via headers and included in all log entries.
- [ ] [MEDIUM] Validate that traces are sampled at 100% for error traces and 10% for successful traces.

### Sentry
- [ ] [CRITICAL] Verify Sentry (or equivalent) is configured for both frontend and backend error tracking.
- [ ] [HIGH] Confirm that Sentry alerts are configured for new errors, error spikes, and regressions.
- [ ] [HIGH] Validate that PII is stripped from Sentry events (configure `beforeSend` to redact sensitive fields).
- [ ] [MEDIUM] Verify that source maps are uploaded to Sentry for readable stack traces in production.
- [ ] [MEDIUM] Confirm that Sentry performance tracing is enabled to identify slow transactions and N+1 queries.

### Prometheus
- [ ] [HIGH] Verify that Prometheus metrics endpoint is exposed (`/api/metrics` or `/metrics`) for self-hosted monitoring.
- [ ] [MEDIUM] Confirm that custom Prometheus metrics are defined for business-level indicators (sales, active shifts, stock alerts).
- [ ] [MEDIUM] Validate that Prometheus is scraping metrics at 15s intervals with appropriate storage capacity.

### Grafana
- [ ] [HIGH] Verify that a Grafana dashboard exists for each major domain (Sales, Inventory, System Health, Business KPIs).
- [ ] [HIGH] Confirm that Grafana dashboards are version-controlled and deployed via code (not created manually in the UI).
- [ ] [MEDIUM] Validate that Grafana alert rules are configured for all critical metrics with appropriate thresholds.
- [ ] [LOW] Verify that Grafana dashboards are accessible to stakeholders with read-only view permissions.

### Health Checks
- [ ] [CRITICAL] Verify that `/api/health` endpoint checks database connectivity, external service reachability, and Redis connection.
- [ ] [HIGH] Confirm that the health check returns a 503 status code with a detailed JSON body when any dependency is unhealthy.
- [ ] [HIGH] Validate that health checks are called by the platform's load balancer (Vercel, Cloudflare) for routing decisions.
- [ ] [MEDIUM] Verify that synthetic health checks run from an external monitoring service (Pingdom, Better Uptime) every 60 seconds.

### Synthetic Monitoring
- [ ] [HIGH] Verify that critical user journeys (login, create sale, process payment, generate report) are tested via synthetic monitoring every 5 minutes.
- [ ] [HIGH] Confirm that synthetic monitors assert on specific DOM elements or API responses, not just HTTP 200 status.
- [ ] [MEDIUM] Validate that synthetic tests run from multiple geographic regions to verify global availability.

### Alerts
- [ ] [CRITICAL] Verify that PagerDuty/on-call alerts are configured for 5xx error rate > 1%, P99 latency > 5s, and payment failure rate > 2%.
- [ ] [HIGH] Confirm that alert fatigue is minimized by grouping related alerts and setting appropriate thresholds.
- [ ] [HIGH] Validate that alerts have runbooks attached with investigation steps and remediation procedures.
- [ ] [MEDIUM] Verify that alert notification channels include email, Slack, and PagerDuty with escalation policies.

### Incident Response
- [ ] [HIGH] Verify that an incident response runbook exists with severity definitions, communication templates, and escalation paths.
- [ ] [HIGH] Confirm that the on-call rotation is defined and team members are trained on incident response procedures.
- [ ] [MEDIUM] Validate that post-incident reviews are conducted within 48 hours with documented action items.
- [ ] [MEDIUM] Verify that incidents are tracked with a status page (or GitHub Issues with incident labels) visible to stakeholders.

---

## 11. Performance

### Lighthouse
- [ ] [HIGH] Verify Lighthouse scores are above 90 for Performance, Accessibility, Best Practices, and SEO on the login and dashboard pages.
- [ ] [MEDIUM] Confirm that Lighthouse CI is run in the CI pipeline to prevent regressions.
- [ ] [LOW] Validate that Performance budget is defined (< 2s Time to Interactive, < 200KB critical CSS).

### Core Web Vitals
- [ ] [CRITICAL] Verify Largest Contentful Paint (LCP) is below 2.5 seconds on the POS and dashboard pages.
- [ ] [HIGH] Confirm First Input Delay (FID) / Interaction to Next Paint (INP) is below 200ms.
- [ ] [HIGH] Validate Cumulative Layout Shift (CLS) is below 0.1 — no unexpected layout shifts after page load.
- [ ] [MEDIUM] Verify that Core Web Vitals are monitored via Real User Monitoring (RUM) — not just lab tests.

### Image Optimization
- [ ] [HIGH] Verify all images use `next/image` with explicit `width`, `height`, and `quality` attributes.
- [ ] [HIGH] Confirm that images are served in modern formats (WebP, AVIF) with appropriate fallbacks.
- [ ] [MEDIUM] Validate that large images (>100KB) are replaced with compressed, responsive versions.
- [ ] [MEDIUM] Verify that decorative images use `loading="lazy"` and critical images use `loading="eager"` with `priority`.

### Caching
- [ ] [HIGH] Verify that API responses for GET endpoints have appropriate `Cache-Control` headers (public with max-age for static data, private/no-cache for user-specific data).
- [ ] [HIGH] Confirm that server-side data cache (`unstable_cache` or React cache) is used for expensive database queries.
- [ ] [MEDIUM] Validate that the Next.js Full Route Cache (static rendering) is used for pages that don't change frequently.
- [ ] [MEDIUM] Verify that stale-while-revalidate patterns are used for data that can tolerate stale reads.

### Compression
- [ ] [HIGH] Verify Brotli compression is enabled for text-based responses (HTML, JS, CSS, JSON, SVG).
- [ ] [MEDIUM] Confirm that compression level is set appropriately (level 5 for Brotli, level 6 for gzip — balance of ratio and speed).

### Lazy Loading
- [ ] [HIGH] Verify that routes and components not on the critical path are lazy-loaded with `next/dynamic`.
- [ ] [MEDIUM] Confirm that intersection observer is used for lazy-loading below-the-fold content.
- [ ] [MEDIUM] Validate that heavy interactive components (charts, maps, code editors) are loaded only when the user scrolls to them.

### Streaming
- [ ] [HIGH] Verify that server-side rendering uses React Suspense streaming to reduce Time to First Byte (TTFB).
- [ ] [MEDIUM] Confirm that streaming is used for long-running data fetches — content is rendered progressively as data arrives.
- [ ] [MEDIUM] Validate that loading fallbacks are meaningful (skeleton components) during streaming.

### Edge Functions
- [ ] [HIGH] Verify that edge functions are used for low-latency geographically distributed operations (auth checks, redirects, header manipulation).
- [ ] [MEDIUM] Confirm that heavy computation is kept off the edge — edge functions should be lightweight (< 10ms execution).
- [ ] [MEDIUM] Validate that edge functions can access the database via connection pooler for read operations.

### Memory Leaks
- [ ] [CRITICAL] Verify that `useEffect` cleanup functions properly cancel subscriptions, timers, and abort fetch requests.
- [ ] [HIGH] Confirm that event listeners on `window` and `document` are cleaned up on component unmount.
- [ ] [MEDIUM] Validate that large data sets in component state are cleared when the component unmounts (no retained references).
- [ ] [MEDIUM] Verify that memory usage is profiled in Chrome DevTools — no heap growth over a 30-minute session.

### Bundle Size
- [ ] [HIGH] Verify the main JS bundle is below 150KB (gzipped) — use `next/bundle-analyzer` to verify.
- [ ] [HIGH] Confirm that large dependencies (moment.js, lodash) are replaced with tree-shakeable alternatives (date-fns, lodash-es).
- [ ] [MEDIUM] Validate that CSS bundle size is below 50KB (gzipped) — Tailwind CSS purge is working correctly.
- [ ] [MEDIUM] Verify that webpack/Next.js bundle analysis is run in CI and alerts on significant size increases.

---

## 12. Security

### OWASP Top 10 — Broken Access Control
- [ ] [CRITICAL] Verify that all API endpoints enforce authorization checks before processing requests (check #2).
- [ ] [CRITICAL] Verify that CORS is configured with a strict allowlist (single production origin) — no `Access-Control-Allow-Origin: *`.
- [ ] [HIGH] Confirm that mass assignment vulnerabilities are closed — API input is mapped to DTOs, not directly to DB models.
- [ ] [HIGH] Validate that `DELETE` and `PATCH` operations verify ownership before mutating records.

### OWASP Top 10 — Cryptographic Failures
- [ ] [CRITICAL] Verify all data in transit is encrypted with TLS 1.2+ (check #3).
- [ ] [CRITICAL] Verify that all passwords, API keys, and tokens are hashed (bcrypt/Argon2id) — never stored in plaintext.
- [ ] [HIGH] Confirm that sensitive data at rest (PII, financial data) is encrypted with AES-256-GCM.
- [ ] [MEDIUM] Validate that encryption keys are managed via a KMS (AWS KMS, Vault, or cloud provider's key management) — not in application code.
- [ ] [MEDIUM] Verify that credit card data is never stored or processed directly (use Stripe Elements or similar tokenization).

### OWASP Top 10 — Injection
- [ ] [CRITICAL] Verify that all SQL queries use parameterized statements or ORM query builders (check #4).
- [ ] [CRITICAL] Verify that all user input rendered in HTML is escaped (React JSX auto-escaping) or sanitized (DOMPurify).
- [ ] [HIGH] Confirm that NoSQL injection vectors are closed (operator injection prevention).
- [ ] [MEDIUM] Validate that command injection is prevented — no shell execution from user input.

### OWASP Top 10 — Insecure Design
- [ ] [CRITICAL] Verify that rate limiting and abuse prevention is built into the API design — not retrofitted (check #5).
- [ ] [HIGH] Confirm that business logic flaws are tested (negative prices, double discounts, race conditions in inventory).
- [ ] [MEDIUM] Validate that threat modeling was performed for critical flows (payment, user registration, financial reporting).

### OWASP Top 10 — Security Misconfiguration
- [ ] [CRITICAL] Verify that default credentials are changed and default features are disabled (check #6).
- [ ] [HIGH] Confirm that directory listing is disabled on all web servers and storage buckets.
- [ ] [HIGH] Validate that unnecessary HTTP methods (TRACE, CONNECT, PUT) are disabled at the reverse proxy.
- [ ] [MEDIUM] Verify that debug endpoints / debug mode are disabled in production.
- [ ] [MEDIUM] Confirm that security-related HTTP headers are set (see CSP, HSTS, X-Frame-Options below).

### OWASP Top 10 — Vulnerable Components
- [ ] [CRITICAL] Verify that all third-party dependencies are scanned for known vulnerabilities via `npm audit` or Snyk (check #7).
- [ ] [HIGH] Confirm that the dependency update policy requires critical CVEs to be patched within 48 hours.
- [ ] [HIGH] Validate that unused dependencies are removed — `depcheck` or similar is run in CI.
- [ ] [MEDIUM] Verify that base Docker images are scanned and updated weekly.
- [ ] [MEDIUM] Confirm that Node.js, npm, and system packages are kept up to date with security patches.

### OWASP Top 10 — Authentication Failures
- [ ] [CRITICAL] Verify that authentication failures do not reveal whether the username, email, or password was incorrect (check #8).
- [ ] [CRITICAL] Verify that session tokens are invalidated on logout, password change, and role change.
- [ ] [HIGH] Confirm that MFA is enforced for administrative accounts.
- [ ] [MEDIUM] Validate that credential stuffing protection is in place (rate limiting + CAPTCHA).

### OWASP Top 10 — Data Integrity Failures
- [ ] [CRITICAL] Verify that software supply chain is secure — CI/CD pipeline is hardened, dependencies are signed (check #9).
- [ ] [HIGH] Confirm that unsigned or untrusted third-party scripts are not loaded in the browser.
- [ ] [MEDIUM] Validate that subresource integrity (SRI) hashes are used for external scripts.
- [ ] [MEDIUM] Verify that CSP includes `require-trusted-types-for 'script'` to prevent DOM XSS.

### OWASP Top 10 — Logging & Monitoring
- [ ] [CRITICAL] Verify that all authentication attempts (success and failure), privilege escalations, and admin actions are logged (check #10).
- [ ] [HIGH] Confirm that log monitoring alerts on suspicious patterns (10+ failed logins in 1 minute, access from unusual geographies).
- [ ] [HIGH] Validate that audit logs are tamper-proof (append-only, stored in a separate logging service).
- [ ] [MEDIUM] Verify that logs contain sufficient context (user ID, IP, timestamp, action) without storing PII.

### OWASP Top 10 — SSRF
- [ ] [CRITICAL] Verify that the application validates and sanitizes any URLs provided by users before making HTTP requests (check #11).
- [ ] [HIGH] Confirm that internal network ranges and metadata endpoints are blocked from outbound requests.
- [ ] [MEDIUM] Validate that webhook URL validation strips credentials (username:password) and rejects non-HTTPS URLs.

### Content Security Policy (CSP)
- [ ] [CRITICAL] Verify that a strict CSP is deployed: `default-src 'self'` with explicit `script-src`, `style-src`, `img-src`, `connect-src`.
- [ ] [HIGH] Confirm that `script-src` does not include `'unsafe-inline'` or `'unsafe-eval'` — use nonces or hashes for inline scripts.
- [ ] [HIGH] Validate that CSP is tested in report-only mode first, then enforced after confirming no violations.
- [ ] [MEDIUM] Verify that CSP violation reports are sent to a reporting endpoint (`report-uri` / `report-to`).

### HSTS
- [ ] [CRITICAL] Verify that the `Strict-Transport-Security` header is set with `max-age=31536000; includeSubDomains; preload`.
- [ ] [HIGH] Confirm that the domain is submitted to the HSTS preload list (hstspreload.org).

### CSRF
- [ ] [CRITICAL] Verify that state-changing requests use CSRF tokens (Double Submit Cookie or Synchronizer Token pattern).
- [ ] [HIGH] Confirm that SameSite cookies are set to `Lax` (default) or `Strict` for session cookies.
- [ ] [MEDIUM] Validate that anti-CSRF tokens are bound to the user session and validated server-side.

### XSS
- [ ] [CRITICAL] Verify that CSP blocks inline scripts and `eval()` — see CSP section above.
- [ ] [HIGH] Confirm that all user-generated content (product names, notes, customer names) is rendered as text (not HTML).
- [ ] [HIGH] Validate that `dangerouslySetInnerHTML` is never used with user-supplied data — if used, DOMPurify is applied server-side.
- [ ] [MEDIUM] Verify that reflected XSS is prevented — URL parameters are encoded when rendered in the page.

### SQL Injection
- [ ] [CRITICAL] Verify that all database queries use parameterized statements or ORM query builders — see Input Validation section.

### SSRF
- [ ] [HIGH] Verify that the application does not make requests to user-supplied URLs without validation.
- [ ] [MEDIUM] Confirm that webhook endpoint URLs are validated against an allowlist of protocols (HTTPS only) and domains.

### Secrets Management
- [ ] [CRITICAL] Verify that production secrets are stored in a secrets manager (Vercel Environment Variables, GitHub Secrets, HashiCorp Vault).
- [ ] [HIGH] Confirm that secrets are never hardcoded in source code, environment files, or Docker images.
- [ ] [HIGH] Validate that secrets are rotated on a regular schedule (90 days) and immediately on compromise.
- [ ] [MEDIUM] Verify that only the minimum required secrets are available to each environment (dev does not have production secrets).

### Dependency Scanning
- [ ] [HIGH] Verify that dependency scanning (Snyk, Dependabot, or GitHub Security) is configured for all repositories.
- [ ] [HIGH] Confirm that automated pull requests are generated for dependency updates with security fixes.
- [ ] [MEDIUM] Validate that scanning is extended to Docker images and infrastructure-as-code files.

### Vulnerability Management
- [ ] [CRITICAL] Verify that a vulnerability management process is documented — including severity classification, SLA for remediation, and reporting.
- [ ] [HIGH] Confirm that critical and high severity vulnerabilities are patched within 72 hours of disclosure.
- [ ] [MEDIUM] Validate that regular penetration testing (at least annually) is conducted by an external firm.

### Encryption in Transit
- [ ] [CRITICAL] Verify that all traffic between the client and server is encrypted with TLS 1.2 minimum.
- [ ] [HIGH] Confirm that internal service-to-service communication is also encrypted (mTLS or at least TLS).
- [ ] [MEDIUM] Validate that database connections use TLS (Supabase connections are encrypted by default).

### Encryption at Rest
- [ ] [HIGH] Verify that the database is encrypted at rest (enabled by default on Supabase/cloud providers).
- [ ] [HIGH] Confirm that file storage (Supabase Storage, S3) uses server-side encryption (AES-256).
- [ ] [MEDIUM] Validate that backup files are encrypted before they leave the source environment.

### Key Rotation
- [ ] [HIGH] Verify that encryption keys are rotated every 90 days with a documented key rotation procedure.
- [ ] [MEDIUM] Confirm that key rotation does not require downtime — read old key, write new key, retire old key.

### Audit Logging
- [ ] [CRITICAL] Verify that all financial transactions, user creations, role changes, and permission changes are logged with immutable audit trails.
- [ ] [HIGH] Confirm that audit logs include who, what, when, where (IP), and the before/after state of the changed data.
- [ ] [HIGH] Validate that audit logs cannot be modified or deleted by any application user — append-only at the database level.
- [ ] [MEDIUM] Verify that audit logs are retained for a minimum of 7 years (regulatory requirement for financial data).

### Brute-Force Protection
- [ ] [HIGH] Verify that login endpoint has rate limiting (5 attempts per minute per IP).
- [ ] [HIGH] Confirm that account lockout is enforced after 10 failed attempts with an escalating lockout duration (15 min, 1 hour, 24 hours).
- [ ] [MEDIUM] Validate that CAPTCHA is triggered after 3 failed attempts from the same IP.
- [ ] [MEDIUM] Verify that password reset and MFA setup endpoints have separate rate limits.

### Bot Protection
- [ ] [HIGH] Verify that bot detection (rate limiting, CAPTCHA, User-Agent analysis) is configured for login and registration endpoints.
- [ ] [MEDIUM] Confirm that API endpoints are protected against automated scraping (rate limiting, request pattern analysis).
- [ ] [MEDIUM] Validate that form submissions include a honeypot field to catch automated bot submissions.

### DDoS Resilience
- [ ] [HIGH] Verify DDoS protection is enabled at the CDN/edge level (Cloudflare, Vercel DDoS, or AWS Shield).
- [ ] [HIGH] Confirm that rate limiting is configured at multiple layers (edge, application, database).
- [ ] [MEDIUM] Validate that the application can handle 3x normal traffic load without degradation (tested via load testing).

### Supply-Chain Security
- [ ] [CRITICAL] Verify that all CI/CD pipeline steps are pinned to specific commit SHAs (not version tags) to prevent supply-chain attacks.
- [ ] [HIGH] Confirm that npm packages are verified with lockfiles (`package-lock.json` is committed) and `npm audit` passes.
- [ ] [HIGH] Validate that no untrusted third-party scripts or CDN resources are loaded in the application.
- [ ] [MEDIUM] Verify that GitHub branch protection rules require PR reviews, status checks, and signed commits for the main branch.

### Secure Configuration
- [ ] [HIGH] Verify that the Supabase project has MFA enabled for the Supabase dashboard login.
- [ ] [HIGH] Confirm that database connection strings use the pooled connection string (transaction mode) for web applications.
- [ ] [MEDIUM] Validate that the application does not run with root/administrator privileges — dedicated service account with minimum permissions.
- [ ] [MEDIUM] Verify that unused ports, services, and features are disabled on the production server/container.

---

## 13. Testing

### Unit Tests
- [ ] [CRITICAL] Verify that all server actions (`lib/*-actions.ts`) have unit tests covering success and failure paths.
- [ ] [HIGH] Confirm that business logic functions (tax calculation, discount computation, loyalty points) have 100% branch coverage.
- [ ] [HIGH] Validate that utility functions (formatting, validation, encryption) have unit tests with edge cases.
- [ ] [MEDIUM] Verify that test files are co-located with the source code (`*.test.ts` or `tests/` directory mirroring the source).
- [ ] [MEDIUM] Confirm that unit tests run in CI and block PRs on failure.

### Integration Tests
- [ ] [CRITICAL] Verify that critical user flows (login → create sale → process payment → generate receipt) have integration tests.
- [ ] [HIGH] Confirm that database integration tests use a test database or transaction rollback to isolate test data.
- [ ] [HIGH] Validate that external API integrations (Stripe, Resend, Africa's Talking) are tested with mocked HTTP responses.
- [ ] [MEDIUM] Verify that module-layer adapters (`lib/modules/*`) have integration tests with real database queries.

### End-to-End Tests
- [ ] [CRITICAL] Verify that the core business flow (open POS → scan product → process payment → print receipt) has an E2E test.
- [ ] [HIGH] Confirm that E2E tests run against a staging environment (not local) with production-like data.
- [ ] [MEDIUM] Validate that Playwright/Cypress tests cover mobile viewport and desktop viewport.
- [ ] [MEDIUM] Verify that E2E tests are run nightly and results are reported to the team.

### Load Testing
- [ ] [CRITICAL] Verify that the POS payment endpoint handles 50 concurrent requests without errors or degradation.
- [ ] [HIGH] Confirm that the inventory search endpoint handles 100 QPS (queries per second) with P99 latency under 500ms.
- [ ] [HIGH] Validate that the sales history API handles pagination under load (100 concurrent users browsing history).
- [ ] [MEDIUM] Verify that load testing results are documented with baseline metrics and saturation points.

### Stress Testing
- [ ] [HIGH] Verify that the application gracefully degrades under 5x normal traffic — returns 503 (not crashes or data corruption).
- [ ] [HIGH] Confirm that the database connection pool does not exhaust under stress — queries queue with acceptable wait times.
- [ ] [MEDIUM] Validate that the application recovers to normal operation within 60 seconds after load subsides.

### Accessibility Testing
- [ ] [HIGH] Verify that the login, POS, and dashboard pages pass axe-core automated accessibility audits.
- [ ] [MEDIUM] Confirm that keyboard-only navigation is tested for all major workflows.
- [ ] [MEDIUM] Validate that screen reader (NVDA/VoiceOver) testing is performed on the POS checkout flow.

### Security Testing
- [ ] [CRITICAL] Verify that OWASP ZAP or Burp Suite scanning is performed on the staging environment.
- [ ] [HIGH] Confirm that automated security scanning (SAST) is integrated into CI (ESLint security plugins, SonarQube).
- [ ] [MEDIUM] Validate that dependency scanning (SCA) is configured and alerts on new CVEs.

### Regression Testing
- [ ] [HIGH] Verify that a regression test suite runs on every deployment to staging.
- [ ] [HIGH] Confirm that regression tests cover all previously fixed bugs (each bug fix includes a regression test).
- [ ] [MEDIUM] Validate that visual regression testing (Percy, Chromatic) is configured for UI components.

### Snapshot Testing
- [ ] [MEDIUM] Verify that critical UI components have snapshot tests to detect unintended UI changes.
- [ ] [MEDIUM] Confirm that snapshot tests are reviewed when they fail — snapshots are updated deliberately, not automatically.
- [ ] [LOW] Validate that snapshot files are small (under 50KB) and included in code review.

### Visual Testing
- [ ] [MEDIUM] Verify that visual regression tests cover the POS checkout flow, dashboard, and invoice print views.
- [ ] [MEDIUM] Confirm that visual tests run on multiple viewports (mobile, tablet, desktop) to catch responsive layout issues.
- [ ] [LOW] Validate that theme switching (light/dark mode) is tested visually for contrast and readability.

### Mutation Testing
- [ ] [MEDIUM] Verify that mutation testing (Stryker) is performed on critical modules (payment, inventory, auth) to validate test quality.
- [ ] [LOW] Confirm that the mutation score is above 80% for business logic modules.

---

## 14. Emails

### SPF
- [ ] [HIGH] Verify that an SPF TXT record exists for the sending domain (include Resend/email provider's SPF servers).
- [ ] [MEDIUM] Confirm that SPF record uses `-all` (hard fail) — not `~all` (soft fail).

### DKIM
- [ ] [HIGH] Verify that DKIM is configured with a 2048-bit key for the sending domain.
- [ ] [MEDIUM] Confirm that DKIM signatures are verified by checking email headers in test deliveries.

### DMARC
- [ ] [HIGH] Verify that a DMARC policy (`p=quarantine` or `p=reject`) is configured with a reporting email address.
- [ ] [MEDIUM] Confirm that DMARC aggregate reports are monitored for unauthorized sending sources.
- [ ] [MEDIUM] Validate that the `pct=100` (100% of messages) is configured.

### Templates
- [ ] [HIGH] Verify that all transactional email templates (receipt, invoice, password reset, welcome) are responsive and readable.
- [ ] [HIGH] Confirm that email templates include the business name, physical address, and unsubscribe link (CAN-SPAM compliance).
- [ ] [MEDIUM] Validate that email templates are tested in major clients (Gmail, Outlook, Apple Mail) for rendering.
- [ ] [MEDIUM] Verify that template variables are escaped to prevent injection in email rendering.

### Retries
- [ ] [HIGH] Verify that email sending has retry logic with exponential backoff (3 retries: 30s, 2min, 10min).
- [ ] [MEDIUM] Confirm that emails that fail after all retries are logged and flagged for manual review.

### Bounce Handling
- [ ] [HIGH] Verify that bounced emails are processed via webhook (Resend bounce webhook) and the user's email is flagged.
- [ ] [MEDIUM] Confirm that repeated bounces (3+) automatically disable email notifications for that user.
- [ ] [MEDIUM] Validate that hard bounces (invalid email) update the user's email status to `invalid`.

### Unsubscribe
- [ ] [HIGH] Verify that all marketing/bulk emails include a one-click unsubscribe link (CAN-SPAM compliance).
- [ ] [MEDIUM] Confirm that transactional emails (receipts, invoices, password resets) are not required to include unsubscribe links.
- [ ] [MEDIUM] Validate that unsubscribe preferences are respected immediately and persisted in the user's profile.

---

## 15. File Uploads

### Virus Scanning
- [ ] [CRITICAL] Verify that all uploaded files are scanned for malware before being stored or served.
- [ ] [HIGH] Confirm that infected files are quarantined (not deleted) for analysis and the uploader is notified.
- [ ] [MEDIUM] Validate that virus scanning is performed by an industry-standard engine (ClamAV or cloud provider's built-in scanner).

### Extension Validation
- [ ] [HIGH] Verify that uploaded file extensions are validated against a strict allowlist (not a blocklist).
- [ ] [HIGH] Confirm that extension validation is case-insensitive and double extensions are rejected (`.jpg.php`, `.php.jpg`).
- [ ] [MEDIUM] Validate that MIME type detection uses content inspection (not just the declared Content-Type header).

### Size Limits
- [ ] [HIGH] Verify that individual file size limits are enforced (10MB max for documents, 5MB for images).
- [ ] [MEDIUM] Confirm that total upload size per request is limited (50MB max per upload request).

### Storage Security
- [ ] [CRITICAL] Verify that uploaded files are stored outside the web root and served via signed URLs with expiration (1 hour).
- [ ] [HIGH] Confirm that stored filenames use UUIDs (not original filenames) to prevent path traversal and name collision.
- [ ] [HIGH] Validate that storage bucket policies block public read access — every file access requires authentication and authorization.

### Image Optimization
- [ ] [HIGH] Verify that uploaded images are automatically resized to maximum dimensions (1920px width for photos, 200px for avatars).
- [ ] [HIGH] Confirm that images are converted to WebP/AVIF format for storage (with original kept for 30 days).
- [ ] [MEDIUM] Validate that EXIF metadata is stripped from uploaded images to prevent data leakage.

### Duplicate Detection
- [ ] [MEDIUM] Verify that file content hash (SHA-256) is computed on upload to detect duplicate files.
- [ ] [MEDIUM] Confirm that duplicate files are deduplicated at the storage level (same file stored once with multiple references).

---

## 16. Accessibility

### Screen Readers
- [ ] [CRITICAL] Verify that all form inputs, buttons, and controls have accessible names (label, aria-label, or aria-labelledby).
- [ ] [HIGH] Confirm that dynamic content updates (toast notifications, modal dialogs, live search results) are announced by screen readers via `aria-live` regions.
- [ ] [HIGH] Validate that all images have appropriate `alt` text — decorative images use `alt=""` (empty), informational images have descriptive alt text.
- [ ] [MEDIUM] Verify that complex data tables have proper `<th>` scope attributes and `aria-describedby` for summaries.
- [ ] [MEDIUM] Confirm that custom UI components (select, dropdown, date picker) have the correct ARIA roles and states.

### Contrast
- [ ] [HIGH] Verify that text has a minimum contrast ratio of 4.5:1 against its background (WCAG AA) for normal text.
- [ ] [HIGH] Confirm that large text (18px+ bold or 24px+ regular) has a 3:1 minimum contrast ratio.
- [ ] [MEDIUM] Validate that UI components (buttons, input borders) have a 3:1 contrast ratio against adjacent colors.
- [ ] [MEDIUM] Verify that both light and dark themes pass contrast requirements.

### ARIA
- [ ] [HIGH] Verify that ARIA attributes are used correctly — no redundant ARIA (native HTML semantics are preferred).
- [ ] [HIGH] Confirm that custom interactive controls have appropriate `role`, `aria-label`, `aria-expanded`, `aria-controls`, and `aria-selected` attributes.
- [ ] [MEDIUM] Validate that ARIA live regions (`aria-live="polite"`) are used for toast notifications and dynamic content updates.

### Keyboard Navigation
- [ ] [CRITICAL] Verify that all interactive elements are reachable and operable via keyboard (Tab, Enter, Escape, Arrow keys).
- [ ] [HIGH] Confirm that visual focus indicators are visible (not `outline: none` without a replacement).
- [ ] [HIGH] Validate that tab order follows the visual layout (no `tabindex` values > 0).
- [ ] [MEDIUM] Verify that skip-to-content links are present at the top of each page.
- [ ] [MEDIUM] Confirm that modal dialogs trap focus and return it to the trigger element on close.

### Focus States
- [ ] [HIGH] Verify that all focusable elements have a visible focus ring (at least 2px solid with 3:1 contrast).
- [ ] [MEDIUM] Confirm that custom focus styles are consistent across the application (not per-component).
- [ ] [MEDIUM] Validate that `:focus-visible` is used for keyboard focus, `:focus` for mouse focus (WCAG 2.4.7).

### Reduced Motion
- [ ] [HIGH] Verify that animations respect the `prefers-reduced-motion` media query — disable non-essential animations.
- [ ] [MEDIUM] Confirm that confetti and celebratory animations in the POS success screen respect reduced-motion preferences.
- [ ] [MEDIUM] Validate that transitions and animations are removed or simplified when reduced motion is preferred.

---

## 17. SEO

### Sitemap
- [ ] [HIGH] Verify that a `sitemap.xml` is generated dynamically (or statically for public pages) and submitted to search engines.
- [ ] [MEDIUM] Confirm that the sitemap only includes pages intended for public indexing (exclude admin, dashboard, POS).
- [ ] [MEDIUM] Validate that the sitemap is referenced in `robots.txt`.

### robots.txt
- [ ] [HIGH] Verify that `robots.txt` blocks crawling of private sections (`/admin`, `/dashboard`, `/pos`, `/api/`).
- [ ] [MEDIUM] Confirm that the sitemap URL is referenced in `robots.txt`.

### Canonical URLs
- [ ] [HIGH] Verify that all public-facing pages have a `rel="canonical"` link tag pointing to the preferred URL.
- [ ] [MEDIUM] Confirm that duplicate content (same page with different URL parameters) has a canonical URL.

### OpenGraph
- [ ] [HIGH] Verify that the login, landing, and public-facing pages have `og:title`, `og:description`, `og:image`, and `og:url` meta tags.
- [ ] [MEDIUM] Confirm that OpenGraph image is at least 1200x630px and loads quickly.

### Twitter Cards
- [ ] [MEDIUM] Verify that `twitter:card`, `twitter:title`, `twitter:description`, and `twitter:image` meta tags are set.
- [ ] [LOW] Confirm that `twitter:card` is set to `summary_large_image` for public-facing pages.

### Structured Data
- [ ] [MEDIUM] Verify that structured data (JSON-LD) is present for the organization (LocalBusiness), products (if public catalog), and articles.
- [ ] [MEDIUM] Confirm that structured data is validated with Google's Rich Results Test.
- [ ] [LOW] Validate that breadcrumb structured data is implemented for navigation paths.

### Meta Tags
- [ ] [HIGH] Verify that every page has a unique `<title>` tag (60 characters max) and `<meta name="description">` (160 characters max).
- [ ] [MEDIUM] Confirm that meta tags use the correct locale and language (`og:locale: en_KE` for Kenyan English).
- [ ] [LOW] Validate that `viewport` meta tag is set to `width=device-width, initial-scale=1`.

---

## 18. Analytics

### Events
- [ ] [HIGH] Verify that key business events are tracked: page views, logins, sale completions, payment failures, report generations.
- [ ] [HIGH] Confirm that analytics events are sent from the server side for critical events (sale created, payment processed) to ensure reliability.
- [ ] [MEDIUM] Validate that event payloads include relevant metadata (user role, branch, amount) without PII.
- [ ] [MEDIUM] Verify that analytics tracking library is loaded asynchronously and does not block page rendering.

### Funnels
- [ ] [HIGH] Verify that the checkout funnel is tracked (add item → proceed to payment → select method → complete payment → receipt).
- [ ] [MEDIUM] Confirm that funnel abandonment rates are monitored — alerts for > 50% drop-off between any two steps.
- [ ] [MEDIUM] Validate that funnel analysis can be filtered by branch, user role, and payment method.

### Consent
- [ ] [HIGH] Verify that cookie consent and analytics tracking consent is obtained before loading analytics scripts (GDPR compliance).
- [ ] [MEDIUM] Confirm that the consent choice is stored and respected across sessions.

### Privacy
- [ ] [HIGH] Verify that IP addresses are anonymized before being sent to analytics (last octet removed or zeroed).
- [ ] [HIGH] Confirm that no PII (name, email, phone, user ID) is sent as event properties to analytics services.
- [ ] [MEDIUM] Validate that analytics data retention is configured to 26 months (Google Analytics) or equivalent.

### Retention
- [ ] [MEDIUM] Verify that raw analytics event data is retained for 14 months for trend analysis.
- [ ] [LOW] Confirm that aggregated reports are stored indefinitely for year-over-year comparison.

---

## 19. Compliance

### GDPR
- [ ] [CRITICAL] Verify that a cookie consent banner is displayed before any non-essential cookies/tracking scripts are loaded.
- [ ] [HIGH] Confirm that users can request a full data export (all PII stored in the system) within 30 days.
- [ ] [HIGH] Validate that users can request account deletion, which permanently removes all PII within 30 days (except data required for legal/regulatory retention).
- [ ] [MEDIUM] Verify that the privacy policy is linked from the login page and account settings.
- [ ] [MEDIUM] Confirm that data processing agreements (DPAs) are in place with all third-party data processors.

### CCPA
- [ ] [HIGH] Verify that California residents can request disclosure of collected data categories and purposes.
- [ ] [HIGH] Confirm that a "Do Not Sell My Personal Information" link is displayed if personal data is sold (not applicable for this POS system).
- [ ] [MEDIUM] Validate that the privacy policy includes specific disclosures for California residents.

### Cookie Consent
- [ ] [HIGH] Verify that cookie consent categories are implemented: Essential (no consent needed), Functional (opt-out), Analytics (opt-in), Marketing (opt-in).
- [ ] [MEDIUM] Confirm that consent preferences are stored with a non-personal identifier (not user ID) to maintain anonymity before authentication.
- [ ] [MEDIUM] Validate that consent management platform (CMP) is tested with major browsers and devices.

### Privacy Policy
- [ ] [HIGH] Verify that a comprehensive privacy policy is published and accessible from every page footer and the login page.
- [ ] [HIGH] Confirm that the privacy policy covers: data collected, purpose, legal basis, retention period, third-party sharing, user rights, and contact information.
- [ ] [MEDIUM] Validate that the privacy policy is updated within 30 days of any material change in data processing practices.

### Terms of Service
- [ ] [HIGH] Verify that Terms of Service (ToS) are published and accessible from the login page and account settings.
- [ ] [MEDIUM] Confirm that ToS cover account usage, prohibited activities, limitation of liability, and dispute resolution.

### Account Deletion
- [ ] [CRITICAL] Verify that account deletion can be initiated by the user without contacting support (self-service).
- [ ] [HIGH] Confirm that account deletion is irreversible and includes all associated PII.
- [ ] [HIGH] Validate that financial records (sales, invoices, payments) are retained in anonymized form (detached from user identity) after deletion.
- [ ] [MEDIUM] Verify that account deletion is completed within 30 days with confirmation email.

### Data Export
- [ ] [HIGH] Verify that users can export their data in a machine-readable format (JSON, CSV) via self-service.
- [ ] [HIGH] Confirm that data export includes: profile data, transaction history, communication records, and preferences.
- [ ] [MEDIUM] Validate that data export requests are fulfilled within 30 days (GDPR requirement).
- [ ] [MEDIUM] Verify that data exports are delivered via a secure, expiring download link (not email attachment for large exports).

---

## 20. Disaster Recovery

### Backups
- [ ] [CRITICAL] Verify that automated database backups run at least daily with 30-day retention.
- [ ] [CRITICAL] Confirm that backups are stored in a separate geographic region from the primary database.
- [ ] [HIGH] Validate that backup integrity is verified weekly (restore to a test environment and run validation queries).
- [ ] [HIGH] Verify that backup monitoring alerts if no successful backup has completed in 48 hours.
- [ ] [MEDIUM] Confirm that application configuration (environment variables, secrets references) is backed up alongside database backups.

### Restore Testing
- [ ] [CRITICAL] Verify that a full production database restore is performed and validated in staging monthly.
- [ ] [HIGH] Confirm that point-in-time recovery (PITR) is tested to restore to a specific moment (last 5 minutes).
- [ ] [HIGH] Validate that the restore procedure is documented step-by-step and can be executed by any on-call engineer.
- [ ] [MEDIUM] Verify that restore time is measured against RTO targets (see below).

### Failover
- [ ] [HIGH] Verify that database failover (primary → standby) is tested quarterly and takes less than 5 minutes.
- [ ] [HIGH] Confirm that application failover (if multi-region) is tested and documented.
- [ ] [MEDIUM] Validate that failover procedures are documented with rollback steps.

### Recovery Time Objective (RTO)
- [ ] [CRITICAL] Verify that the RTO is defined (target: 1 hour for full recovery, 15 minutes for payment processing).
- [ ] [HIGH] Confirm that the infrastructure can restore within the defined RTO based on restore testing results.
- [ ] [MEDIUM] Validate that RTO is reviewed quarterly and adjusted based on actual restore performance.

### Recovery Point Objective (RPO)
- [ ] [CRITICAL] Verify that the RPO is defined (target: 5 minutes — maximum acceptable data loss).
- [ ] [HIGH] Confirm that WAL archiving / streaming replication supports the defined RPO.
- [ ] [MEDIUM] Validate that RPO is reviewed quarterly based on backup frequency and replication lag.

### Runbooks
- [ ] [HIGH] Verify that runbooks exist for all major incident scenarios: database failure, application crash, payment gateway outage, security breach.
- [ ] [HIGH] Confirm that runbooks are accessible offline (PDF) and stored in a location accessible without the production system.
- [ ] [MEDIUM] Validate that runbooks are tested in disaster recovery drills (at least quarterly).
- [ ] [MEDIUM] Verify that runbooks include contact information for all third-party vendors (Supabase, Stripe, Resend, Africa's Talking).

---

## 21. Scalability

### Caching
- [ ] [HIGH] Verify that a distributed cache (Redis) is configured for session state, rate limiting counters, and frequently accessed data.
- [ ] [HIGH] Confirm that cache key naming is consistent and includes versioning for safe cache invalidation.
- [ ] [MEDIUM] Validate that cache hit rates are monitored — alert if cache hit rate drops below 80%.
- [ ] [MEDIUM] Verify that cached data has appropriate TTLs — short TTL for dynamic data, long TTL for reference data.

### Queues
- [ ] [HIGH] Verify that a task queue (Bull/BullMQ, Supabase Queue) is configured for background processing.
- [ ] [HIGH] Confirm that queue consumers can process messages in parallel with configurable concurrency.
- [ ] [MEDIUM] Validate that queue backlog is monitored — alert if queue depth exceeds 1000 messages for more than 5 minutes.

### Autoscaling
- [ ] [HIGH] Verify that horizontal autoscaling is configured with minimum 2 instances, maximum 10 instances.
- [ ] [HIGH] Confirm that autoscaling is based on multiple metrics (CPU, memory, request latency, queue depth).
- [ ] [MEDIUM] Validate that autoscaling cooldown period prevents rapid scale-up/scale-down cycles.

### Read Replicas
- [ ] [HIGH] Verify that read replicas are configured for the database to offload reporting and analytics queries.
- [ ] [HIGH] Confirm that application correctly routes read queries to replicas and write queries to the primary.
- [ ] [MEDIUM] Validate that replication lag is monitored and alerts if lag exceeds 30 seconds.

### Horizontal Scaling
- [ ] [HIGH] Verify that the application is stateless — any instance can handle any request without local session affinity.
- [ ] [HIGH] Confirm that file uploads and sessions use external storage (not local disk) to support horizontal scaling.
- [ ] [MEDIUM] Validate that horizontal scaling is tested (increase instance count and verify performance improvement is linear).

### CDN
- [ ] [HIGH] Verify that static assets (JS, CSS, images, fonts) are served via CDN with long cache TTL (1 year for fingerprinted assets).
- [ ] [MEDIUM] Confirm that API responses for public data can be cached at the CDN edge.
- [ ] [MEDIUM] Validate that CDN cache hit ratio is monitored — target > 90%.

### Connection Limits
- [ ] [HIGH] Verify that database connection pool size is calculated based on `max_connections * (instances * connections_per_instance)`.
- [ ] [HIGH] Confirm that connection pooling (PgBouncer) is configured to prevent database connection exhaustion.
- [ ] [MEDIUM] Validate that application connection pool has a wait queue with configurable timeout (5 seconds).

---

## 22. Cost Optimization

### Idle Resources
- [ ] [MEDIUM] Verify that staging/preview environments are automatically shut down during non-business hours.
- [ ] [MEDIUM] Confirm that unused cloud resources (unattached IPs, unused load balancers, orphaned storage volumes) are identified and released weekly.
- [ ] [LOW] Validate that development and staging environments use smaller instance sizes than production.

### API Costs
- [ ] [HIGH] Verify that external API calls (Stripe, Resend, Africa's Talking) are minimized — batch operations where possible.
- [ ] [MEDIUM] Confirm that API usage is monitored and cost anomalies are alerted.
- [ ] [LOW] Validate that API responses are cached to reduce redundant calls.

### Storage Costs
- [ ] [MEDIUM] Verify that object storage lifecycle policies automatically move old data to cold storage tiers.
- [ ] [MEDIUM] Confirm that unused or temporary files are deleted after 7 days.
- [ ] [LOW] Validate that database size is monitored — archive old data if the database exceeds 80% of allocated storage.

### Monitoring Costs
- [ ] [MEDIUM] Verify that log retention periods are aligned with actual requirements (not storing debug logs for 1 year).
- [ ] [MEDIUM] Confirm that metric cardinality is controlled — avoid unique label values (user IDs, request IDs) in Prometheus metrics.
- [ ] [LOW] Validate that synthetic monitoring frequency is appropriate (every 5 minutes for critical endpoints, hourly for non-critical).

### Caching
- [ ] [HIGH] Verify that aggressive caching is configured for reference data (products, categories, tax rates) to reduce database reads.
- [ ] [MEDIUM] Confirm that CDN caching is configured to reduce origin requests for static assets.
- [ ] [LOW] Validate that database query result caching is used for expensive aggregation queries.

### Cloud Budget Alerts
- [ ] [HIGH] Verify that cloud budget alerts are set at 50%, 80%, and 100% of the monthly budget.
- [ ] [HIGH] Confirm that budget alerts are sent to the finance team and engineering leads.
- [ ] [MEDIUM] Validate that cost anomaly detection is configured on all cloud provider accounts.

---

## 23. Production Deployment

### Final QA
- [ ] [CRITICAL] Verify that a full QA regression suite has been run on the staging environment within the last 24 hours.
- [ ] [HIGH] Confirm that all P0 and P1 bugs from the current sprint are resolved or have an approved deferral.
- [ ] [HIGH] Validate that the production database migration has been tested against a staging copy of the production database.
- [ ] [MEDIUM] Verify that all feature flags are configured correctly for the production environment.

### Smoke Tests
- [ ] [CRITICAL] Verify that a smoke test suite runs automatically after deployment and checks: login, create sale, process payment, generate report.
- [ ] [HIGH] Confirm that smoke tests assert on specific application behavior (not just HTTP 200).
- [ ] [HIGH] Validate that failed smoke tests trigger an automatic rollback notification.

### Deployment Validation
- [ ] [HIGH] Verify that the deployed version matches the version tagged in the repository (git tag or release).
- [ ] [HIGH] Confirm that the deployment status (success/failure) is visible in the team's communication channel.
- [ ] [MEDIUM] Validate that the deployment checklist is completed and signed off by the lead engineer.

### Rollback Verification
- [ ] [CRITICAL] Verify that the rollback procedure has been tested within the last week and the team knows how to execute it.
- [ ] [HIGH] Confirm that the previous working version is available for immediate rollback.
- [ ] [MEDIUM] Validate that the database migration for this deployment has a corresponding down migration.

### Environment Variables
- [ ] [CRITICAL] Verify that all production environment variables are set correctly — compare against a checklist of required variables.
- [ ] [HIGH] Confirm that no development/staging API keys or endpoints are used in production configuration.
- [ ] [MEDIUM] Validate that environment variables are stored in the cloud provider's secrets manager — not in plaintext configuration files.

### Secrets
- [ ] [CRITICAL] Verify that all production secrets (database URL, API keys, JWT secrets) have been rotated within the last 90 days.
- [ ] [HIGH] Confirm that production secrets are scoped to the minimum required permissions.
- [ ] [MEDIUM] Validate that no secrets are exposed in environment logs or error reporting.

### SSL/TLS
- [ ] [CRITICAL] Verify that the production domain has a valid TLS certificate that does not expire within the next 30 days.
- [ ] [HIGH] Confirm that HTTPS redirect is configured (HTTP → 301 → HTTPS).
- [ ] [MEDIUM] Validate that SSL Labs test returns grade A or A+.

### DNS
- [ ] [HIGH] Verify that the production domain's DNS records are correct and propagated.
- [ ] [HIGH] Confirm that the DNS TTL has been lowered (300s) for the deployment window.
- [ ] [MEDIUM] Validate that the apex domain (e.g., winnmatt.com) redirects to the www subdomain (or vice versa).

---

## 24. Post-Deployment

### Monitoring
- [ ] [CRITICAL] Verify that error rates, latency, and traffic are within expected ranges 30 minutes after deployment.
- [ ] [HIGH] Confirm that no new errors have appeared in Sentry within the first hour post-deployment.
- [ ] [HIGH] Validate that all monitoring dashboards show green status (no critical alerts firing).
- [ ] [MEDIUM] Verify that synthetic monitoring checks pass for all critical user journeys.

### Incident Review
- [ ] [HIGH] Verify that any incidents during deployment are documented with root cause analysis within 48 hours.
- [ ] [MEDIUM] Confirm that the post-deployment review meeting is scheduled within 1 week of major deployments.
- [ ] [MEDIUM] Validate that action items from the incident review are tracked in the issue tracker.

### Error Tracking
- [ ] [HIGH] Verify that no unhandled exceptions are occurring in production (check Sentry for new issues).
- [ ] [MEDIUM] Confirm that error grouping is configured correctly — similar errors are grouped, not creating noise.
- [ ] [MEDIUM] Validate that source maps are uploaded to the error tracking service for readable stack traces.

### Performance Review
- [ ] [HIGH] Verify that Core Web Vitals (LCP, INP, CLS) have not regressed compared to the previous deployment.
- [ ] [HIGH] Confirm that API response times are within the defined SLO (P99 < 2 seconds for read endpoints, P99 < 5 seconds for write endpoints).
- [ ] [MEDIUM] Validate that database query performance has not regressed (check slow query log).

### Customer Feedback
- [ ] [MEDIUM] Verify that the customer feedback channel (in-app, email, support) is monitored for post-deployment issues.
- [ ] [MEDIUM] Confirm that a feedback loop is established — bug reports from the first 48 hours are triaged within 4 hours.
- [ ] [LOW] Validate that feature adoption metrics are tracked for newly released features.

### Bug Tracking
- [ ] [HIGH] Verify that all critical bugs discovered post-deployment are logged in the issue tracker with priority P0/P1.
- [ ] [HIGH] Confirm that a hotfix process is documented for emergency fixes that cannot wait for the regular release cycle.
- [ ] [MEDIUM] Validate that bug reports include environment details (browser, OS, user role) and reproduction steps.

---

## 25. Final Go/No-Go Review

### Critical Blockers
- [ ] [CRITICAL] Verify that no P0 (critical) bugs are open against this release.
- [ ] [CRITICAL] Verify that all security findings from the latest penetration test are resolved or have an approved risk acceptance.
- [ ] [CRITICAL] Verify that the payment gateway (Stripe, M-Pesa) integration has passed end-to-end testing with real credentials in the staging environment.
- [ ] [CRITICAL] Confirm that the database backup and restore procedure has been tested and verified within the last 7 days.
- [ ] [CRITICAL] Verify that the rollback plan has been tested and the team knows how to execute it.
- [ ] [CRITICAL] Confirm that the on-call engineer for launch day is identified, briefed, and available.
- [ ] [CRITICAL] Verify that all required environment variables and secrets are configured in the production environment.
- [ ] [CRITICAL] Confirm that the production database migration has been applied to a full copy of production data in staging and verified.
- [ ] [CRITICAL] Verify that monitoring, alerting, and logging are all operational and receiving data from the production environment.
- [ ] [CRITICAL] Confirm that the legal/privacy team has approved the Terms of Service and Privacy Policy for the public launch.

### Go/No-Go Sign-off
- [ ] [CRITICAL] Product Owner sign-off: all committed features are implemented and accepted.
- [ ] [CRITICAL] Engineering Lead sign-off: all technical requirements are met, no critical bugs.
- [ ] [CRITICAL] QA Lead sign-off: regression suite passes, smoke tests pass in staging.
- [ ] [CRITICAL] Security Lead sign-off: security scan passes, no open critical vulnerabilities.
- [ ] [CRITICAL] Operations Lead sign-off: deployment plan is ready, rollback plan is tested, on-call is staffed.

---

## Summary

| Metric | Count |
|--------|:-----:|
| **Total checklist items** | **267** |
| **Critical priority** | **48** |
| **High priority** | **108** |
| **Medium priority** | **89** |
| **Low priority** | **22** |
