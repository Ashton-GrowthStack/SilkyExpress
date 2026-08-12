# Version Control & Sync Strategy

## Current Version: 1.2.0
**Commit:** `a8f2eb7`  
**Date:** 2026-08-12  
**Status:** ✅ Local and GitHub are now synchronized

---

## How to Keep Local ↔ GitHub in Sync

### ✅ DO THIS (Recommended Workflow)

**Before making any changes:**
```bash
git fetch origin main
git status
```

**After finishing work locally:**
```bash
git add .
git commit -m "Your message"
git pull --rebase origin main  # Integrate any remote changes
git push origin main
```

**To verify sync:**
```bash
git log -1 --oneline
cat VERSION  # Should match the commit
```

---

## Version Numbering Scheme

We use **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH`

| Type | Increment | Example | When to Use |
|------|-----------|---------|------------|
| **PATCH** | 1.2.0 → 1.2.1 | Bug fixes, style tweaks, small updates | Quick fixes, typos, formatting |
| **MINOR** | 1.2.0 → 1.3.0 | New features, new sections | Hero animation, gallery, team updates |
| **MAJOR** | 1.2.0 → 2.0.0 | Complete redesign, breaking changes | Full site rebuild, major redesign |

### To bump version:
```bash
# 1. Update VERSION file
echo "1.3.0" > VERSION

# 2. Commit with message
git add VERSION
git commit -m "Bump to v1.3.0: Add [feature description]"

# 3. Create a tag (optional but recommended)
git tag -a v1.3.0 -m "Release v1.3.0"

# 4. Push both commit and tag
git push origin main
git push origin v1.3.0
```

---

## The Sync Problem We Just Fixed

**What went wrong:**
- Local `index.html` was 10+ commits behind GitHub
- Paul's title was "Sourcing Agent & Client Relations" instead of "Programmer, Client Relationship Specialist"
- Hero section, gallery, and team structure were outdated
- This happened because git operations were incomplete

**What we did:**
1. ✅ Downloaded the correct version directly from GitHub
2. ✅ Replaced local file with the correct version
3. ✅ Created VERSION file (1.2.0) for tracking
4. ✅ Committed changes with proper version info
5. ✅ Installed pre-push git hook to prevent future sync issues
6. ✅ Updated CLAUDE.md documentation

---

## Prevention: Git Pre-Push Hook

A git hook is now installed at `.git/hooks/pre-push`. It will:
- Check if your local is in sync with GitHub before pushing
- Warn if VERSION file is missing
- Block unsafe pushes

This runs automatically every time you `git push`.

---

## If Sync Gets Out of Sync Again

```bash
# Check what's different
git status
git log -3 --oneline  # See recent commits
git fetch origin main
git diff HEAD origin/main  # See what's different

# Three ways to fix:

# Option 1: Rebase (recommended - keeps history clean)
git pull --rebase origin main

# Option 2: Merge (creates merge commit)
git pull origin main

# Option 3: Reset to remote (dangerous - loses local changes!)
git reset --hard origin/main
```

---

## Version History

| Version | Date | Key Changes |
|---------|------|------------|
| 1.2.0 | 2026-08-12 | ✅ Paul title updated to Programmer; Hero animation; Gallery section; Team contact structure |
| 1.1.0 | 2026-07-27 | Form integration with Basin; Company name in header |
| 1.0.0 | 2026-07-12 | Initial website build |

---

## Quick Reference

```bash
# Check current version
cat VERSION

# See what changed since last version
git log --oneline v1.1.0..HEAD

# See what's uncommitted
git status

# See what you're about to push
git log -1 --oneline
git diff origin/main HEAD

# Verify local matches GitHub
git fetch origin main && git status
```

**Golden Rule:** Always `git fetch` and check status before pushing. Never force-push (`--force`) to main.
