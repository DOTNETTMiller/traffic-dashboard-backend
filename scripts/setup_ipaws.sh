#!/bin/bash

# IPAWS System Setup Script
# This script sets up the IPAWS alert rules database tables

set -e

echo "🚨 IPAWS Alert System Setup"
echo "============================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set DATABASE_URL to your PostgreSQL connection string:"
    echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
    exit 1
fi

echo "📊 Database: $DATABASE_URL"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found"
    echo ""
    echo "Please install PostgreSQL client tools:"
    echo "  macOS:   brew install postgresql"
    echo "  Ubuntu:  sudo apt-get install postgresql-client"
    exit 1
fi

echo "Running IPAWS database migration..."
echo ""

# Run the migration
psql "$DATABASE_URL" -f migrations/add_ipaws_rules_table.sql

echo ""
echo "✅ IPAWS system setup complete!"
echo ""
echo "The following tables have been created:"
echo "  - ipaws_rules (automated alert rules)"
echo "  - ipaws_alert_history (alert tracking)"
echo ""
echo "Example rules have been inserted:"
echo "  1. I-80 Lane Reduction Alert"
echo "  2. High Severity Interstate Closures"
echo "  3. US Highway Construction Alerts"
echo ""
echo "Next steps:"
echo "  1. Access IPAWS Rules Config in the admin menu"
echo "  2. Review and customize example rules"
echo "  3. Test alert generation on events"
echo ""
echo "📖 Documentation: docs/IPAWS_SYSTEM.md"
