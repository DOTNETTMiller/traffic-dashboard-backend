import { useState, useEffect, useRef } from 'react';
import { config } from '../config';

function DocumentationViewer() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeDoc, setActiveDoc] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const contentRef = useRef(null);

  const docs = [
    {
      key: 'member-state-overview',
      title: 'Member State Overview',
      url: '/docs/member-state-overview.md',
      pdfUrl: `${config.apiUrl}/pdfs/Member-State-Overview.pdf`,
      description: 'Comprehensive guide for state DOTs covering features, benefits, use cases, technical specifications, and getting started. Includes details on 46+ state integrations, real-time operations, and digital infrastructure capabilities.',
      icon: '🏛️'
    },
    {
      key: 'roi-analysis',
      title: 'ROI Analysis',
      url: '/docs/roi-analysis.md',
      pdfUrl: `${config.apiUrl}/pdfs/ROI-Analysis.pdf`,
      description: 'Comprehensive return on investment analysis with cost-benefit calculations, payback periods (1-3 months), grant funding multipliers (3-10x), detailed case studies, and financial justification showing 300-15,000% 3-year ROI.',
      icon: '💰'
    },
    {
      key: 'executive-business-plan',
      title: 'Executive Business Plan',
      url: '/docs/executive-business-plan.md',
      pdfUrl: `${config.apiUrl}/pdfs/Executive-Business-Plan.pdf`,
      description: 'Strategic business plan for DOT leadership including market analysis, revenue models, partnership opportunities, competitive positioning, and growth strategy for multi-state corridor management.',
      icon: '📊'
    },
    {
      key: 'digital-infrastructure',
      title: 'Digital Infrastructure Overview',
      url: '/docs/digital-infrastructure.md',
      pdfUrl: `${config.apiUrl}/pdfs/Digital-Infrastructure-Documentation.pdf`,
      description: 'Complete guide to BIM/IFC integration with ITS operations, digital twin workflows, gap analysis engines, and connected/autonomous vehicle (CAV) support capabilities.',
      icon: '🏗️'
    },
    {
      key: 'arc-its',
      title: 'ARC-ITS & IFC Integration',
      url: '/docs/arc-its-ifc-integration.md',
      pdfUrl: `${config.apiUrl}/pdfs/BIM-Integration-Strategy.pdf`,
      description: 'Technical documentation on how IFC Building Information Models integrate with Advanced Regional Center (ARC) Intelligent Transportation Systems operational data using NTCIP, SAE J2735, and IEEE 1609 standards.',
      icon: '🔗'
    },
    {
      key: 'ifc-quick-start',
      title: 'IFC Quick Start Guide',
      url: '/docs/ifc-quick-start-guide.md',
      pdfUrl: `${config.apiUrl}/pdfs/IFC-Quick-Start-Guide.pdf`,
      description: '30-day implementation plan to transform CAD design files into operational digital twins. Step-by-step process for converting Civil 3D, MicroStation, and OpenRoads files to IFC format with ITS integration.',
      icon: '🚀'
    },
    {
      key: 'ifc-procurement',
      title: 'IFC Procurement Toolkit',
      url: '/docs/ifc-procurement-toolkit.md',
      pdfUrl: `${config.apiUrl}/pdfs/IFC-Procurement-Toolkit.pdf`,
      description: 'Ready-to-use RFP language, technical specifications, and QA/QC acceptance criteria for state DOTs requiring BIM/IFC deliverables with operational digital infrastructure capabilities.',
      icon: '📋'
    },
    {
      key: 'standards-crosswalk',
      title: 'Digital Standards Crosswalk',
      url: '/docs/digital-standards-crosswalk.md',
      pdfUrl: `${config.apiUrl}/pdfs/Digital-Standards-Crosswalk.pdf`,
      description: 'Lifecycle standards mapping for infrastructure interoperability across all project phases: Planning → Survey → Design → Construction → Operations → Maintenance. Maps WZDx, IFC, NTCIP, SAE J2735, and more.',
      icon: '🔄'
    },
    {
      key: 'using-crosswalk',
      title: 'Using the Digital Lifecycle Crosswalk',
      url: '/docs/using-digital-lifecycle-crosswalk.md',
      pdfUrl: `${config.apiUrl}/pdfs/Using-Digital-Lifecycle-Crosswalk.pdf`,
      description: 'Practical guide showing how to use the Digital Standard Lifecycle spreadsheet for developing RFPs, validating consultant submissions, integrating gap analysis, and training staff.',
      icon: '📖'
    },
    {
      key: 'pooled-fund-enablement',
      title: 'Pooled Fund Enablement',
      url: '/docs/pooled-fund-enablement.md',
      pdfUrl: `${config.apiUrl}/pdfs/Pooled-Fund-Enablement.pdf`,
      description: 'How DOT Corridor Communicator enables the Connected Corridors Advancement Initiative (CCAI) Pooled Fund Study for I-80/I-35 corridors across 8 states with $2M budget.',
      icon: '🤝'
    },
    {
      key: 'pooled-fund-digital',
      title: 'Pooled Fund Digital Infrastructure',
      url: '/docs/pooled-fund-digital-infrastructure.md',
      pdfUrl: `${config.apiUrl}/pdfs/Pooled-Fund-Digital-Infrastructure.pdf`,
      description: 'Framework for multi-state collaboration on digital infrastructure initiatives through FHWA pooled fund studies. Addresses BIM/IFC implementation, ARC-ITS integration, and corridor-level digital twins.',
      icon: '🌐'
    },
    {
      key: 'data-quality',
      title: 'Event Data Quality Standards',
      url: '/docs/data-quality.md',
      pdfUrl: `${config.apiUrl}/pdfs/Data-Quality-Standards.pdf`,
      description: 'Data quality standards and end time coverage metrics for traffic events across WZDx, FEU-G, and custom feeds. Includes 7-dimension quality scoring framework.',
      icon: '✅'
    },
    {
      key: 'normalization',
      title: 'Data Normalization Strategy',
      url: '/docs/DATA_NORMALIZATION.md',
      pdfUrl: `${config.apiUrl}/pdfs/Data-Normalization-Strategy.pdf`,
      description: 'Technical documentation on how we normalize data from 46+ different state sources (WZDx, FEU-G, custom APIs, RSS) into a unified format for corridor-level analysis.',
      icon: '⚙️'
    },
    {
      key: 'cifs-compliance',
      title: 'CIFS Compliance Guide',
      url: '/docs/cifs-compliance-guide.md',
      pdfUrl: `${config.apiUrl}/pdfs/CIFS-Compliance-Guide.pdf`,
      description: 'Step-by-step guide for state DOTs to create CIFS-compliant data feeds using SAE J2735 TIM/CV-TIM formats, ITIS codes, and WZDx interoperability. Includes Python and Node.js implementation examples.',
      icon: '📡'
    },
    {
      key: 'jstan-overview',
      title: 'AASHTO JSTAN Overview',
      url: '/docs/AASHTO_JSTAN_OVERVIEW.md',
      pdfUrl: `${config.apiUrl}/docs/AASHTO_JSTAN_OVERVIEW.md?format=pdf`,
      description: 'Overview of AASHTO Joint Standards for Technology Applications Notice (JSTAN) program, governance model, and how it enables multi-state technology coordination.',
      icon: '📋'
    },
    {
      key: 'grant-writing-toolkit',
      title: 'Grant Writing Toolkit',
      url: '/docs/GRANT_WRITING_TOOLKIT_README.md',
      pdfUrl: `${config.apiUrl}/docs/GRANT_WRITING_TOOLKIT_README.md?format=pdf`,
      description: 'Complete toolkit for federal grant applications based on SAAFIR lessons learned. Includes comprehensive guide, executive summary, working checklist, and templates.',
      icon: '💰'
    },
    {
      key: 'grant-application-guide',
      title: 'Federal Grant Application Guide',
      url: '/docs/FEDERAL_GRANT_APPLICATION_GUIDE.md',
      pdfUrl: `${config.apiUrl}/docs/FEDERAL_GRANT_APPLICATION_GUIDE.md?format=pdf`,
      description: '60+ page comprehensive manual for developing competitive federal transportation grant applications. Section-by-section templates, BCA methodology, grant program alignment, and Corridor Communicator-specific guidance.',
      icon: '📝'
    },
    {
      key: 'saafir-lessons',
      title: 'SAAFIR Lessons Learned',
      url: '/docs/SAAFIR_LESSONS_LEARNED_SUMMARY.md',
      pdfUrl: `${config.apiUrl}/docs/SAAFIR_LESSONS_LEARNED_SUMMARY.md?format=pdf`,
      description: 'Executive summary analyzing the 2019 SAAFIR INFRA grant application. What worked (B/C ratio 13.3), what failed (not in state plans), and direct comparison to Corridor Communicator advantages.',
      icon: '📊'
    },
    {
      key: 'grant-checklist',
      title: 'Grant Application Checklist',
      url: '/docs/GRANT_APPLICATION_CHECKLIST.md',
      pdfUrl: `${config.apiUrl}/docs/GRANT_APPLICATION_CHECKLIST.md?format=pdf`,
      description: 'Working document for tracking grant application development through 8 phases. Partnership tracking, budget tracking, quality control checklists, and post-award implementation guide.',
      icon: '✅'
    },
    {
      key: 'pooled-fund-study',
      title: 'TPF-5(566) Pooled Fund Study',
      url: 'https://pooledfund.org/Details/Study/1799',
      external: true,
      description: 'Official FHWA Pooled Fund Study TPF-5(566): Connected Corridors Advancement Initiative (CCAI). Multi-state collaboration for I-80/I-35 corridors with participating states, funding details, and study objectives.',
      icon: '🏛️'
    }
  ];

  useEffect(() => {
    if (activeDoc) {
      loadDocument(activeDoc);
    }
  }, [activeDoc]);

  const loadDocument = async (docKey) => {
    setLoading(true);
    try {
      const doc = docs.find(d => d.key === docKey);
      const response = await fetch(`${config.apiUrl}${doc.url}`);
      if (response.ok) {
        const text = await response.text();
        setContent(text);
      } else {
        setContent(`# Document Not Found\n\nThe document "${doc.title}" could not be loaded.`);
      }
    } catch (error) {
      setContent(`# Error Loading Document\n\n${error.message}`);
    }
    setLoading(false);
  };

  const downloadPDF = async (urlOrTitle, titleOverride = null) => {
    if (generatingPdf) return;

    setGeneratingPdf(true);
    try {
      let pdfUrl;
      let docTitle;

      // Check if first parameter is a URL (pdfUrl from card) or title (from preview)
      if (urlOrTitle && (urlOrTitle.startsWith('http') || urlOrTitle.startsWith('/'))) {
        pdfUrl = urlOrTitle;
        docTitle = titleOverride || 'document';
      } else {
        // It's a title from the preview view, need to find the doc
        const doc = docs.find(d => d.key === activeDoc);
        if (!doc) {
          throw new Error('Document not found');
        }
        // Use backend PDF generation endpoint
        pdfUrl = `${config.apiUrl}${doc.url}?format=pdf`;
        docTitle = doc.title;
      }

      // Download the PDF
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${docTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
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

    // Images (must come before links since images use similar syntax)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, (match, alt, src) => {
      // Convert relative paths to absolute API URLs
      const imageSrc = src.startsWith('./')
        ? `${config.apiUrl}/docs/${src.substring(2)}`
        : src.startsWith('/')
        ? `${config.apiUrl}${src}`
        : src;
      return `<img src="${imageSrc}" alt="${alt}" style="max-width: 200px; height: auto; margin: 10px 0;" />`;
    });

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

  // If viewing a specific document
  if (activeDoc) {
    const doc = docs.find(d => d.key === activeDoc);
    return (
      <div ref={contentRef} className="documentation-viewer" style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Back button */}
        <button
          onClick={() => setActiveDoc(null)}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            backgroundColor: 'white',
            color: '#374151',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ← Back to Documents
        </button>

        {/* Document header */}
        <div style={{
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '16px',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#111827',
              margin: 0
            }}>
              {doc.icon} {doc.title}
            </h1>

            <button
              onClick={() => downloadPDF(doc.title)}
              disabled={generatingPdf}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: generatingPdf ? '#9ca3af' : '#10b981',
                color: 'white',
                cursor: generatingPdf ? 'wait' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                opacity: generatingPdf ? 0.7 : 1
              }}
            >
              {generatingPdf ? '⏳ Opening...' : '🖨️ Print/Save PDF'}
            </button>
          </div>

          <p style={{
            fontSize: '15px',
            color: '#6b7280',
            margin: '12px 0 0 0',
            lineHeight: '1.6'
          }}>
            {doc.description}
          </p>
        </div>

        {/* Document content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
            Loading documentation...
          </div>
        ) : (
          <div
            className="markdown-content"
            style={{
              fontSize: '15px',
              lineHeight: '1.7',
              color: '#1f2937',
              maxHeight: 'calc(100vh - 350px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: '8px',
              paddingBottom: '40px'
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

          /* Custom scrollbar styling */
          .markdown-content::-webkit-scrollbar {
            width: 8px;
          }

          .markdown-content::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 10px;
          }

          .markdown-content::-webkit-scrollbar-thumb {
            background: #3b82f6;
            border-radius: 10px;
          }

          .markdown-content::-webkit-scrollbar-thumb:hover {
            background: #2563eb;
          }
        `}</style>
      </div>
    );
  }

  // Document library view (grid of cards)
  return (
    <div className="documentation-library" style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '32px',
      maxWidth: '1400px',
      margin: '0 auto',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: '#111827',
          margin: '0 0 8px 0'
        }}>
          📚 Documentation Library
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#6b7280',
          margin: 0
        }}>
          Comprehensive guides, technical documentation, and resources for the DOT Corridor Communicator platform
        </p>
      </div>

      {/* Document cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: '24px'
      }}>
        {docs.map(doc => (
          <div
            key={doc.key}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: 'white',
              transition: 'all 0.2s',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Icon and title */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>{doc.icon}</div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#111827',
                margin: 0,
                lineHeight: '1.4'
              }}>
                {doc.title}
              </h3>
            </div>

            {/* Description */}
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: '0 0 20px 0',
              lineHeight: '1.6',
              flex: 1
            }}>
              {doc.description}
            </p>

            {/* Action buttons */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: 'auto'
            }}>
              {doc.external ? (
                // For external links, open in new tab
                <button
                  onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: '1px solid #3b82f6',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                >
                  🔗 Visit External Site
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setActiveDoc(doc.key)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '6px',
                      border: '1px solid #3b82f6',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                  >
                    👁️ Preview
                  </button>
                  <button
                    onClick={() => downloadPDF(doc.pdfUrl, doc.title)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '6px',
                      border: '1px solid #10b981',
                      backgroundColor: '#10b981',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                  >
                    📥 PDF
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* API Feeds section */}
      <div style={{
        marginTop: '40px',
        padding: '20px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#111827',
          margin: '0 0 12px 0'
        }}>
          🔌 API Endpoints
        </h2>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          margin: '0 0 16px 0'
        }}>
          Access real-time traffic data and connected vehicle feeds
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a
            href={`${config.apiUrl}/api/convert/tim`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              backgroundColor: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            📡 SAE J2735 TIM Feed
          </a>
          <a
            href={`${config.apiUrl}/api/convert/tim-cv`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            🚛 SAE J2540 CV-TIM Feed
          </a>
        </div>
      </div>
    </div>
  );
}

export default DocumentationViewer;
