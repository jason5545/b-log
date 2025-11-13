#!/bin/bash

# Script to add article-footer min-height to all article HTML files
# This fixes the CLS (Cumulative Layout Shift) issue

find . -name "index.html" -path "*/*/index.html" | grep -v "^\./index.html" | while read -r file; do
  # Check if file has article-layout but not article-footer in inline CSS
  if grep -q "\.article-layout {" "$file" && ! grep -q "\.article-footer {" "$file"; then
    # Create temporary file with the fix
    awk '
      /\.article-layout \{/ {
        # Print article-layout block
        print
        getline
        while ($0 !~ /\}/) {
          print
          getline
        }
        print
        # Add article-footer block after article-layout
        print "    .article-footer {"
        print "      min-height: 400px;"
        print "    }"
        next
      }
      { print }
    ' "$file" > "$file.tmp"

    # Replace original file if successful
    if [ -s "$file.tmp" ]; then
      mv "$file.tmp" "$file"
      echo "✓ Updated: $file"
    else
      rm -f "$file.tmp"
      echo "✗ Failed: $file"
    fi
  fi
done

echo ""
echo "Done! All article HTML files have been updated."
