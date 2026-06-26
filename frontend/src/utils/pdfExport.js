/**
 * Enhanced PDF Export Utility
 *
 * Provides professional PDF generation with:
 * - High-resolution rendering (scale: 2)
 * - Proper fonts and styling
 * - Table formatting with autoTable
 * - Page breaks and margins
 * - UTF-8 character encoding
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

/**
 * Default PDF styling configuration
 */
export const DEFAULT_PDF_CONFIG = {
  orientation: 'portrait',
  unit: 'mm',
  format: 'letter',
  compress: true
};

export const DEFAULT_MARGINS = {
  top: 20,
  right: 20,
  bottom: 20,
  left: 20
};

export const DEFAULT_FONTS = {
  title: { size: 22, weight: 'bold' },
  heading1: { size: 18, weight: 'bold' },
  heading2: { size: 14, weight: 'bold' },
  heading3: { size: 12, weight: 'bold' },
  body: { size: 10, weight: 'normal' },
  small: { size: 8, weight: 'normal' }
};

export const COLORS = {
  primary: [59, 130, 246], // Blue
  success: [16, 185, 129], // Green
  warning: [245, 158, 11], // Orange
  danger: [239, 68, 68], // Red
  gray: [107, 114, 128],
  lightGray: [243, 244, 246],
  darkGray: [31, 41, 55],
  white: [255, 255, 255],
  black: [0, 0, 0]
};

/**
 * Create a new PDF document with default settings
 */
export function createPDF(config = {}) {
  return new jsPDF({
    ...DEFAULT_PDF_CONFIG,
    ...config
  });
}

/**
 * Add header to PDF page
 */
export function addHeader(doc, title, subtitle = null, options = {}) {
  const {
    margin = DEFAULT_MARGINS,
    titleColor = COLORS.primary,
    subtitleColor = COLORS.gray,
    addTimestamp = true
  } = options;

  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = margin.top;

  // Add colored header bar
  doc.setFillColor(...titleColor);
  doc.rect(0, 0, pageWidth, 30, 'F');

  // Title
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(DEFAULT_FONTS.title.size);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin.left, yPosition);
  yPosition += 10;

  // Subtitle if provided
  if (subtitle) {
    doc.setFontSize(DEFAULT_FONTS.body.size);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitle, margin.left, yPosition);
    yPosition += 8;
  }

  // Reset text color
  doc.setTextColor(...COLORS.black);
  yPosition = 40;

  // Add timestamp
  if (addTimestamp) {
    doc.setFontSize(DEFAULT_FONTS.small.size);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.gray);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin.left, yPosition);
    yPosition += 10;
  }

  return yPosition;
}

/**
 * Add footer to PDF page
 */
export function addFooter(doc, text, options = {}) {
  const { margin = DEFAULT_MARGINS } = options;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(DEFAULT_FONTS.small.size);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...COLORS.gray);

  const pageNumber = `Page ${doc.internal.getCurrentPageInfo().pageNumber}`;
  doc.text(pageNumber, pageWidth - margin.right, pageHeight - 10, { align: 'right' });

  if (text) {
    doc.text(text, margin.left, pageHeight - 10);
  }
}

/**
 * Add section heading
 */
export function addSectionHeading(doc, text, yPosition, level = 1, options = {}) {
  const { margin = DEFAULT_MARGINS, color = COLORS.darkGray } = options;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - (margin.left + margin.right);

  // Check if we need a new page
  if (yPosition > pageHeight - margin.bottom - 20) {
    doc.addPage();
    yPosition = margin.top;
  }

  // Add spacing before heading
  yPosition += 5;  // Reduced from 8 to 5

  // Set font based on level
  const fonts = {
    1: DEFAULT_FONTS.heading1,
    2: DEFAULT_FONTS.heading2,
    3: DEFAULT_FONTS.heading3
  };
  const font = fonts[level] || DEFAULT_FONTS.heading2;

  doc.setFontSize(font.size);
  doc.setFont('helvetica', font.weight);
  doc.setTextColor(...color);

  // Add heading text
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, margin.left, yPosition);
  yPosition += (lines.length * (font.size / 2 + 1.5));  // Reduced from +2 to +1.5

  // Add underline for h1
  if (level === 1) {
    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(0.5);
    doc.line(margin.left, yPosition + 2, pageWidth - margin.right, yPosition + 2);
    yPosition += 3;  // Reduced from 5 to 3
  }

  yPosition += 3;  // Reduced from 5 to 3

  // Reset color
  doc.setTextColor(...COLORS.black);

  return yPosition;
}

