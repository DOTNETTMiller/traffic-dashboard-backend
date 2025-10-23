import { useState, useEffect } from 'react';
import { config } from '../config';

function DocumentationViewer() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeDoc, setActiveDoc] = useState('normalization');

  const docs = {
    normalization: {
      title: 'Data Normalization Strategy',
      url: '/docs/DATA_NORMALIZATION.md',
      description: 'How we normalize data from 46 different sources into a unified format'
    },
    ohio: {
      title: 'Ohio OHGO API Integration',
      url: '/docs/OHIO_API_INTEGRATION.md',
      description: 'Details on Ohio-specific data sources and integration'
    },
    caltrans: {
      title: 'California Caltrans Integration',
      url: '/docs/CALTRANS_INTEGRATION.md',
      description: 'Details on California LCS data integration (if exists)'
    }
  };

  useEffect(() => {
    loadDocument(activeDoc);
  }, [activeDoc]);

  const loadDocument = async (docKey) => {
    setLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}${docs[docKey].url}`);
      if (response.ok) {
        const text = await response.text();
        setContent(text);
      } else {
        setContent(`# Document Not Found\n\nThe document "${docs[docKey].title}" could not be loaded.`);
      }
    } catch (error) {
      setContent(`# Error Loading Document\n\n${error.message}`);
    }
    setLoading(false);
  };

  // Simple markdown to HTML converter for basic formatting
  const renderMarkdown = (markdown) => {
    if (!markdown) return '';

    // Convert markdown to HTML
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/gim, '<pre><code>$2</code></pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Tables - simple conversion
    const lines = html.split('\n');
    let inTable = false;
    let tableHTML = '';
    const processedLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('|') && line.trim().startsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHTML = '<table class="doc-table">';

          // Check if next line is separator
          const nextLine = lines[i + 1];
          const isHeader = nextLine && nextLine.includes('|') && nextLine.includes('---');

          if (isHeader) {
            tableHTML += '<thead><tr>';
            const headers = line.split('|').filter(cell => cell.trim());
            headers.forEach(header => {
              tableHTML += `<th>${header.trim()}</th>`;
            });
            tableHTML += '</tr></thead><tbody>';
            i++; // Skip separator line
            continue;
          } else {
            tableHTML += '<tbody>';
          }
        }

        tableHTML += '<tr>';
        const cells = line.split('|').filter(cell => cell.trim());
        cells.forEach(cell => {
          tableHTML += `<td>${cell.trim()}</td>`;
        });
        tableHTML += '</tr>';
      } else {
        if (inTable) {
          tableHTML += '</tbody></table>';
          processedLines.push(tableHTML);
          tableHTML = '';
          inTable = false;
        }
        processedLines.push(line);
      }
    }

    if (inTable) {
      tableHTML += '</tbody></table>';
      processedLines.push(tableHTML);
    }

    html = processedLines.join('\n');

    // Lists
    html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Line breaks
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    return html;
  };

  return (
    <div className="documentation-viewer" style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      {/* Document selector */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '12px'
      }}>
        {Object.entries(docs).map(([key, doc]) => (
          <button
            key={key}
            onClick={() => setActiveDoc(key)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: activeDoc === key ? '#3b82f6' : '#f3f4f6',
              color: activeDoc === key ? 'white' : '#374151',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeDoc === key ? '600' : '400',
              transition: 'all 0.2s'
            }}
          >
            {doc.title}
          </button>
        ))}

        {/* Links to TIM feeds */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#6b7280', marginRight: '8px' }}>
            API Feeds:
          </span>
          <a
            href={`${config.apiUrl}/api/convert/tim`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              backgroundColor: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            📡 J2735 TIM
          </a>
          <a
            href={`${config.apiUrl}/api/convert/tim-cv`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              textDecoration: 'none',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            🚛 J2540 CV-TIM
          </a>
        </div>
      </div>

      {/* Document description */}
      {docs[activeDoc] && (
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #bfdbfe',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '20px',
          fontSize: '14px',
          color: '#1e40af'
        }}>
          📘 {docs[activeDoc].description}
        </div>
      )}

      {/* Document content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          Loading documentation...
        </div>
      ) : (
        <div
          className="markdown-content"
          style={{
            fontSize: '15px',
            lineHeight: '1.7',
            color: '#1f2937'
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )}

      <style>{`
        .markdown-content h1 {
          font-size: 32px;
          font-weight: 700;
          margin: 24px 0 16px 0;
          color: #111827;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 8px;
        }

        .markdown-content h2 {
          font-size: 24px;
          font-weight: 600;
          margin: 20px 0 12px 0;
          color: #1f2937;
        }

        .markdown-content h3 {
          font-size: 20px;
          font-weight: 600;
          margin: 16px 0 8px 0;
          color: #374151;
        }

        .markdown-content p {
          margin: 12px 0;
        }

        .markdown-content code {
          background-color: #f3f4f6;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 13px;
          color: #be123c;
        }

        .markdown-content pre {
          background-color: #1f2937;
          color: #f9fafb;
          padding: 16px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 16px 0;
        }

        .markdown-content pre code {
          background-color: transparent;
          color: #f9fafb;
          padding: 0;
        }

        .markdown-content strong {
          font-weight: 600;
          color: #111827;
        }

        .markdown-content ul {
          margin: 12px 0;
          padding-left: 24px;
        }

        .markdown-content li {
          margin: 6px 0;
          list-style-type: disc;
        }

        .markdown-content a {
          color: #2563eb;
          text-decoration: underline;
        }

        .markdown-content a:hover {
          color: #1d4ed8;
        }

        .doc-table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 14px;
        }

        .doc-table th {
          background-color: #f3f4f6;
          border: 1px solid #d1d5db;
          padding: 10px;
          text-align: left;
          font-weight: 600;
          color: #111827;
        }

        .doc-table td {
          border: 1px solid #e5e7eb;
          padding: 10px;
        }

        .doc-table tr:nth-child(even) {
          background-color: #f9fafb;
        }
      `}</style>
    </div>
  );
}

export default DocumentationViewer;
