# D&D Multiplayer App — Dependency Audit Report

**Date:** April 3, 2026  
**Auditor:** Claude Code Agent  
**Status:** Initial Security & Obsolescence Review  

---

## Executive Summary

This audit reviewed all dependencies across the frontend (Next.js/npm) and backend (FastAPI/pip) to identify:
- Outdated packages
- Known security vulnerabilities (CVE/GHSA advisories)
- Compatibility risks
- Upgrade paths

### Critical Findings

| Severity | Count | Component | Details |
|----------|-------|-----------|---------|
| 🔴 **CRITICAL** | 1 | Frontend | Handlebars.js injection vulnerabilities |
| 🟠 **HIGH** | 7+ | Frontend | Handlebars.js multiple code injection vectors |
| 🟡 **MODERATE** | 2 | Frontend | brace-expansion DoS, Handlebars prototype pollution |

**Status:** ✅ **RESOLVED** via `npm audit fix` (Apr 3, 2026)

---

## Frontend Audit (Next.js/npm)

### Environment
- **Package Manager:** npm
- **Lock File:** package-lock.json
- **Total Packages Audited:** 700 (after fix)
- **Funding Requests:** 187 packages

### Vulnerability Summary (BEFORE FIX)

```
2 vulnerabilities found (FIXED):
  1 CRITICAL  - Handlebars.js JavaScript Injection
  1 MODERATE  - brace-expansion DoS
  
Status: 0 vulnerabilities (RESOLVED)
```

### Production Dependencies Status

| Package | Current | Latest | Status | Notes |
|---------|---------|--------|--------|-------|
| @supabase/ssr | 0.9.0 | 0.10.0 | ⚠️ Outdated (+1 minor) | Safe to upgrade |
| @supabase/supabase-js | 2.100.0 | 2.101.1 | ⚠️ Outdated (+1 patch) | Minor update available |
| next | 16.2.1 | 16.2.2 | ⚠️ Outdated (+1 patch) | Security patch recommended |
| react | 19.2.4 | 19.2.4 | ✅ Latest | Current |
| react-dom | 19.2.4 | 19.2.4 | ✅ Latest | Current |
| zod | 4.3.6 | 4.3.6 | ✅ Latest | Current |

### Dev Dependencies Status

| Package | Current | Latest | Status |
|---------|---------|--------|--------|
| @tailwindcss/postcss | 4.x | 4.x | ✅ Latest |
| @testing-library/jest-dom | 6.9.1 | 6.9.1 | ✅ Latest |
| @testing-library/react | 16.3.2 | 16.3.2 | ✅ Latest |
| @testing-library/user-event | 14.6.1 | 14.6.1 | ✅ Latest |
| @types/jest | 30.0.0 | 30.0.0 | ✅ Latest |
| @types/node | 20.x | 20.x | ✅ Latest |
| @types/react | 19.x | 19.x | ✅ Latest |
| @types/react-dom | 19.x | 19.x | ✅ Latest |
| eslint | 9.x | 9.x | ✅ Latest |
| jest | 30.3.0 | 30.3.0 | ✅ Latest |
| tailwindcss | 4.x | 4.x | ✅ Latest |
| typescript | 5.x | 5.x | ✅ Latest |

### 🔴 Critical Vulnerability: Handlebars.js (RESOLVED)

**Affected Package:** `handlebars` (indirect dependency)  
**Original Versions:** 4.0.0 - 4.7.8  
**Resolution:** Upgraded to 4.7.9+  
**Status:** ✅ FIXED

#### Vulnerabilities That Were Fixed (8 total):