/**
 * Add paragraph text
 */
export function addParagraph(doc, text, yPosition, options = {}) {
  const {
    margin = DEFAULT_MARGINS,
    fontSize = DEFAULT_FONTS.body.size,
    color = COLORS.black,
    fontWeight = 'normal'
  } = options;

  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - (margin.left + margin.right);

  doc.setFontSize(fontSize);
  doc.setFont('helvetica', fontWeight);
  doc.setTextColor(...color);

  const lines = doc.splitTextToSize(text, maxWidth);

  lines.forEach(line => {
    if (yPosition > pageHeight - margin.bottom) {
      doc.addPage();
      yPosition = margin.top;
    }
    doc.text(line, margin.left, yPosition);
    yPosition += fontSize / 2 + 1;  // Reduced from +2 to +1
  });

  yPosition += 3;  // Reduced from 5 to 3

  return yPosition;
}

/**
 * Add a professional table using autoTable
 */
export function addTable(doc, headers, data, yPosition, options = {}) {
  const {
    theme = 'grid',
    headStyles = {
      fillColor: COLORS.primary,
      textColor: COLORS.white,
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: 4
    },
    bodyStyles = {
      fontSize: 9,
      cellPadding: 4
    },
    alternateRowStyles = {
      fillColor: COLORS.lightGray
    },
    columnStyles = {},
    margin = DEFAULT_MARGINS
  } = options;

  doc.autoTable({
    head: [headers],
    body: data,
    startY: yPosition,
    theme: theme,
    headStyles: headStyles,
    bodyStyles: bodyStyles,
    alternateRowStyles: alternateRowStyles,
    columnStyles: columnStyles,
    margin: { top: margin.top, right: margin.right, bottom: margin.bottom, left: margin.left },
    tableWidth: 'auto',  // Auto-size to fit within margins
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap',
      fontSize: 9,
      cellPadding: 3,  // Slightly reduced padding
      valign: 'middle',
      halign: 'left',
      minCellWidth: 15  // Minimum column width in mm
    },
    didDrawPage: function(data) {
      // Add footer on each page
      addFooter(doc, "Matt's Experimental Sandbox", { margin });
    }
  });

  return doc.lastAutoTable.finalY + 10;
}

/**
 * Convert HTML element to canvas and add to PDF
 */
export async function addHTMLElement(doc, element, yPosition, options = {}) {
  const {
    margin = DEFAULT_MARGINS,
    width = null,
    scale = 2,
    backgroundColor = '#ffffff'
  } = options;

  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = width || (pageWidth - (margin.left + margin.right));

  try {
    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      logging: false,
      backgroundColor: backgroundColor,
      imageTimeout: 0,
      removeContainer: true,
      allowTaint: true
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = maxWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Check if we need a new page
    const pageHeight = doc.internal.pageSize.getHeight();
    if (yPosition + imgHeight > pageHeight - margin.bottom) {
      doc.addPage();
      yPosition = margin.top;
    }

    doc.addImage(imgData, 'PNG', margin.left, yPosition, imgWidth, imgHeight);
    return yPosition + imgHeight + 10;

  } catch (error) {
    console.error('Error converting HTML to canvas:', error);
    return yPosition;
  }
}

/**
 * Replace non-Latin1 symbols that jsPDF's core fonts can't render (arrows,
 * checkmarks, emoji) with safe ASCII equivalents. CP1252 punctuation that
 * jsPDF *can* render (bullets, dashes, curly quotes, ellipsis) is left intact.
 */
