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
 * Paginate a live DOM element into a multi-page PDF that looks exactly like the
 * rendered page. This is the preferred export path: it captures the same HTML
 * the user sees (images, links, headings, tables, unicode all preserved) rather
 * than re-parsing markdown into hand-drawn text.
 */
export async function elementToPDF(element, filename, options = {}) {
  const {
    margin = 36,
    scale = 2,
    backgroundColor = '#ffffff',
    save = true,
    html2canvasOptions = {}
  } = options;

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor,
    logging: false,
    imageTimeout: 0,
    windowWidth: element.scrollWidth,
    ...html2canvasOptions
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  // How many source pixels fill one page's printable area at our scale.
  const pageSlicePx = Math.floor((canvas.width * contentHeight) / contentWidth);

  let offsetPx = 0;
  let pageIndex = 0;
  while (offsetPx < canvas.height) {
    const sliceHeightPx = Math.min(pageSlicePx, canvas.height - offsetPx);

    // Copy this vertical slice onto its own canvas, then add as a page image.
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const ctx = pageCanvas.getContext('2d');
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0, offsetPx, canvas.width, sliceHeightPx,
      0, 0, canvas.width, sliceHeightPx
    );

    const sliceImgHeight = (sliceHeightPx * contentWidth) / canvas.width;
    if (pageIndex > 0) doc.addPage();
    doc.addImage(
      pageCanvas.toDataURL('image/png'),
      'PNG',
      margin,
      margin,
      contentWidth,
      sliceImgHeight
    );

    offsetPx += sliceHeightPx;
    pageIndex++;
  }

  if (save) {
    const timestamp = new Date().toISOString().split('T')[0];
    const clean = filename.endsWith('.pdf') ? filename.slice(0, -4) : filename;
    doc.save(`${clean}-${timestamp}.pdf`);
  }

  return doc;
}

/**
 * Convert a markdown string to styled HTML for PDF rendering.
 * Covers headings (all levels), bold/italic, inline + fenced code, images,
 * links, ordered/unordered lists, blockquotes, tables, and horizontal rules.
 * Unicode (arrows, checkmarks, em-dashes) is preserved because the browser
 * renders the text — not jsPDF's Latin-1 core fonts.
 */
