import { useState, useEffect } from 'react';
import api from '../services/api';
import jsPDF from 'jspdf';

const APIDocumentationViewer = () => {
  const [documentation, setDocumentation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentDoc, setCurrentDoc] = useState('api'); // 'api', 'roadmap', or doc filename
  const [documentList, setDocumentList] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    fetchDocumentList();
  }, []);

  useEffect(() => {
    fetchDocumentation();
  }, [currentDoc]);

  const fetchDocumentList = async () => {
    try {
      const response = await api.get('/api/documentation/list');
      if (response.data.success) {
        setDocumentList(response.data.documents);
      }
    } catch (err) {
      console.error('Error fetching document list:', err);
    }
  };

  const fetchDocumentation = async () => {
    try {
      setLoading(true);
      setError(null);
      setSearchTerm('');

      let endpoint;
      if (currentDoc === 'api') {
        endpoint = '/api/documentation/auto';
      } else if (currentDoc === 'roadmap') {
        endpoint = '/api/documentation/roadmap';
      } else {
        endpoint = `/api/documentation/${currentDoc}`;
      }

      console.log('Fetching documentation from:', endpoint);
      const response = await api.get(endpoint);
      console.log('Documentation response:', response.data);

      if (response.data.success) {
        setDocumentation(response.data.documentation);
      } else {
        setError('Failed to load documentation');
      }
    } catch (err) {
      console.error('Error fetching documentation:', err);
      setError(err.message || 'Failed to load documentation');
    } finally {
      setLoading(false);
    }
  };

  const downloadAsPDF = () => {
    const pdf = new jsPDF('p', 'pt', 'letter');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 40;
    const maxWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Get document title
    const docTitle = currentDoc === 'api'
      ? 'API Reference'
      : currentDoc === 'roadmap'
      ? 'Strategic Roadmap'
      : currentDoc.replace(/_/g, ' ').replace(/-/g, ' ');

    // Title
    pdf.setFontSize(18);
    pdf.setFont(undefined, 'bold');
    pdf.text(docTitle, margin, yPosition);
    yPosition += 30;

    // Subtitle
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text('DOT Corridor Communicator Documentation', margin, yPosition);
    yPosition += 10;
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, yPosition);
    yPosition += 30;

    // Convert markdown to plain text (remove markdown syntax)
    const plainText = documentation
      .replace(/#{1,6}\s/g, '') // Remove header markers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .replace(/^-\s/gm, '• ') // Convert list markers
      .replace(/---/g, '───────────────────────────'); // Horizontal rules

    // Split into lines and add to PDF
    const lines = pdf.splitTextToSize(plainText, maxWidth);

    pdf.setFontSize(9);
    for (let i = 0; i < lines.length; i++) {
      if (yPosition > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(lines[i], margin, yPosition);
      yPosition += 12;
    }

    // Save PDF
    const filename = `${docTitle.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);
  };

  // Simple markdown-to-HTML converter for basic formatting
  const renderMarkdown = (markdown) => {
    if (!markdown) return '';

    // Filter by search term if present
    let filteredContent = markdown;
    if (searchTerm.trim()) {
      const lines = markdown.split('\n');
      const searchLower = searchTerm.toLowerCase();
      const matchedSections = [];
      let currentSection = [];
      let inMatchingSection = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this is a header
        if (line.startsWith('#')) {
          // Save previous section if it was matching
          if (inMatchingSection && currentSection.length > 0) {
            matchedSections.push(...currentSection);
          }
          currentSection = [line];
          inMatchingSection = false;
        } else {
          currentSection.push(line);
        }

        // Check if line matches search
        if (line.toLowerCase().includes(searchLower)) {
          inMatchingSection = true;
        }
      }

      // Add last section if matching
      if (inMatchingSection && currentSection.length > 0) {
        matchedSections.push(...currentSection);
      }

      filteredContent = matchedSections.length > 0 ? matchedSections.join('\n') : markdown;
    }

    return filteredContent
      .split('\n')
      .map((line, index) => {
        // Headers
        if (line.startsWith('### ')) {
          return `<h3 key="${index}" style="font-size: 18px; font-weight: bold; margin: 20px 0 12px 0; color: #1f2937;">${line.substring(4)}</h3>`;
        }
        if (line.startsWith('## ')) {
          const headerText = line.substring(3);
          const headerId = headerText.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          return `<h2 id="${headerId}" key="${index}" style="font-size: 22px; font-weight: bold; margin: 24px 0 16px 0; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">${headerText}</h2>`;
        }
        if (line.startsWith('# ')) {
          return `<h1 key="${index}" style="font-size: 28px; font-weight: bold; margin: 32px 0 20px 0; color: #111827;">${line.substring(2)}</h1>`;
        }

        // Code blocks
        if (line.startsWith('```')) {
          return ''; // We'll handle code blocks separately
        }

        // Bold
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Inline code
        line = line.replace(/`([^`]+)`/g, '<code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 13px;">$1</code>');

        // Links
        line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #3b82f6; text-decoration: underline;">$1</a>');

        // List items
        if (line.trim().startsWith('- ')) {
          return `<li key="${index}" style="margin: 4px 0; padding-left: 8px;">${line.substring(2)}</li>`;
        }

        // Empty lines
        if (line.trim() === '') {
          return '<br key="${index}" />';
        }

        // Horizontal rules
        if (line.trim() === '---') {
          return '<hr key="${index}" style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />';
        }

        // Regular paragraphs
        return `<p key="${index}" style="margin: 8px 0; line-height: 1.6; color: #374151;">${line}</p>`;
      })
      .join('');
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading API documentation...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: '#ef4444' }}>Error: {error}</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      {showSidebar && (
        <div style={{
          width: '300px',
          background: '#f9fafb',
          borderRight: '1px solid #e5e7eb',
          overflowY: 'auto',
          padding: '20px'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>
              Documentation
            </h3>
            <button
              onClick={() => setShowSidebar(false)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                background: '#e5e7eb',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Hide Sidebar
            </button>
          </div>

          {/* Special Sections */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase' }}>
              PLATFORM DOCS
            </div>
            <button
              onClick={() => setCurrentDoc('api')}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: currentDoc === 'api' ? '#3b82f6' : 'white',
                color: currentDoc === 'api' ? 'white' : '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '4px',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                fontWeight: '500'
              }}
            >
              📘 API REFERENCE (291 ENDPOINTS)
            </button>
            <button
              onClick={() => setCurrentDoc('roadmap')}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: currentDoc === 'roadmap' ? '#3b82f6' : 'white',
                color: currentDoc === 'roadmap' ? 'white' : '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                cursor: 'pointer',
                marginBottom: '4px',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                fontWeight: '500'
              }}
            >
              🗺️ STRATEGIC ROADMAP
            </button>
          </div>

          {/* All Documentation Files - Organized by Category */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '8px', textTransform: 'uppercase' }}>
              GUIDES & RESOURCES ({documentList.length})
            </div>
            {documentList.map(doc => (
              <button
                key={doc.path}
                onClick={() => setCurrentDoc(doc.path)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  background: currentDoc === doc.path ? '#3b82f6' : 'white',
                  color: currentDoc === doc.path ? 'white' : '#374151',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  fontSize: '12px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  fontWeight: '500'
                }}
                title={doc.title.toUpperCase()}
              >
                {doc.title.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'center' }}>
          {!showSidebar && (
            <button
              onClick={() => setShowSidebar(true)}
              style={{
                padding: '8px 16px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Show Sidebar
            </button>
          )}
          <button
            onClick={downloadAsPDF}
            disabled={loading || !documentation}
            style={{
              padding: '8px 16px',
              background: loading || !documentation ? '#d1d5db' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: loading || !documentation ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            📥 Download PDF
          </button>
        </div>

      {/* Search Box */}
      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Search documentation... (e.g., 'leaderboard', 'quality', 'state')"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            fontSize: '14px',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            outline: 'none',
            transition: 'border 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            style={{
              marginTop: '8px',
              padding: '6px 12px',
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            Clear search
          </button>
        )}
      </div>

      {/* Documentation Content */}
      <div
        style={{
          background: 'white',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb'
        }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(documentation) }}
      />

        {/* Footer */}
        <div style={{
          marginTop: '32px',
          padding: '20px',
          background: '#f9fafb',
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#6b7280'
        }}>
          <p style={{ margin: 0 }}>
            <strong>Base URL:</strong> https://corridor-communication-dashboard-production.up.railway.app
          </p>
          <p style={{ margin: '8px 0 0 0' }}>
            Last updated: January 22, 2026 • {documentList.length} guides available
          </p>
        </div>
      </div>
    </div>
  );
};

export default APIDocumentationViewer;