export function sanitizeForPDF(text) {
  if (!text) return '';
  return String(text)
    .replace(/[→⇒➔➜➡▶▸▹►]/g, '->')
    .replace(/[←⇐]/g, '<-')
    .replace(/[↔⇄⇌⇔]/g, '<->')
    .replace(/↑/g, '^')
    .replace(/↓/g, 'v')
    .replace(/[✅✔✓☑]/g, '[x]')
    .replace(/[❌✗✘☒]/g, '[ ]')
    .replace(/⚠[️]?/g, '!')
    .replace(/[⭐★☆]/g, '*')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // surrogate-pair emoji
    .replace(/[☀-➿⬀-⯿]/g, '')   // misc symbols & dingbats
    .replace(/[︀-️‍]/g, '');         // variation selectors / ZWJ
}

/**
 * Strip inline markdown to plain text: keep link text (drop the URL), unwrap
 * bold/italic/code, and remove inline images (handled separately).
 */
export function stripInlineMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1$2')
    .replace(/~~([^~]+)~~/g, '$1');
}

function resolveDocImageUrl(src, base) {
  if (/^https?:/i.test(src)) return src;
  if (src.startsWith('./')) return `${base}/docs/${src.substring(2)}`;
  if (src.startsWith('/')) return `${base}${src}`;
  return `${base}/docs/${src}`;
}

async function fetchImageForPDF(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const dataUrl = await new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => res(null);
      fr.readAsDataURL(blob);
    });
    if (!dataUrl) return null;
    const dims = await new Promise(res => {
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => res({ w: 0, h: 0 });
      img.src = dataUrl;
    });
    const fmt = /png/i.test(blob.type) ? 'PNG'
      : /jpe?g/i.test(blob.type) ? 'JPEG'
      : 'PNG';
    return { dataUrl, fmt, ...dims };
  } catch {
    return null;
  }
}

/**
 * Render a markdown string into an existing jsPDF document as selectable text,
 * with full support for headings, lists, tables, code blocks, blockquotes,
 * horizontal rules, embedded images, and links. Returns the new y position.
 */
