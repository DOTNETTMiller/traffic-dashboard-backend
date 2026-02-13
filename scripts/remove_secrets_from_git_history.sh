#!/bin/bash

# Script to remove sensitive files from Git history
# This will rewrite git history - USE WITH CAUTION

echo "======================================================================"
echo "REMOVING SENSITIVE FILES FROM GIT HISTORY"
echo "======================================================================"
echo ""
echo "WARNING: This will rewrite git history!"
echo "Anyone who has cloned the repo will need to re-clone it."
echo ""
echo "Files to be removed from history:"
echo "  - .api_keys (contains 3 API keys)"
echo "  - ADMIN_GUIDE.md (contains password: Bim4infra)"
echo "  - EMAIL_SETUP.md"
echo "  - USER_LOGIN_SYSTEM.md"
echo ""
read -p "Do you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "Step 1: Checking if git-filter-repo is installed..."
if ! command -v git-filter-repo &> /dev/null; then
  echo "git-filter-repo is not installed. Installing via Homebrew..."
  brew install git-filter-repo
else
  echo "✓ git-filter-repo is installed"
fi

echo ""
echo "Step 2: Creating backup of current repo..."
cd "/Users/mattmiller/Projects/DOT/DOT Corridor Communicator"
BACKUP_DIR="/Users/mattmiller/Projects/DOT/DOT Corridor Communicator Backup $(date '+%Y-%m-%d %H%M%S')"
cp -r . "$BACKUP_DIR"
echo "✓ Backup created at: $BACKUP_DIR"

echo ""
echo "Step 3: Removing sensitive files from git history..."

# Remove files from all history
git filter-repo --path .api_keys --invert-paths --force
git filter-repo --path ADMIN_GUIDE.md --invert-paths --force
git filter-repo --path EMAIL_SETUP.md --invert-paths --force
git filter-repo --path USER_LOGIN_SYSTEM.md --invert-paths --force

echo "✓ Files removed from git history"

echo ""
echo "Step 4: Verifying files are gitignored..."
cat .gitignore | grep -E "(.api_keys|ADMIN_GUIDE|EMAIL_SETUP|USER_LOGIN_SYSTEM)"

echo ""
echo "======================================================================"
echo "CLEANUP COMPLETE!"
echo "======================================================================"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Force push to GitHub (this will rewrite remote history):"
echo "   git push origin --force --all"
echo ""
echo "2. IMMEDIATELY change the exposed password:"
echo "   - Email: matthew.miller@iowadot.us"
echo "   - Old password: Bim4infra (NOW EXPOSED ON GITHUB)"
echo "   - Change via dashboard or set_default_passwords.js"
echo ""
echo "3. Regenerate the 3 API keys that were in .api_keys:"
echo "   - Internal Services key"
echo "   - Public Read-Only key"
echo "   - External Integration - State DOT key"
echo ""
echo "4. Verify on GitHub that the files are gone:"
echo "   https://github.com/DOTNETTMiller/traffic-dashboard-backend"
echo ""
echo "5. Notify anyone who has cloned the repo to re-clone it"
echo ""
