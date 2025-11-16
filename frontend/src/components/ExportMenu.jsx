import { useState } from 'react';
import { theme } from '../styles/theme';
import { format } from 'date-fns';
import { showToast } from './ToastContainer';

export default function ExportMenu({ events, messages, onClose }) {
  const [exportFormat, setExportFormat] = useState('csv');
  const [includeMessages, setIncludeMessages] = useState(true);
  const [dateRange, setDateRange] = useState('all');
  const [isExporting, setIsExporting] = useState(false);

  // Filter events by date range
  const getFilteredEvents = () => {
    if (dateRange === 'all') return events;

    const now = new Date();
    let cutoffDate;

    switch (dateRange) {
      case '24h':
        cutoffDate = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoffDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return events;
    }

    return events.filter(e => {
      if (!e.startTime) return true;
      return new Date(e.startTime) >= cutoffDate;
    });
  };

  // Export to CSV
  const exportToCSV = () => {
    const filteredEvents = getFilteredEvents();

    // CSV headers
    const headers = [
      'ID',
      'Event Type',
      'Severity',
      'State',
      'Corridor',
      'Location',
      'Description',
      'Latitude',
      'Longitude',
      'Direction',
      'Lanes Affected',
      'Start Time',
      'End Time'
    ];

    if (includeMessages) {
      headers.push('Message Count', 'Latest Message');
    }

    // Build CSV rows
    const rows = filteredEvents.map(event => {
      const row = [
        event.id,
        event.eventType || '',
        event.severity || event.severityLevel || '',
        event.state || '',
        event.corridor || '',
        `"${(event.location || '').replace(/"/g, '""')}"`, // Escape quotes
        `"${(event.description || '').replace(/"/g, '""')}"`,
        event.latitude || '',
        event.longitude || '',
        event.direction || '',
        event.lanesAffected || '',
        event.startTime || '',
        event.endTime || ''
      ];

      if (includeMessages) {
        const eventMessages = messages[event.id] || [];
        row.push(eventMessages.length);
        const latestMsg = eventMessages[eventMessages.length - 1];
        row.push(latestMsg ? `"${latestMsg.content.replace(/"/g, '""')}"` : '');
      }

      return row.join(',');
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `corridor-events-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to JSON
  const exportToJSON = () => {
    const filteredEvents = getFilteredEvents();

    const data = {
      exportDate: new Date().toISOString(),
      dateRange,
      totalEvents: filteredEvents.length,
      events: filteredEvents.map(event => ({
        ...event,
        messages: includeMessages ? (messages[event.id] || []) : undefined
      }))
    };

    const jsonContent = JSON.stringify(data, null, 2);

    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `corridor-events-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF (Summary Report)
  const exportToPDF = () => {
    const filteredEvents = getFilteredEvents();

    // Create a simple HTML document for printing
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>DOT Corridor Communicator Report</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 40px;
              color: #1f2937;
            }
            h1 {
              color: #1e40af;
              border-bottom: 3px solid #3b82f6;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            h2 {
              color: #374151;
              margin-top: 30px;
              margin-bottom: 15px;
            }
            .header {
              margin-bottom: 30px;
            }
            .summary {
              background: #f3f4f6;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-top: 15px;
            }
            .summary-item {
              text-align: center;
            }
            .summary-value {
              font-size: 32px;
              font-weight: bold;
              color: #1e40af;
            }
            .summary-label {
              font-size: 14px;
              color: #6b7280;
              margin-top: 5px;
            }
            .event {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 15px;
              page-break-inside: avoid;
            }
            .event-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
            }
            .event-type {
              font-weight: bold;
              font-size: 16px;
              color: #1f2937;
            }
            .severity {
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
            }
            .severity-high {
              background: #fecaca;
              color: #991b1b;
            }
            .severity-medium {
              background: #fed7aa;
              color: #9a3412;
            }
            .severity-low {
              background: #d1fae5;
              color: #065f46;
            }
            .event-details {
              font-size: 14px;
              color: #4b5563;
              line-height: 1.6;
            }
            .event-detail-row {
              margin: 5px 0;
            }
            .label {
              font-weight: 600;
              color: #374151;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              font-size: 12px;
              color: #6b7280;
              text-align: center;
            }
            @media print {
              body { margin: 20px; }
              .event { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>DOT Corridor Communicator Report</h1>
            <p>Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm:ss')}</p>
            <p>Date Range: ${dateRange === 'all' ? 'All Events' : dateRange === '24h' ? 'Last 24 Hours' : dateRange === '7d' ? 'Last 7 Days' : 'Last 30 Days'}</p>
          </div>

          <div class="summary">
            <h2>Summary Statistics</h2>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-value">${filteredEvents.length}</div>
                <div class="summary-label">Total Events</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${filteredEvents.filter(e => (e.severity || e.severityLevel || '').toString().toLowerCase() === 'high').length}</div>
                <div class="summary-label">High Severity</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${includeMessages ? Object.values(messages).flat().length : 0}</div>
                <div class="summary-label">Total Messages</div>
              </div>
            </div>
          </div>

          <h2>Event Details</h2>
          ${filteredEvents.map(event => {
            const severity = (event.severity || event.severityLevel || 'medium').toString().toLowerCase();
            const severityClass = severity === 'high' || severity === 'major' ? 'severity-high' :
                                 severity === 'medium' || severity === 'moderate' ? 'severity-medium' : 'severity-low';

            return `
              <div class="event">
                <div class="event-header">
                  <span class="event-type">${event.eventType || 'Unknown'}</span>
                  <span class="severity ${severityClass}">${severity}</span>
                </div>
                <div class="event-details">
                  <div class="event-detail-row">
                    <span class="label">Location:</span> ${event.location || 'N/A'}
                  </div>
                  <div class="event-detail-row">
                    <span class="label">State:</span> ${event.state || 'N/A'} |
                    <span class="label">Corridor:</span> ${event.corridor || 'N/A'}
                  </div>
                  <div class="event-detail-row">
                    <span class="label">Description:</span> ${event.description || 'N/A'}
                  </div>
                  <div class="event-detail-row">
                    <span class="label">Direction:</span> ${event.direction || 'N/A'} |
                    <span class="label">Lanes Affected:</span> ${event.lanesAffected || 'N/A'}
                  </div>
                  ${event.startTime ? `
                    <div class="event-detail-row">
                      <span class="label">Start Time:</span> ${format(new Date(event.startTime), 'MMM dd, yyyy HH:mm')}
                    </div>
                  ` : ''}
                  ${includeMessages && messages[event.id] && messages[event.id].length > 0 ? `
                    <div class="event-detail-row">
                      <span class="label">Messages:</span> ${messages[event.id].length} message(s)
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}

          <div class="footer">
            <p>DOT Corridor Communicator - Traffic Event Management System</p>
            <p>This report was automatically generated and contains ${filteredEvents.length} event(s)</p>
          </div>
        </body>
      </html>
    `;

    // Open in new window and trigger print
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const filteredEvents = getFilteredEvents();

      switch (exportFormat) {
        case 'csv':
          exportToCSV();
          showToast(`Exported ${filteredEvents.length} events to CSV`, 'success');
          break;
        case 'json':
          exportToJSON();
          showToast(`Exported ${filteredEvents.length} events to JSON`, 'success');
          break;
        case 'pdf':
          exportToPDF();
          showToast(`Generated PDF report with ${filteredEvents.length} events`, 'success');
          break;
        default:
          break;
      }

      // Close menu after a short delay
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
      showToast('Export failed. Please try again.', 'error');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: theme.colors.glassDark,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '16px',
        boxShadow: theme.shadows.xl,
        padding: theme.spacing.xl,
        minWidth: '500px',
        maxWidth: '600px',
        animation: 'slideUp 0.3s ease-out'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.lg,
          paddingBottom: theme.spacing.md,
          borderBottom: `2px solid ${theme.colors.border}`
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: '700',
            color: theme.colors.text
          }}>
            Export Data
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '28px',
              color: theme.colors.textSecondary,
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {/* Export Format Selection */}
        <div style={{ marginBottom: theme.spacing.lg }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: theme.colors.text,
            marginBottom: theme.spacing.sm
          }}>
            Export Format
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: theme.spacing.sm
          }}>
            {[
              { value: 'csv', label: 'CSV', icon: '📊', desc: 'Spreadsheet data' },
              { value: 'json', label: 'JSON', icon: '📄', desc: 'Raw data' },
              { value: 'pdf', label: 'PDF', icon: '📑', desc: 'Print report' }
            ].map(format => (
              <button
                key={format.value}
                onClick={() => setExportFormat(format.value)}
                style={{
                  padding: theme.spacing.md,
                  borderRadius: '12px',
                  border: `2px solid ${exportFormat === format.value ? theme.colors.accentBlue : theme.colors.border}`,
                  background: exportFormat === format.value ? `${theme.colors.accentBlue}20` : theme.colors.glassLight,
                  cursor: 'pointer',
                  transition: `all ${theme.transitions.fast}`,
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: theme.spacing.xs }}>{format.icon}</div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: theme.colors.text,
                  marginBottom: '2px'
                }}>
                  {format.label}
                </div>
                <div style={{
                  fontSize: '11px',
                  color: theme.colors.textSecondary
                }}>
                  {format.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Selection */}
        <div style={{ marginBottom: theme.spacing.lg }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: theme.colors.text,
            marginBottom: theme.spacing.sm
          }}>
            Date Range
          </label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            style={{
              width: '100%',
              padding: theme.spacing.md,
              fontSize: '14px',
              border: `2px solid ${theme.colors.border}`,
              borderRadius: '12px',
              background: theme.colors.glassLight,
              color: theme.colors.text,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="all">All Events</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        {/* Include Messages Toggle */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: theme.spacing.md,
          background: theme.colors.glassLight,
          borderRadius: '12px',
          marginBottom: theme.spacing.lg
        }}>
          <div>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: theme.colors.text
            }}>
              Include Messages
            </div>
            <div style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              marginTop: '2px'
            }}>
              Export messages along with events
            </div>
          </div>
          <button
            onClick={() => setIncludeMessages(!includeMessages)}
            style={{
              width: '48px',
              height: '24px',
              borderRadius: '12px',
              border: `2px solid ${includeMessages ? theme.colors.accentBlue : theme.colors.border}`,
              background: includeMessages ? theme.colors.accentBlue : theme.colors.gray[300],
              position: 'relative',
              cursor: 'pointer',
              transition: `all ${theme.transitions.fast}`
            }}
          >
            <div style={{
              position: 'absolute',
              top: '1px',
              left: includeMessages ? 'calc(100% - 21px)' : '1px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: 'white',
              boxShadow: theme.shadows.sm,
              transition: `all ${theme.transitions.fast}`
            }} />
          </button>
        </div>

        {/* Summary Info */}
        <div style={{
          padding: theme.spacing.md,
          background: `${theme.colors.accentBlue}10`,
          border: `1px solid ${theme.colors.accentBlue}`,
          borderRadius: '12px',
          marginBottom: theme.spacing.lg
        }}>
          <div style={{
            fontSize: '13px',
            color: theme.colors.text,
            marginBottom: theme.spacing.xs
          }}>
            <strong>Export Summary:</strong>
          </div>
          <div style={{
            fontSize: '12px',
            color: theme.colors.textSecondary
          }}>
            {getFilteredEvents().length} events • {exportFormat.toUpperCase()} format
            {includeMessages ? ' • Including messages' : ''}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: theme.spacing.md
        }}>
          <button
            onClick={onClose}
            disabled={isExporting}
            style={{
              flex: 1,
              padding: `${theme.spacing.md} ${theme.spacing.lg}`,
              fontSize: '14px',
              fontWeight: '600',
              border: `2px solid ${theme.colors.border}`,
              borderRadius: '12px',
              background: theme.colors.glassLight,
              color: theme.colors.text,
              cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.5 : 1,
              transition: `all ${theme.transitions.fast}`
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            style={{
              flex: 2,
              padding: `${theme.spacing.md} ${theme.spacing.lg}`,
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              borderRadius: '12px',
              background: isExporting ? theme.colors.gray[400] : theme.colors.accentBlue,
              color: 'white',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              transition: `all ${theme.transitions.fast}`,
              boxShadow: isExporting ? 'none' : theme.shadows.md
            }}
            onMouseEnter={(e) => {
              if (!isExporting) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = theme.shadows.lg;
              }
            }}
            onMouseLeave={(e) => {
              if (!isExporting) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = theme.shadows.md;
              }
            }}
          >
            {isExporting ? 'Exporting...' : `Export as ${exportFormat.toUpperCase()}`}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