export function renderMarkdownDocument(doc, markdown, yPosition, options = {}) {
  const { margin = DEFAULT_MARGINS, imageMap = {} } = options;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin.left - margin.right;
  const PX_TO_MM = 0.2645833;
  let y = yPosition;

  const newPageIfNeeded = (need) => {
    if (y + need > pageHeight - margin.bottom) { doc.addPage(); y = margin.top; }
  };

  const lines = String(markdown || '').replace(/\r/g, '').split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Fenced code block.
    if (line.startsWith('```')) {
      i++;
      const code = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) { code.push(lines[i]); i++; }
      i++; // closing fence
      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.darkGray);
      for (const cl of code) {
        const wrapped = doc.splitTextToSize(sanitizeForPDF(cl) || ' ', maxWidth - 4);
        for (const w of wrapped) {
          newPageIfNeeded(5);
          doc.setFillColor(...COLORS.lightGray);
          doc.rect(margin.left, y - 3.5, maxWidth, 5, 'F');
          doc.text(w, margin.left + 2, y);
          y += 5;
        }
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.black);
      y += 3;
      continue;
    }

    // Table block.
    if (line.startsWith('|') && line.endsWith('|')) {
      const block = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        block.push(lines[i].trim());
        i++;
      }
      const parse = (l) => l.slice(1, -1).split('|').map(c => c.trim());
      const isSep = (cells) => cells.length > 0 && cells.every(c => /^:?-{1,}:?$/.test(c));
      const rows = block.map(parse);
      let headers, body;
      if (rows.length >= 2 && isSep(rows[1])) {
        headers = rows[0].map(c => sanitizeForPDF(stripInlineMarkdown(c)));
        body = rows.slice(2);
      } else {
        headers = rows[0].map(c => sanitizeForPDF(stripInlineMarkdown(c)));
        body = rows.slice(1);
      }
      body = body.filter(r => !isSep(r)).map(r => r.map(c => sanitizeForPDF(stripInlineMarkdown(c))));
      newPageIfNeeded(20);
      y = addTable(doc, headers, body, y, { margin });
      continue;
    }

    // Blank line.
    if (line === '') { y += 2; i++; continue; }

    // Horizontal rule.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      newPageIfNeeded(6);
      doc.setDrawColor(...COLORS.lightGray);
      doc.setLineWidth(0.4);
      doc.line(margin.left, y, pageWidth - margin.right, y);
      y += 5;
      i++;
      continue;
    }

    // Standalone image.
    const imgMatch = line.match(/^!\[[^\]]*\]\(([^)]+)\)\s*$/);
    if (imgMatch) {
      const im = imageMap[imgMatch[1]];
      if (im && im.w && im.h) {
        let w = Math.min(maxWidth, im.w * PX_TO_MM);
        if (w < 8) w = Math.min(maxWidth, 40);
        const h = (im.h * w) / im.w;
        newPageIfNeeded(h + 4);
        try {
          doc.addImage(im.dataUrl, im.fmt, margin.left, y, w, h);
          y += h + 4;
        } catch (e) { y += 2; }
      }
      i++;
      continue;
    }

    // Heading.
    const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = sanitizeForPDF(stripInlineMarkdown(hMatch[2]));
      y = addSectionHeading(doc, text, y, level <= 3 ? level : 3, { margin });
      i++;
      continue;
    }

    // Blockquote.
    if (line.startsWith('>')) {
      const text = sanitizeForPDF(stripInlineMarkdown(line.replace(/^>+\s?/, ''))) || ' ';
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(DEFAULT_FONTS.body.size);
      doc.setTextColor(...COLORS.gray);
      const wrapped = doc.splitTextToSize(text, maxWidth - 6);
      for (const w of wrapped) {
        newPageIfNeeded(5.5);
        doc.setDrawColor(...COLORS.primary);
        doc.setLineWidth(1);
        doc.line(margin.left, y - 3.5, margin.left, y + 1);
        doc.text(w, margin.left + 4, y);
        y += 5.5;
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.black);
      y += 2;
      i++;
      continue;
    }

    // List item (ordered or unordered).
    const ol = line.match(/^(\d+)[.)]\s+(.*)$/);
    const ul = line.match(/^[-*+]\s+(.*)$/);
    if (ol || ul) {
      const bullet = ol ? `${ol[1]}.` : '•';
      const text = sanitizeForPDF(stripInlineMarkdown(ol ? ol[2] : ul[1]));
      const indent = 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(DEFAULT_FONTS.body.size);
      doc.setTextColor(...COLORS.black);
      const wrapped = doc.splitTextToSize(text, maxWidth - indent);
      wrapped.forEach((w, idx) => {
        newPageIfNeeded(5.5);
        if (idx === 0) doc.text(bullet, margin.left, y);
        doc.text(w, margin.left + indent, y);
        y += 5.5;
      });
      y += 1;
      i++;
      continue;
    }

    // Paragraph.
    const text = sanitizeForPDF(stripInlineMarkdown(line));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(DEFAULT_FONTS.body.size);
    doc.setTextColor(...COLORS.black);
    const wrapped = doc.splitTextToSize(text, maxWidth);
    for (const w of wrapped) {
      newPageIfNeeded(5.5);
      doc.text(w, margin.left, y);
      y += 5.5;
    }
    y += 2;
    i++;
  }

  return y;
}

/**
 * Render a markdown string to a clean, selectable, multi-page PDF that renders
 * all markdown correctly (no raw "![]()", "[](url)", "####", or mangled
 * symbols). Images referenced in the markdown are fetched and embedded.
 */
export async function markdownToPDF(markdown, filename, options = {}) {
  const { imageBaseUrl = '', subtitle = null, margin = DEFAULT_MARGINS } = options;
  const doc = createPDF();
  let y = margin.top;

  // Optional metadata subtitle (e.g. "IFC Model Analysis: foo.ifc").
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(DEFAULT_FONTS.small.size);
    doc.setTextColor(...COLORS.gray);
    doc.text(sanitizeForPDF(subtitle), margin.left, y);
    doc.setTextColor(...COLORS.black);
    y += 6;
  }

  // Pre-fetch every referenced image so embedding can be synchronous.
  const imageMap = {};
  const srcs = new Set();
  const re = /!\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(markdown)) !== null) srcs.add(m[1]);
  await Promise.all([...srcs].map(async (src) => {
    const data = await fetchImageForPDF(resolveDocImageUrl(src, imageBaseUrl));
    if (data) imageMap[src] = data;
  }));

  renderMarkdownDocument(doc, markdown, y, { margin, imageMap });

  // Page numbers in the footer.
  const totalPages = doc.internal.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(DEFAULT_FONTS.small.size);
    doc.setTextColor(...COLORS.gray);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin.right, pageHeight - 8, { align: 'right' });
  }
  doc.setTextColor(...COLORS.black);

  const timestamp = new Date().toISOString().split('T')[0];
  const clean = filename.endsWith('.pdf') ? filename.slice(0, -4) : filename;
  doc.save(`${clean}-${timestamp}.pdf`);
  return doc;
}

