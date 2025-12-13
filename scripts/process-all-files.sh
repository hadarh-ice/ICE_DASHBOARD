#!/bin/bash

# ICE Analytics - Batch File Upload Script
# Uploads all articles and hours files for 2025

echo "🚀 Starting batch file upload..."
echo "================================="
echo ""

API_BASE="http://localhost:3000/api/upload"

ARTICLES_DIR="/Users/aloniter/Ice/ice-analytics/files/articales"
HOURS_DIR="/Users/aloniter/Ice/ice-analytics/files/hours and names"

# Counter
total_files=0
success_count=0
error_count=0

# Function to upload a file
upload_file() {
    local file_path="$1"
    local file_type="$2"
    local filename=$(basename "$file_path")

    echo "📤 Uploading $file_type: $filename"

    response=$(curl -s -w "\n%{http_code}" -X POST \
        -F "file=@$file_path" \
        "$API_BASE/$file_type")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        echo "   ✅ Success"
        ((success_count++))
    else
        echo "   ❌ Failed (HTTP $http_code)"
        echo "   Response: $body"
        ((error_count++))
    fi

    ((total_files++))
    echo ""
}

# Upload Articles (CSV files)
echo "📚 PROCESSING ARTICLES FILES"
echo "----------------------------"
echo ""

for file in "$ARTICLES_DIR"/*.csv; do
    if [ -f "$file" ]; then
        upload_file "$file" "articles"
    fi
done

echo ""
echo "⏱️  PROCESSING HOURS FILES"
echo "------------------------"
echo ""

# Upload Hours (XLSX files, skip temp files)
for file in "$HOURS_DIR"/*.xlsx; do
    if [ -f "$file" ] && [[ ! "$(basename "$file")" =~ ^\~\$ ]]; then
        upload_file "$file" "hours"
    fi
done

echo ""
echo "================================="
echo "📊 BATCH UPLOAD SUMMARY"
echo "================================="
echo "Total files processed: $total_files"
echo "Successful uploads: $success_count"
echo "Failed uploads: $error_count"
echo ""

if [ $error_count -eq 0 ]; then
    echo "✅ All uploads completed successfully!"
else
    echo "⚠️  Some uploads failed. Check logs above."
fi