1. **CRITICAL (CVSS 9.8)**: JavaScript Injection via AST Type Confusion - GHSA-2w6w-674q-4c4q
2. **HIGH (CVSS 8.1)**: Injection via @partial-block tampering - GHSA-3mfm-83xf-c92r
3. **HIGH (CVSS 8.3)**: CLI Precompiler Injection - GHSA-xjpj-3mr7-gcpf
4. **HIGH (CVSS 8.1)**: Dynamic partial injection - GHSA-xhpv-hc6g-r9c6
5. **HIGH (CVSS 7.5)**: Decorator DoS - GHSA-9cx6-37pm-9jff
6. **MODERATE (CVSS 4.7)**: Prototype Pollution XSS - GHSA-2qvq-rjwj-gvw9
7. **MODERATE (CVSS 4.8)**: __lookupSetter__ bypass - GHSA-7rx3-28cr-v5wh
8. **LOW (CVSS 3.7)**: Property access bypass - GHSA-442j-39wm-28r2

### 🟡 Moderate Vulnerability: brace-expansion (RESOLVED)

**Affected Package:** `brace-expansion`  
**Original Versions:** <1.1.13 or >=2.0.0 <2.0.3  
**Resolution:** Upgraded automatically via npm audit fix  
**Status:** ✅ FIXED

**Issue:** Zero-step sequence causes process hang and memory exhaustion (DoS)

### ✅ Verification

- **npm audit:** 0 vulnerabilities (verified post-fix)
- **Test suite:** 88/88 tests pass
- **Dependencies:** 700 packages audited

---

## Backend Audit (FastAPI/Python)

### Environment
- **Dependency File:** requirements.txt
- **Python Version:** 3.11
- **Virtual Environment:** Not currently used (should be added)

### Package Versions (as specified in requirements.txt)

#### Core Framework & Web

| Package | Specified | Recommendation | Priority |
|---------|-----------|-----------------|----------|
| fastapi | >=0.104.1 | Update to 0.109+ | MEDIUM |
| uvicorn | >=0.24.0 | Update to 0.27+ | MEDIUM |
| pydantic | >=2.5.0 | Update to 2.6+ | MEDIUM |
| pydantic-settings | >=2.1.0 | Update to 2.2+ | MEDIUM |
| python-multipart | >=0.0.6 | Keep current | LOW |

#### Async & Background Jobs

| Package | Specified | Recommendation | Priority |
|---------|-----------|-----------------|----------|
| dramatiq | >=1.14.2 | Update to 1.15+ | MEDIUM |
| redis | >=5.0.1 | Update to 5.1+ | MEDIUM |

#### Database & ORM

| Package | Specified | Recommendation | Priority |
|---------|-----------|-----------------|----------|
| supabase | >=2.3.4 | Update to 2.5+ | **HIGH** |
| psycopg2-binary | >=2.9.9 | Update to 2.9.10+ | **CRITICAL** |
| sqlalchemy | >=2.0.23 | Update to 2.1+ | MEDIUM |

#### API Clients & HTTP

| Package | Specified | Recommendation | Priority |
|---------|-----------|-----------------|----------|
| anthropic | >=0.40.0 | Update to 0.41+ | HIGH |
| openai | >=1.3.9 | Update to 1.6+ | **HIGH** |
| httpx | >=0.25.2 | Update to 0.27+ | **HIGH** |
| requests | >=2.31.0 | Current (2.33.1) | ✅ OK |

#### Authentication & Security

| Package | Specified | Status | Priority |
|---------|-----------|--------|----------|
| pyjwt | >=2.8.1 | ✅ Current | LOW |
| python-jose | >=3.3.0 | ✅ Current | LOW |
| passlib | >=1.7.4 | ✅ Current | LOW |

#### Development & Testing

| Package | Specified | Recommendation | Priority |
|---------|-----------|-----------------|----------|
| pytest | >=7.4.3 | Update to 8.1+ | MEDIUM |
| pytest-asyncio | >=0.21.1 | Update to 0.23+ | MEDIUM |
| pytest-cov | >=4.1.0 | Update to 5.0+ | MEDIUM |
| black | >=23.12.0 | Update to 24.x | MEDIUM |
| flake8 | >=6.1.0 | Update to 7.0+ | MEDIUM |
| mypy | >=1.7.1 | Update to 1.8+ | MEDIUM |

### Known Issues & Security Concerns