/**
 * Process markdown text for PDF (simplified)
 */
export function processMarkdownForPDF(doc, markdown, yPosition, options = {}) {
  const { margin = DEFAULT_MARGINS } = options;
  const lines = markdown.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      yPosition += 2;  // Reduced from 3 to 2
      continue;
    }

    // Headers (check longer patterns first to avoid false matches)
    if (trimmed.startsWith('#### ')) {
      yPosition = addSectionHeading(doc, trimmed.substring(5), yPosition, 3, { margin });
    } else if (trimmed.startsWith('### ')) {
      yPosition = addSectionHeading(doc, trimmed.substring(4), yPosition, 3, { margin });
    } else if (trimmed.startsWith('## ')) {
      yPosition = addSectionHeading(doc, trimmed.substring(3), yPosition, 2, { margin });
    } else if (trimmed.startsWith('# ')) {
      yPosition = addSectionHeading(doc, trimmed.substring(2), yPosition, 1, { margin });
    }
    // Bold text (simple handling)
    else if (trimmed.includes('**')) {
      const cleaned = trimmed.replace(/\*\*/g, '');
      yPosition = addParagraph(doc, cleaned, yPosition, { margin, fontWeight: 'bold' });
    }
    // Bullet points
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const text = '• ' + trimmed.substring(2);
      yPosition = addParagraph(doc, text, yPosition, { margin });
    }
    // Regular paragraphs
    else {
      const cleaned = trimmed.replace(/`([^`]+)`/g, '$1').replace(/\*([^*]+)\*/g, '$1');
      yPosition = addParagraph(doc, cleaned, yPosition, { margin });
    }
  }

  return yPosition;
}

/**
 * Add a colored badge/tag
 */
export function addBadge(doc, text, x, y, color = COLORS.primary, options = {}) {
  const {
    fontSize = 8,
    padding = 2,
    borderRadius = 2
  } = options;

  doc.setFontSize(fontSize);
  doc.setFont('helvetica', 'bold');

  const textWidth = doc.getTextWidth(text);
  const badgeWidth = textWidth + (padding * 2);
  const badgeHeight = fontSize + padding;

  // Background
  doc.setFillColor(...color);
  doc.roundedRect(x, y - fontSize + 2, badgeWidth, badgeHeight, borderRadius, borderRadius, 'F');

  // Text
  doc.setTextColor(...COLORS.white);
  doc.text(text, x + padding, y);
  doc.setTextColor(...COLORS.black);

  return x + badgeWidth + 5;
}

/**
 * Add a stats card
 */
export function addStatsCard(doc, label, value, x, y, width, height, color = COLORS.primary) {
  // Card background
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(x, y, width, height, 2, 2, 'F');

  // Left colored bar
  doc.setFillColor(...color);
  doc.rect(x, y, 3, height, 'F');

  // Label
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.text(label, x + 8, y + 8);

  // Value
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...color);
  doc.text(String(value), x + 8, y + height - 8);

  doc.setTextColor(...COLORS.black);
}

/**
 * Save PDF with proper filename
 */
export function savePDF(doc, filename) {
  // Ensure .pdf extension
  if (!filename.endsWith('.pdf')) {
    filename += '.pdf';
  }

  // Add timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const finalFilename = filename.replace('.pdf', `-${timestamp}.pdf`);

  doc.save(finalFilename);
}

export default {
  createPDF,
  addHeader,
  addFooter,
  addSectionHeading,
  addParagraph,
  addTable,
  addHTMLElement,
  sanitizeForPDF,
  stripInlineMarkdown,
  renderMarkdownDocument,
  markdownToPDF,
  processMarkdownForPDF,
  addBadge,
  addStatsCard,
  savePDF,
  COLORS,
  DEFAULT_FONTS,
  DEFAULT_MARGINS
};
