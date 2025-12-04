---
id: task-015
title: Set up Cloudflare D1 email-collector database for cross-site subscriptions
status: To Do
assignee: []
created_date: '2025-12-04 12:00'
updated_date: '2025-12-04 12:03'
labels:
  - infrastructure
  - cloudflare
  - d1
  - email
  - cross-site
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a standalone Cloudflare D1 database for collecting email subscriptions across all websites (mycofi.earth, canvas.jeffemmett.com, decolonizeti.me, etc.) with easy export capabilities.

**Purpose:**
- Unified email collection from all sites
- Page-separated lists (e.g., /newsletter, /waitlist, /landing)
- Simple CSV/JSON export for email campaigns
- GDPR-compliant with unsubscribe tracking

**Sites to integrate:**
- mycofi.earth
- canvas.jeffemmett.com
- decolonizeti.me
- games.jeffemmett.com
- Future sites

**Key Features:**
- Double opt-in verification
- Source tracking (which site, which page)
- Export in multiple formats (CSV, JSON, Mailchimp)
- Basic admin dashboard or CLI for exports
- Rate limiting to prevent abuse
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 D1 database 'email-collector' created on Cloudflare
- [ ] #2 Schema deployed with subscribers, verification_tokens tables
- [ ] #3 POST /api/subscribe endpoint accepts email + source_site + source_page
- [ ] #4 Email verification flow with token-based double opt-in
- [ ] #5 GET /api/emails/export returns CSV with filters (site, date, verified)
- [ ] #6 Unsubscribe endpoint and tracking
- [ ] #7 Rate limiting prevents spam submissions
- [ ] #8 At least one site integrated and collecting emails
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Steps

### 1. Create D1 Database
```bash
wrangler d1 create email-collector
```

### 2. Create Schema File
Create `worker/email-collector-schema.sql`:

```sql
-- Email Collector Schema
-- Cross-site email subscription management

CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_hash TEXT NOT NULL,  -- For duplicate checking
  source_site TEXT NOT NULL,
  source_page TEXT,
  referrer TEXT,
  ip_country TEXT,
  subscribed_at TEXT DEFAULT (datetime('now')),
  verified INTEGER DEFAULT 0,
  verified_at TEXT,
  unsubscribed INTEGER DEFAULT 0,
  unsubscribed_at TEXT,
  metadata TEXT  -- JSON for custom fields
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash TEXT PRIMARY KEY,
  request_count INTEGER DEFAULT 1,
  window_start TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subs_email_hash ON subscribers(email_hash);
CREATE INDEX IF NOT EXISTS idx_subs_site ON subscribers(source_site);
CREATE INDEX IF NOT EXISTS idx_subs_page ON subscribers(source_site, source_page);
CREATE INDEX IF NOT EXISTS idx_subs_verified ON subscribers(verified);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subs_unique ON subscribers(email_hash, source_site);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON verification_tokens(token);
```

### 3. Create Worker Endpoints
Create `worker/emailCollector.ts`:

```typescript
// POST /api/subscribe
// GET /api/verify/:token
// POST /api/unsubscribe
// GET /api/emails/export (auth required)
// GET /api/emails/stats
```

### 4. Export Formats
- CSV: `email,source_site,source_page,subscribed_at,verified`
- JSON: Full object array
- Mailchimp: CSV with required headers

### 5. Admin Authentication
- Use simple API key for export endpoint
- Store in Worker secret: `EMAIL_ADMIN_KEY`

### 6. Integration
Add to each site's signup form:
```javascript
fetch('https://canvas.jeffemmett.com/api/subscribe', {
  method: 'POST',
  body: JSON.stringify({
    email: 'user@example.com',
    source_site: 'mycofi.earth',
    source_page: '/newsletter'
  })
})
```
<!-- SECTION:PLAN:END -->
