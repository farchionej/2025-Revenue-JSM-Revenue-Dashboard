#!/bin/bash

# Simple script to update your dashboard
echo "📊 Revenue Dashboard Updater"
echo "=============================="

# Check if we're in the right directory
if [ ! -f "index.html" ]; then
    echo "❌ Error: Run this script from the revenue-dashboard directory"
    exit 1
fi

# Add all changes
git add .

# Ask for commit message
echo "💬 Describe your changes (or press Enter for default):"
read -r commit_message

# Use default message if empty
if [ -z "$commit_message" ]; then
    commit_message="Update dashboard - $(date '+%Y-%m-%d %H:%M')"
fi

# Commit and push
echo "🚀 Uploading changes..."
git commit -m "$commit_message"
git push

echo "✅ Done! Your dashboard will be live in 1-2 minutes"
echo "🌐 Check your Vercel dashboard for the live URL"