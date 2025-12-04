---
id: task-016
title: Add encryption for CryptID emails at rest
status: To Do
assignee: []
created_date: '2025-12-04 12:01'
labels:
  - security
  - cryptid
  - encryption
  - privacy
  - d1
dependencies:
  - task-017
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enhance CryptID security by encrypting email addresses stored in D1 database. This protects user privacy even if the database is compromised.

**Encryption Strategy:**
- Encrypt email addresses before storing in D1
- Use Cloudflare Workers KV or environment secret for encryption key
- Store encrypted email + hash for lookups
- Decrypt only when needed (sending emails, display)

**Implementation Options:**
1. **AES-GCM encryption** with key in Worker secret
2. **Deterministic encryption** for email lookups (hash-based)
3. **Hybrid approach**: Hash for lookup index, AES for actual email

**Schema Changes:**
```sql
ALTER TABLE users ADD COLUMN email_encrypted TEXT;
ALTER TABLE users ADD COLUMN email_hash TEXT; -- For lookups
-- Migrate existing emails, then drop plaintext column
```

**Considerations:**
- Key rotation strategy
- Performance impact on lookups
- Backup/recovery implications
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Encryption key securely stored in Worker secrets
- [ ] #2 Emails encrypted before D1 insert
- [ ] #3 Email lookup works via hash index
- [ ] #4 Decryption works for email display and sending
- [ ] #5 Existing emails migrated to encrypted format
- [ ] #6 Key rotation procedure documented
- [ ] #7 No plaintext emails in database
<!-- AC:END -->