export function markdownToStyledHTML(markdown, options = {}) {
  const { imageBaseUrl = '' } = options;
  if (!markdown) return '';

  const escapeHtml = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Inline transforms applied to already-escaped text.
  const inline = (text) => {
    let out = text;
    // Images first (share syntax with links).
    out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, src) => {
      const resolved = src.startsWith('./')
        ? `${imageBaseUrl}/docs/${src.substring(2)}`
        : src.startsWith('/')
        ? `${imageBaseUrl}${src}`
        : src;
      return `<img src="${resolved}" alt="${alt}" style="max-width: 220px; height: auto; margin: 12px 0; display: block;" />`;
    });
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #C66A1F; text-decoration: underline;">$1</a>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/`([^`]+)`/g, '<code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: \'JetBrains Mono\', Consolas, monospace; font-size: 0.9em; color: #C66A1F;">$1</code>');
    return out;
  };

  const lines = markdown.replace(/\r/g, '').split('\n');
  const html = [];
  let listType = null; // 'ul' | 'ol'
  let inCode = false;
  let codeBuffer = [];

  const closeList = () => {
    if (listType) {
      html.push(listType === 'ul' ? '</ul>' : '</ol>');
      listType = null;
    }
  };

  // Pull out table blocks first by scanning line-by-line.
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Fenced code blocks.
    if (trimmed.startsWith('```')) {
      if (inCode) {
        html.push(`<pre style="background: #1f2937; color: #f9fafb; padding: 14px 16px; border-radius: 6px; overflow-x: auto; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; line-height: 1.5; margin: 12px 0;">${codeBuffer.map(escapeHtml).join('\n')}</pre>`);
        codeBuffer = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBuffer.push(raw); continue; }

    // Tables: a run of lines starting and ending with '|'.
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeList();
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      i--; // step back; outer loop will advance
      const rows = tableLines.map(l => l.slice(1, -1).split('|').map(c => c.trim()));
      const isSep = (cells) => cells.every(c => /^:?-+:?$/.test(c));
      let headerCells = null;
      let bodyStart = 0;
      if (rows.length >= 2 && isSep(rows[1])) {
        headerCells = rows[0];
        bodyStart = 2;
      }
      let table = '<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">';
      if (headerCells) {
        table += '<thead><tr>';
        headerCells.forEach(c => {
          table += `<th style="background: linear-gradient(to bottom, #C66A1F 0%, #0E0E10 100%); color: #fff; border: 1px solid #0E0E10; padding: 10px 12px; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px;">${inline(escapeHtml(c))}</th>`;
        });
        table += '</tr></thead>';
      }
      table += '<tbody>';
      for (let r = bodyStart; r < rows.length; r++) {
        if (isSep(rows[r])) continue;
        table += '<tr>';
        rows[r].forEach((c, idx) => {
          const base = 'border: 1px solid #e5e7eb; padding: 10px 12px; vertical-align: top; line-height: 1.5;';
          const firstCol = idx === 0 ? ' font-weight: 600; color: #111827;' : ' color: #374151;';
          table += `<td style="${base}${firstCol}">${inline(escapeHtml(c))}</td>`;
        });
        table += '</tr>';
      }
      table += '</tbody></table>';
      html.push(table);
      continue;
    }

    // Blank line.
    if (trimmed === '') {
      closeList();
      continue;
    }

    // Horizontal rule.
    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      closeList();
      html.push('<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />');
      continue;
    }

    // Headings.
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const text = inline(escapeHtml(headingMatch[2]));
      const sizes = { 1: 28, 2: 22, 3: 18, 4: 16, 5: 14, 6: 13 };
      const border = level <= 2 ? ' border-bottom: 2px solid #C66A1F; padding-bottom: 6px;' : '';
      html.push(`<h${level} style="font-size: ${sizes[level]}px; font-weight: 700; margin: ${level <= 2 ? 24 : 16}px 0 10px 0; color: #111827;${border}">${text}</h${level}>`);
      continue;
    }

    // Blockquote.
    if (trimmed.startsWith('>')) {
      closeList();
      html.push(`<blockquote style="border-left: 4px solid #C66A1F; margin: 12px 0; padding: 6px 16px; color: #4b5563; background: #f9fafb;">${inline(escapeHtml(trimmed.replace(/^>+\s?/, '')))}</blockquote>`);
      continue;
    }

    // Ordered list item.
    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (listType !== 'ol') { closeList(); html.push('<ol style="margin: 8px 0 8px 24px; padding: 0;">'); listType = 'ol'; }
      html.push(`<li style="margin: 4px 0; line-height: 1.6;">${inline(escapeHtml(olMatch[1]))}</li>`);
      continue;
    }

    // Unordered list item.
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      if (listType !== 'ul') { closeList(); html.push('<ul style="margin: 8px 0 8px 24px; padding: 0;">'); listType = 'ul'; }
      html.push(`<li style="margin: 4px 0; line-height: 1.6;">${inline(escapeHtml(ulMatch[1]))}</li>`);
      continue;
    }

    // Paragraph.
    closeList();
    html.push(`<p style="margin: 8px 0; line-height: 1.65; color: #374151;">${inline(escapeHtml(trimmed))}</p>`);
  }

  closeList();
  if (inCode && codeBuffer.length) {
    html.push(`<pre style="background: #1f2937; color: #f9fafb; padding: 14px 16px; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 12px; margin: 12px 0;">${codeBuffer.map(escapeHtml).join('\n')}</pre>`);
  }

  return html.join('\n');
}

/**
 * Render a markdown string to a multi-page PDF that matches the in-app viewers.
 * Builds an offscreen styled element, waits for images, then paginates it.
 */
export async function markdownToPDF(markdown, filename, options = {}) {
  const { imageBaseUrl = '', title = null, subtitle = null, ...pdfOptions } = options;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '720px';
  container.style.padding = '36px';
  container.style.boxSizing = 'border-box';
  container.style.background = '#ffffff';
  container.style.color = '#374151';
  container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
  container.style.fontSize = '14px';

  const titleHtml = title
    ? `<h1 style="font-size: 28px; font-weight: 700; margin: 0 0 4px 0; color: #C66A1F;">${title}</h1>`
    : '';
  const subtitleHtml = subtitle
    ? `<div style="font-size: 13px; color: #6b7280; margin: 0 0 20px 0;">${subtitle}</div>`
    : '';

  container.innerHTML = titleHtml + subtitleHtml + markdownToStyledHTML(markdown, { imageBaseUrl });
  document.body.appendChild(container);

  try {
    // Wait for any images to finish loading so they appear in the canvas.
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(imgs.map(img => img.complete
      ? Promise.resolve()
      : new Promise(resolve => { img.onload = img.onerror = () => resolve(); })));

    return await elementToPDF(container, filename, pdfOptions);
  } finally {
    document.body.removeChild(container);
  }
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
  elementToPDF,
  markdownToStyledHTML,
  markdownToPDF,
  processMarkdownForPDF,
  addBadge,
  addStatsCard,
  savePDF,
  COLORS,
  DEFAULT_FONTS,
  DEFAULT_MARGINS
};
