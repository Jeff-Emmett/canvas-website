---
id: task-018
title: Create Cloudflare D1 cryptid-auth database
status: Done
assignee: []
created_date: '2025-12-04 12:02'
updated_date: '2025-12-06 06:39'
labels:
  - infrastructure
  - cloudflare
  - d1
  - cryptid
  - auth
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the D1 database on Cloudflare for CryptID authentication system. This is the first step before deploying the email recovery feature.

**Database Purpose:**
- Store user accounts linked to CryptID usernames
- Store device public keys for multi-device auth
- Store verification tokens for email/device linking
- Enable account recovery via verified email

**Security Considerations:**
- Emails should be encrypted at rest (task-016)
- Public keys are safe to store (not secrets)
- Tokens are time-limited and single-use
- No passwords stored (WebCrypto key-based auth)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 D1 database 'cryptid-auth' created via wrangler d1 create
- [ ] #2 D1 database 'cryptid-auth-dev' created for dev environment
- [ ] #3 Database IDs added to wrangler.toml (replacing placeholders)
- [ ] #4 Schema from worker/schema.sql deployed to both databases
- [ ] #5 Verified tables exist: users, device_keys, verification_tokens
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Steps

### 1. Create D1 Databases
Run from local machine or Netcup (requires wrangler CLI):

```bash
cd /home/jeffe/Github/canvas-website

# Create production database
wrangler d1 create cryptid-auth

# Create dev database
wrangler d1 create cryptid-auth-dev
```

### 2. Update wrangler.toml
Replace placeholder IDs with actual database IDs from step 1:

```toml
[[d1_databases]]
binding = "CRYPTID_DB"
database_name = "cryptid-auth"
database_id = "<PROD_ID_FROM_STEP_1>"

[[env.dev.d1_databases]]
binding = "CRYPTID_DB"
database_name = "cryptid-auth-dev"
database_id = "<DEV_ID_FROM_STEP_1>"
```

### 3. Deploy Schema
```bash
# Deploy to dev first
wrangler d1 execute cryptid-auth-dev --file=./worker/schema.sql

# Then production
wrangler d1 execute cryptid-auth --file=./worker/schema.sql
```

### 4. Verify Tables
```bash
# Check dev
wrangler d1 execute cryptid-auth-dev --command="SELECT name FROM sqlite_master WHERE type='table';"

# Expected output:
# - users
# - device_keys
# - verification_tokens
```

### 5. Commit wrangler.toml Changes
```bash
git add wrangler.toml
git commit -m "chore: add D1 database IDs for cryptid-auth"
```
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Feature branch: `feature/cryptid-email-recovery`

Code is ready - waiting for D1 database creation

Schema deployed to production D1 (35fbe755-0e7c-4b9a-a454-34f945e5f7cc)

Tables created:
- users, device_keys, verification_tokens (CryptID auth)
- boards, board_permissions (permissions system)
- user_profiles, user_connections, connection_metadata (social graph)
<!-- SECTION:NOTES:END -->
