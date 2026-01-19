import { useState, useEffect } from 'react';
import api from '../services/api';

const APIDocumentationViewer = () => {
  const [documentation, setDocumentation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentDoc, setCurrentDoc] = useState('api'); // 'api' or 'roadmap'

  useEffect(() => {
    fetchDocumentation();
  }, [currentDoc]);

  const fetchDocumentation = async () => {
    try {
      setLoading(true);
      setSearchTerm(''); // Clear search when switching docs
      const endpoint = currentDoc === 'api' ? '/documentation' : '/documentation/roadmap';
      const response = await api.get(endpoint);

      if (response.data.success) {
        setDocumentation(response.data.documentation);
      } else {
        setError('Failed to load documentation');
      }
    } catch (err) {
      console.error('Error fetching documentation:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
          return `<h2 key="${index}" style="font-size: 22px; font-weight: bold; margin: 24px 0 16px 0; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">${line.substring(3)}</h2>`;
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
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>
          Documentation
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          {currentDoc === 'api'
            ? 'Complete reference for all 200+ API endpoints in the Corridor Communicator platform'
            : 'Strategic roadmap for building the world\'s most advanced transportation data platform'}
        </p>
      </div>

      {/* Document Selector Tabs */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', borderBottom: '2px solid #e5e7eb' }}>
        <button
          onClick={() => setCurrentDoc('api')}
          style={{
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '600',
            background: 'none',
            border: 'none',
            borderBottom: currentDoc === 'api' ? '3px solid #3b82f6' : '3px solid transparent',
            color: currentDoc === 'api' ? '#3b82f6' : '#6b7280',
            cursor: 'pointer',
            marginBottom: '-2px',
            transition: 'all 0.2s'
          }}
        >
          API Reference
        </button>
        <button
          onClick={() => setCurrentDoc('roadmap')}
          style={{
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: '600',
            background: 'none',
            border: 'none',
            borderBottom: currentDoc === 'roadmap' ? '3px solid #3b82f6' : '3px solid transparent',
            color: currentDoc === 'roadmap' ? '#3b82f6' : '#6b7280',
            cursor: 'pointer',
            marginBottom: '-2px',
            transition: 'all 0.2s'
          }}
        >
          Strategic Roadmap
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
          Last updated: January 19, 2026
        </p>
      </div>
    </div>
  );
};

export default APIDocumentationViewer;