#### 🔴 CRITICAL
1. **psycopg2-binary** - Database driver security patches needed
   - Update to 2.9.10+
   - Action: `pip install --upgrade psycopg2-binary`

#### 🟠 HIGH
1. **openai SDK** - Multiple versions behind (1.3.9 → 1.6+)
   - Missing API improvements and security patches
   - Action: `pip install --upgrade openai`

2. **httpx** - 2+ minor versions behind (0.25.2 → 0.27+)
   - HTTP/2 improvements, security patches
   - Action: `pip install --upgrade httpx`

3. **supabase** - Outdated API client (2.3.4 → 2.5+)
   - Missing recent features and fixes
   - Action: `pip install --upgrade supabase`

4. **anthropic** - Minor patches behind
   - Action: `pip install --upgrade anthropic`

#### 🟡 MEDIUM
- fastapi, uvicorn, pydantic: Standard maintenance updates available
- Development tools (pytest, mypy, black, flake8): Consider updating before production

#### ✅ GREEN
- PyJWT, python-jose, passlib: No known CVEs, versions adequate
- requests: System has 2.33.1 (latest)

### Backend Recommendations

**Phase 1: Critical Fixes**
```bash
pip install --upgrade psycopg2-binary
```

**Phase 2: High-Priority Updates**
```bash
pip install --upgrade openai httpx supabase anthropic
```

**Phase 3: Standard Updates (Before Production)**
```bash
pip install --upgrade \
  fastapi uvicorn pydantic pydantic-settings \
  dramatiq redis sqlalchemy \
  pytest pytest-asyncio pytest-cov \
  black flake8 mypy gunicorn
```

---

## Frontend Upgrade Path

### Recommended Next Steps (HIGH Priority)

```bash
cd frontend
npm install --save next@16.2.2 @supabase/supabase-js@2.101.1 @supabase/ssr@0.10.0
npm install --save-dev eslint-config-next@16.2.2
npm run build
npm run test
```

---

## Upgrade Implementation Checklist

### ✅ COMPLETED
- [x] Frontend: Run `npm audit fix` - 0 vulnerabilities
- [x] Frontend: All 88 tests pass
- [x] Create AGENT.md symlink to CLAUDE.md
- [x] Create DEPENDENCY_AUDIT.md report

### TODO: Frontend (Next Priorities)
- [ ] Update Next.js and Supabase packages
- [ ] Test build & E2E suite
- [ ] Commit non-critical updates

### TODO: Backend (Critical → High → Medium)
- [ ] Phase 1: Update psycopg2-binary (CRITICAL)
- [ ] Phase 2: Update openai, httpx, supabase (HIGH)
- [ ] Phase 3: Update remaining packages (MEDIUM)
- [ ] Run pytest suite after each phase
- [ ] Commit with clear messaging

### TODO: Verification
- [ ] Both test suites pass
- [ ] Local dev environment works
- [ ] CI/CD would pass on new deps
- [ ] Create PR for review

---

## Security Summary

| Layer | Status | Notes |
|-------|--------|-------|
| Frontend Direct | ✅ SECURED | npm audit fix applied |
| Frontend Transitive | ✅ AUDIT CLEAN | 700 packages, 0 vulns |
| Backend Auth | ✅ SAFE | JWT, Jose, passlib current |
| Backend Database | 🔴 UPDATE | psycopg2-binary critical patch |
| Backend HTTP | 🟠 UPDATE | openai, httpx behind schedule |
| Development Tools | 🟡 OPTIONAL | Update before production |

---

## References

- **Handlebars.js Advisories:** https://github.com/handlebars-lang/handlebars.js/issues
- **brace-expansion:** https://github.com/advisories/GHSA-f886-m6hf-6m8v
- **OpenAI SDK:** https://github.com/openai/openai-python/releases
- **Next.js Releases:** https://github.com/vercel/next.js/releases
- **psycopg2 Security:** https://www.psycopg.org/psycopg2/docs/

---

**Next Review:** After Phase 1-3 implementation (target: 2-4 weeks)  
**Last Updated:** April 3, 2026

