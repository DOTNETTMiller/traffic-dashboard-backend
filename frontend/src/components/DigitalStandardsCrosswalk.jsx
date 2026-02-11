import { useState, useEffect } from 'react';
import { config } from '../config';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function DigitalStandardsCrosswalk() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('crosswalk');
  const [downloading, setDownloading] = useState(false);

  const documents = {
    crosswalk: {
      title: 'Digital Standards Crosswalk',
      url: '/docs/digital-standards-crosswalk.md',
      description: 'Comprehensive crosswalk of digital standards across infrastructure project lifecycle (Planning→Survey→Design→Construction→Operations→Maintenance)',
      filename: 'Digital-Standards-Crosswalk.pdf'
    },
    guide: {
      title: 'Using the Digital Lifecycle Crosswalk',
      url: '/docs/using-digital-lifecycle-crosswalk.md',
      description: 'Practical guide for RFP development, validation, gap analysis, training, and grant applications',
      filename: 'Using-Digital-Lifecycle-Crosswalk.pdf'
    }
  };

  useEffect(() => {
    loadDocument(activeTab);
  }, [activeTab]);

  const loadDocument = async (docKey) => {
    setLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}${documents[docKey].url}`);
      if (response.ok) {
        const text = await response.text();
        setContent(text);
      } else {
        setContent(`# Document Not Found\n\nThe document "${documents[docKey].title}" could not be loaded.`);
      }
    } catch (error) {
      setContent(`# Error Loading Document\n\n${error.message}`);
    }
    setLoading(false);
  };

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const pdfUtils = await import('../utils/pdfExport');
      const doc = pdfUtils.createPDF();

      // Add header
      let yPos = pdfUtils.addHeader(
        doc,
        documents[activeTab].title,
        documents[activeTab].description,
        { titleColor: pdfUtils.COLORS.success }
      );

      // Add organization badge
      yPos = pdfUtils.addSectionHeading(
        doc,
        'DOT Corridor Communicator Digital Infrastructure Suite',
        yPos,
        3,
        { color: pdfUtils.COLORS.gray }
      );

      // Process content
      yPos = pdfUtils.processMarkdownForPDF(doc, content, yPos, {
        margin: pdfUtils.DEFAULT_MARGINS
      });

      // Add footer note
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...pdfUtils.COLORS.gray);
      doc.text(
        'For questions about implementing standards crosswalks, contact your administrator.',
        pdfUtils.DEFAULT_MARGINS.left,
        pageHeight - 20
      );

      // Save
      pdfUtils.savePDF(doc, documents[activeTab].filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '20px',
      backgroundcolor: '#111827',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '30px',
        borderBottom: '2px solid #e5e7eb',
        paddingBottom: '20px'
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '600',
          color: '#1a1a1a',
          marginBottom: '10px'
        }}>
          Digital Standards Crosswalk
        </h1>
        <p style={{
          fontSize: '1.1rem',
          color: '#666',
          marginBottom: '20px'
        }}>
          Comprehensive lifecycle standards mapping for infrastructure interoperability
        </p>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginTop: '20px'
        }}>
          <button
            onClick={() => setActiveTab('crosswalk')}
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === 'crosswalk' ? '#059669' : 'white',
              color: activeTab === 'crosswalk' ? 'white' : '#374151',
              border: `2px solid ${activeTab === 'crosswalk' ? '#059669' : '#e5e7eb'}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            Standards Crosswalk
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === 'guide' ? '#059669' : 'white',
              color: activeTab === 'guide' ? 'white' : '#374151',
              border: `2px solid ${activeTab === 'guide' ? '#059669' : '#e5e7eb'}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            Practical Guide
          </button>
          <button
            onClick={downloadPDF}
            disabled={downloading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: '#111827',
              border: 'none',
              borderRadius: '6px',
              cursor: downloading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              marginLeft: 'auto',
              opacity: downloading ? 0.6 : 1,
              transition: 'all 0.2s'
            }}
          >
            {downloading ? 'Generating PDF...' : '📄 Download PDF'}
          </button>
        </div>
      </div>

      {/* Document Info */}
      <div style={{
        backgroundcolor: '#6b7280',
        border: '1px solid #86efac',
        borderRadius: '6px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h3 style={{
          fontSize: '1rem',
          fontWeight: '600',
          color: '#059669',
          marginBottom: '5px'
        }}>
          {documents[activeTab].title}
        </h3>
        <p style={{
          fontSize: '0.9rem',
          color: '#166534',
          margin: 0
        }}>
          {documents[activeTab].description}
        </p>
      </div>

      {/* Content */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '30px',
        minHeight: '500px'
      }}>
        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#666'
          }}>
            Loading documentation...
          </div>
        ) : (
          <div className="markdown-content" style={{
            fontSize: '15px',
            lineHeight: '1.7',
            color: '#1a1a1a'
          }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '30px',
        paddingTop: '20px',
        borderTop: '1px solid #e5e7eb',
        textAlign: 'center',
        color: '#666',
        fontSize: '0.9rem'
      }}>
        <p>
          Part of the DOT Corridor Communicator Digital Infrastructure Suite
        </p>
        <p style={{ marginTop: '10px' }}>
          For questions about implementing standards crosswalks, contact your administrator.
        </p>
      </div>
    </div>
  );
}

export default DigitalStandardsCrosswalk;

