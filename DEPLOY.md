# Legal Documents Deployment Guide

This guide explains how to deploy Halo's legal documents to GitHub Pages.

## Prerequisites

- GitHub account with access to create repositories under `archerontechnologies` organization
- Git installed on your machine
- Legal documents in `/Users/timothyaikenhead/Desktop/Halo/legal/`

## Step 1: Create GitHub Repository

### Option A: Via GitHub Web Interface

1. Go to https://github.com/organizations/archerontechnologies/repositories/new
   - If organization doesn't exist, create it first at https://github.com/organizations/new

2. Repository settings:
   - **Repository name:** `halo-legal`
   - **Description:** "Legal documents for Halo Safety Intelligence app"
   - **Visibility:** Public (required for GitHub Pages)
   - **Initialize:** Do NOT initialize with README, .gitignore, or license

3. Click "Create repository"

### Option B: Via GitHub CLI

```bash
# Install GitHub CLI if needed
brew install gh

# Authenticate
gh auth login

# Create repository
gh repo create archerontechnologies/halo-legal --public --description "Legal documents for Halo Safety Intelligence app"
```

## Step 2: Push Legal Documents

```bash
# Navigate to legal directory
cd /Users/timothyaikenhead/Desktop/Halo/legal

# Initialize Git repository
git init

# Add all legal files
git add .

# Create initial commit
git commit -m "Initial commit: Privacy Policy v1.0 and Terms of Service v1.0"

# Add remote
git remote add origin https://github.com/archerontechnologies/halo-legal.git

# Push to GitHub
git push -u origin main
```

## Step 3: Enable GitHub Pages

### Via Web Interface

1. Go to repository settings: https://github.com/archerontechnologies/halo-legal/settings/pages

2. Configure GitHub Pages:
   - **Source:** Deploy from a branch
   - **Branch:** main
   - **Folder:** / (root)

3. Click "Save"

4. Wait 1-2 minutes for deployment

5. Your site will be live at: `https://archerontechnologies.github.io/halo-legal/`

### Via GitHub CLI

```bash
# Enable GitHub Pages
gh repo edit archerontechnologies/halo-legal --enable-pages --pages-branch main
```

## Step 4: Verify Deployment

### Check URLs

Visit the following URLs to verify documents are live:

1. **Index:** https://archerontechnologies.github.io/halo-legal/
2. **Privacy Policy:** https://archerontechnologies.github.io/halo-legal/privacy-policy.html
3. **Terms of Service:** https://archerontechnologies.github.io/halo-legal/terms-of-service.html

### Test Checklist

- [ ] Index page loads correctly
- [ ] Privacy Policy displays properly (formatting, links work)
- [ ] Terms of Service displays properly
- [ ] All internal links work (e.g., Privacy Policy → Terms)
- [ ] Mobile responsive (test on phone)
- [ ] HTTPS enabled (GitHub Pages uses HTTPS by default)

## Step 5: Update App Store Submission

Use these URLs in App Store Connect:

- **Privacy Policy URL:** `https://archerontechnologies.github.io/halo-legal/privacy-policy.html`
- **Terms of Service URL:** `https://archerontechnologies.github.io/halo-legal/terms-of-service.html`

## Updating Legal Documents

### Process for Changes

1. Edit HTML files locally
2. Update "Last Updated" date in document header
3. Commit with descriptive message
4. Push to GitHub

```bash
cd /Users/timothyaikenhead/Desktop/Halo/legal

# Edit privacy-policy.html or terms-of-service.html

# Commit changes
git add privacy-policy.html
git commit -m "Update privacy policy: Add section on biometric data"

# Push to GitHub (live in ~1 minute)
git push
```

### Notification Requirements

If changes are **material** (affect user rights or data usage):
- Send in-app notification to all users
- Email users with accounts
- Wait 30 days before enforcing new terms (GDPR requirement)

## Troubleshooting

### GitHub Pages Not Working

**Check Build Status:**
```bash
gh run list --repo archerontechnologies/halo-legal
```

**Common Issues:**
1. Repository must be **public** (GitHub Pages doesn't work with private repos on free plan)
2. Wait 1-2 minutes after enabling GitHub Pages
3. Clear browser cache if old version still showing

### 404 Errors

- Ensure files are in root directory (not in subdirectory)
- Check file names are exact (case-sensitive)
- Verify branch is `main` not `master`

### Custom Domain (Optional)

If you want to use `legal.haloapp.se` instead of GitHub Pages default:

1. Add `CNAME` file to repository:
   ```bash
   echo "legal.haloapp.se" > CNAME
   git add CNAME
   git commit -m "Add custom domain"
   git push
   ```

2. Configure DNS:
   - Add CNAME record: `legal.haloapp.se` → `archerontechnologies.github.io`
   - Wait for DNS propagation (5 minutes - 24 hours)

3. Enable HTTPS in GitHub Pages settings

## Maintenance

### Regular Tasks

- [ ] Review legal documents quarterly for compliance updates
- [ ] Update "Last Modified" date when changes are made
- [ ] Keep Git history clean (one commit per meaningful change)
- [ ] Monitor GitHub Pages uptime (99.9% SLA)

### Backup

Legal documents are backed up via:
1. Git version history (all changes tracked)
2. GitHub's infrastructure (highly reliable)
3. Local copy in Halo repository

## Security

### Access Control

- Limit write access to legal repository
- Require pull request reviews for changes
- Enable branch protection rules

```bash
# Enable branch protection
gh api repos/archerontechnologies/halo-legal/branches/main/protection \
  --method PUT \
  --field required_pull_request_reviews[required_approving_review_count]=1
```

### HTTPS

GitHub Pages enforces HTTPS automatically. Users cannot access via HTTP.

## Cost

**GitHub Pages:** FREE for public repositories
- 1 GB storage (legal docs use <1 MB)
- 100 GB bandwidth/month (more than enough)
- Custom domain support included

## Support

**Questions?**
- GitHub Pages Documentation: https://docs.github.com/en/pages
- GitHub Status: https://www.githubstatus.com
- Contact: tim@archeron.tech

## Deployment Checklist

- [ ] Create `archerontechnologies/halo-legal` repository
- [ ] Push legal documents to repository
- [ ] Enable GitHub Pages (main branch, root folder)
- [ ] Verify all URLs load correctly
- [ ] Test on mobile devices
- [ ] Update App Store Connect with URLs
- [ ] Bookmark deployment URLs for future reference

---

**Deployment Date:** October 19, 2025
**Deployed By:** Claude (AI Assistant)
**Version:** 1.0
