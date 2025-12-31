/**
 * ITS Architecture Integration Component
 *
 * Embeds official USDOT architecture tools:
 * 1. ARC-IT - National reference architecture (framework, standards, service packages)
 * 2. Turbo Architecture - Regional architecture development tool (create your corridor architecture)
 *
 * Turbo Architecture is the modern web-based replacement for the legacy RAD-IT tool.
 */

import React, { useState } from 'react';
import './ITSArchitecture.css';

function ITSArchitecture() {
  const [mainTab, setMainTab] = useState('turbo'); // 'arcit' or 'turbo'
  const [arcitUrl, setArcitUrl] = useState('https://www.arc-it.net/');

  // ARC-IT navigation links (national reference)
  const arcitSections = [
    { name: 'Home', url: 'https://www.arc-it.net/' },
    { name: 'Service Packages', url: 'https://www.arc-it.net/html/servicepackages/servicepackages.html' },
    { name: 'Physical Objects', url: 'https://www.arc-it.net/html/physicalobjects/physicalobjects.html' },
    { name: 'Functional Objects', url: 'https://www.arc-it.net/html/objects/objects.html' },
    { name: 'Information Flows', url: 'https://www.arc-it.net/html/architecture/architecture.html' },
    { name: 'Standards', url: 'https://www.arc-it.net/html/standards/standards.html' }
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'white'
    }}>
      {/* Main Tool Selection Tabs */}
      <div style={{
        background: '#f8f9fa',
        borderBottom: '2px solid #e5e7eb',
        display: 'flex',
        gap: 0
      }}>
        <button
          onClick={() => setMainTab('turbo')}
          style={{
            flex: 1,
            padding: '16px 24px',
            border: 'none',
            background: mainTab === 'turbo' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'transparent',
            color: mainTab === 'turbo' ? 'white' : '#6b7280',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            borderBottom: mainTab === 'turbo' ? '3px solid #059669' : '3px solid transparent',
            transition: 'all 0.2s ease'
          }}
        >
          🏗️ Turbo Architecture
          <div style={{
            fontSize: '11px',
            fontWeight: '400',
            marginTop: '4px',
            opacity: mainTab === 'turbo' ? 0.9 : 0.7
          }}>
            Regional Development Tool (Replaces RAD-IT)
          </div>
        </button>
        <button
          onClick={() => setMainTab('arcit')}
          style={{
            flex: 1,
            padding: '16px 24px',
            border: 'none',
            background: mainTab === 'arcit' ? 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' : 'transparent',
            color: mainTab === 'arcit' ? 'white' : '#6b7280',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            borderBottom: mainTab === 'arcit' ? '3px solid #1e3a8a' : '3px solid transparent',
            transition: 'all 0.2s ease'
          }}
        >
          🏛️ ARC-IT Reference
          <div style={{
            fontSize: '11px',
            fontWeight: '400',
            marginTop: '4px',
            opacity: mainTab === 'arcit' ? 0.9 : 0.7
          }}>
            National Architecture Framework
          </div>
        </button>
      </div>

      {/* Turbo Architecture Tab */}
      {mainTab === 'turbo' && (
        <>
          {/* Turbo Header */}
          <div style={{
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            color: 'white',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
                  🏗️ Turbo Architecture
                </h2>
                <p style={{
                  margin: '5px 0 0 0',
                  fontSize: '14px',
                  opacity: 0.9
                }}>
                  Create and manage your Regional ITS Architecture - Modern replacement for RAD-IT
                </p>
              </div>
              <a
                href="https://www.arc-it.net/turbo/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: '500',
                  border: '1px solid rgba(255,255,255,0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              >
                Open in New Tab ↗
              </a>
            </div>
          </div>

          {/* Turbo iframe */}
          <div style={{
            flex: 1,
            position: 'relative',
            background: '#f5f5f5'
          }}>
            <iframe
              src="https://www.arc-it.net/turbo/"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block'
              }}
              title="Turbo Architecture - Regional ITS Architecture Development"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-modals"
            />
          </div>

          {/* Turbo Footer */}
          <div style={{
            background: '#f8f9fa',
            borderTop: '1px solid #e5e7eb',
            padding: '12px 20px',
            fontSize: '12px',
            color: '#6b7280',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong>Turbo Architecture</strong> - Web-based Regional ITS Architecture tool (replaces legacy RAD-IT)
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <a
                href="https://www.arc-it.net/turbo/html/help/help.html"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#059669', textDecoration: 'none' }}
              >
                Turbo Help
              </a>
              <a
                href="https://www.its.dot.gov/arch/regional.htm"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#059669', textDecoration: 'none' }}
              >
                Regional Architecture Guide
              </a>
            </div>
          </div>
        </>
      )}

      {/* ARC-IT Reference Tab */}
      {mainTab === 'arcit' && (
        <>
          {/* ARC-IT Header */}
          <div style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
            color: 'white',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '15px'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
                  🏛️ ARC-IT Reference Architecture
                </h2>
                <p style={{
                  margin: '5px 0 0 0',
                  fontSize: '14px',
                  opacity: 0.9
                }}>
                  National ITS Architecture Framework - Service Packages, Standards, and Reference Materials
                </p>
              </div>
              <a
                href={arcitUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: '500',
                  border: '1px solid rgba(255,255,255,0.3)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              >
                Open in New Tab ↗
              </a>
            </div>

            {/* Quick Navigation Buttons */}
            <div style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              {arcitSections.map((section) => (
                <button
                  key={section.name}
                  onClick={() => setArcitUrl(section.url)}
                  style={{
                    background: arcitUrl === section.url
                      ? 'rgba(255,255,255,0.3)'
                      : 'rgba(255,255,255,0.1)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    if (arcitUrl !== section.url) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (arcitUrl !== section.url) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                    }
                  }}
                >
                  {section.name}
                </button>
              ))}
            </div>
          </div>

          {/* ARC-IT iframe */}
          <div style={{
            flex: 1,
            position: 'relative',
            background: '#f5f5f5'
          }}>
            <iframe
              src={arcitUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block'
              }}
              title="ARC-IT National Reference Architecture"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
            />
          </div>

          {/* ARC-IT Footer */}
          <div style={{
            background: '#f8f9fa',
            borderTop: '1px solid #e5e7eb',
            padding: '12px 20px',
            fontSize: '12px',
            color: '#6b7280',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong>ARC-IT 10.0</strong> - National ITS Architecture maintained by USDOT ITS Joint Program Office
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
              <a
                href="https://www.arc-it.net/html/help/help.html"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#3b82f6', textDecoration: 'none' }}
              >
                ARC-IT Help
              </a>
              <a
                href="https://www.its.dot.gov/research_archives/arch/index.htm"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#3b82f6', textDecoration: 'none' }}
              >
                ITS Architecture Resources
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ITSArchitecture;
