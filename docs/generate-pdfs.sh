#!/bin/bash

# PDF Generation Script with Improved Formatting
# Fixes table rendering and word spacing issues

echo "Generating PDFs with improved formatting..."

# Create PDF output directory
mkdir -p "/Users/mattmiller/Downloads/DOT-Documentation"

# Key documents to convert
DOCS=(
  "roi-analysis:ROI-Analysis"
  "arc-its-ifc-integration:BIM-Integration-Strategy"
  "digital-infrastructure:Digital-Infrastructure-Documentation"
  "executive-business-plan:Executive-Business-Plan"
  "ifc-quick-start-guide:IFC-Quick-Start-Guide"
  "ifc-procurement-toolkit:IFC-Procurement-Toolkit"
  "pooled-fund-digital-infrastructure:Pooled-Fund-Digital-Infrastructure"
  "pooled-fund-enablement:Pooled-Fund-Enablement"
  "member-state-overview:Member-State-Overview"
  "digital-standards-crosswalk:Digital-Standards-Crosswalk"
  "using-digital-lifecycle-crosswalk:Using-Digital-Lifecycle-Crosswalk"
)

# Custom CSS for better table formatting and text rendering
CSS_FILE="/tmp/pdf-styles.css"
LOGO_PATH="/Users/mattmiller/Projects/DOT/DOT Corridor Communicator/frontend/public/assets/ccai-logo.png"

cat > "$CSS_FILE" << 'EOF'
/* Logo Header */
body::before {
  content: '';
  display: block;
  width: 150px;
  height: 100px;
  margin-bottom: 30px;
  background-image: url('/Users/mattmiller/Projects/DOT/DOT Corridor Communicator/frontend/public/assets/ccai-logo.png');
  background-size: contain;
  background-repeat: no-repeat;
  background-position: left center;
}

body {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.6;
  color: #333;
  max-width: 8.5in;
  margin: 0 auto;
  padding: 0.75in;
  text-align: left;
  word-spacing: normal;
  hyphens: none;
}

h1, h2, h3, h4, h5, h6 {
  page-break-after: avoid;
  font-weight: 600;
  line-height: 1.3;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
}

h1 { font-size: 24pt; color: #1a1a1a; border-bottom: 2px solid #0066cc; padding-bottom: 0.3em; }
h2 { font-size: 18pt; color: #2a2a2a; border-bottom: 1px solid #ccc; padding-bottom: 0.2em; }
h3 { font-size: 14pt; color: #333; }
h4 { font-size: 12pt; color: #444; }

p {
  margin: 0.75em 0;
  text-align: left;
  word-spacing: normal;
  hyphens: none;
}

/* Table improvements */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
  page-break-inside: avoid;
  font-size: 10pt;
  table-layout: fixed;
}

th, td {
  border: 1px solid #ddd;
  padding: 8px 12px;
  text-align: left;
  vertical-align: top;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: none;
  word-spacing: normal;
}

th {
  background-color: #f5f5f5;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #0066cc;
}

tr:nth-child(even) {
  background-color: #fafafa;
}

/* Fix justified text issues */
td p, th p {
  text-align: left;
  margin: 0.25em 0;
}

/* Lists */
ul, ol {
  margin: 0.75em 0;
  padding-left: 2em;
}

li {
  margin: 0.4em 0;
  text-align: left;
}

/* Code blocks */
code {
  background-color: #f4f4f4;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: "Courier New", Courier, monospace;
  font-size: 9.5pt;
}

pre {
  background-color: #f4f4f4;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
  page-break-inside: avoid;
}

pre code {
  background-color: transparent;
  padding: 0;
}

/* Blockquotes */
blockquote {
  border-left: 4px solid #0066cc;
  padding-left: 1em;
  margin: 1em 0;
  color: #666;
  font-style: italic;
}

/* Links */
a {
  color: #0066cc;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Page breaks */
.page-break {
  page-break-before: always;
}

/* Prevent orphans and widows */
h1, h2, h3, h4, h5, h6 {
  orphans: 3;
  widows: 3;
}

p {
  orphans: 3;
  widows: 3;
}

/* Footer with page numbers */
@page {
  margin: 0.75in;

  @bottom-right {
    content: "Page " counter(page) " of " counter(pages);
    font-size: 9pt;
    color: #666;
  }
}
EOF

# Generate PDFs
cd "/Users/mattmiller/Projects/DOT/DOT Corridor Communicator/docs"

for doc in "${DOCS[@]}"; do
  IFS=":" read -r source_file output_name <<< "$doc"

  if [ -f "$source_file.md" ]; then
    echo "Converting $source_file.md to PDF..."

    md-to-pdf \
      --config-file <(cat << MDCONFIG
{
  "stylesheet": "$CSS_FILE",
  "body_class": "markdown-body",
  "marked_options": {
    "headerIds": false,
    "smartypants": true
  },
  "pdf_options": {
    "format": "Letter",
    "margin": {
      "top": "0.75in",
      "right": "0.75in",
      "bottom": "0.75in",
      "left": "0.75in"
    },
    "printBackground": true,
    "preferCSSPageSize": true
  },
  "launch_options": {
    "args": ["--no-sandbox", "--disable-setuid-sandbox"]
  }
}
MDCONFIG
) \
      "$source_file.md"

    if [ $? -eq 0 ] && [ -f "$source_file.pdf" ]; then
      mv "$source_file.pdf" "/Users/mattmiller/Downloads/DOT-Documentation/${output_name}.pdf"
      echo "✓ Generated: /Users/mattmiller/Downloads/DOT-Documentation/${output_name}.pdf"
    else
      echo "✗ Failed to generate: $source_file.md"
    fi
  else
    echo "✗ File not found: $source_file.md"
  fi
done

# Clean up
rm "$CSS_FILE"

echo ""
echo "PDF Generation Complete!"
echo "Output directory: /Users/mattmiller/Downloads/DOT-Documentation/"
echo ""
ls -lh "/Users/mattmiller/Downloads/DOT-Documentation/" | tail -n +2

