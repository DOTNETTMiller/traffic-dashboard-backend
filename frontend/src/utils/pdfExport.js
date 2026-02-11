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
  yPosition += 8;

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
  yPosition += (lines.length * (font.size / 2 + 2));

  // Add underline for h1
  if (level === 1) {
    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(0.5);
    doc.line(margin.left, yPosition + 2, pageWidth - margin.right, yPosition + 2);
    yPosition += 5;
  }

  yPosition += 5;

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
    yPosition += fontSize / 2 + 2;
  });

  yPosition += 5;

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
    styles: {
      overflow: 'linebreak',
      cellWidth: 'wrap',
      fontSize: 9,
      cellPadding: 4,
      valign: 'middle'
    },
    didDrawPage: function(data) {
      // Add footer on each page
      addFooter(doc, 'DOT Corridor Communicator', { margin });
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
      letterRendering: true,
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
 * Process markdown text for PDF (simplified)
 */
export function processMarkdownForPDF(doc, markdown, yPosition, options = {}) {
  const { margin = DEFAULT_MARGINS } = options;
  const lines = markdown.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      yPosition += 3;
      continue;
    }

    // Headers
    if (trimmed.startsWith('### ')) {
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
  processMarkdownForPDF,
  addBadge,
  addStatsCard,
  savePDF,
  COLORS,
  DEFAULT_FONTS,
  DEFAULT_MARGINS
};
