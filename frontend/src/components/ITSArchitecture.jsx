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
  const [mainTab, setMainTab] = useState('arcit'); // 'arcit' or 'radit'
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
          onClick={() => setMainTab('radit')}
          style={{
            flex: 1,
            padding: '16px 24px',
            border: 'none',
            background: mainTab === 'radit' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'transparent',
            color: mainTab === 'radit' ? 'white' : '#6b7280',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            borderBottom: mainTab === 'radit' ? '3px solid #059669' : '3px solid transparent',
            transition: 'all 0.2s ease'
          }}
        >
          🏗️ RAD-IT Tool
          <div style={{
            fontSize: '11px',
            fontWeight: '400',
            marginTop: '4px',
            opacity: mainTab === 'radit' ? 0.9 : 0.7
          }}>
            Regional Architecture Development Tool
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

      {/* RAD-IT Tool Tab */}
      {mainTab === 'radit' && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: '#f8f9fa'
        }}>
          {/* RAD-IT Header */}
          <div style={{
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            color: 'white',
            padding: '30px',
            textAlign: 'center'
          }}>
            <h2 style={{ margin: 0, fontSize: '32px', fontWeight: '600' }}>
              🏗️ RAD-IT v9.3
            </h2>
            <p style={{
              margin: '10px 0 0 0',
              fontSize: '16px',
              opacity: 0.95
            }}>
              Regional Architecture Development for Intelligent Transportation Systems
            </p>
            <p style={{
              margin: '8px 0 0 0',
              fontSize: '13px',
              opacity: 0.85
            }}>
              Desktop application for Windows • December 2024 Release
            </p>
          </div>

          {/* RAD-IT Content */}
          <div style={{
            flex: 1,
            padding: '40px',
            maxWidth: '900px',
            margin: '0 auto',
            overflow: 'auto'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '8px',
              padding: '30px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              <h3 style={{ marginTop: 0, color: '#059669' }}>About RAD-IT</h3>
              <p style={{ lineHeight: '1.6', color: '#374151' }}>
                RAD-IT is a software tool that provides an easy way to personalize and customize ARC-IT for a specific region.
                It facilitates the development of regional and project ITS architectures using the National ITS Architecture (ARC-IT) as a starting point.
              </p>
              <p style={{ lineHeight: '1.6', color: '#374151' }}>
                RAD-IT utilizes user inputs and information from the ARC-IT databases to provide tabular and graphical outputs
                comprising a high-level representation of your Regional or Project Architecture.
              </p>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '8px',
              padding: '30px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              <h3 style={{ marginTop: 0, color: '#059669' }}>Download RAD-IT</h3>
              <p style={{ lineHeight: '1.6', color: '#374151', marginBottom: '20px' }}>
                RAD-IT is a desktop application for Windows. Download and install the software to begin developing your regional ITS architecture.
              </p>

              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <a
                  href="https://www.arc-it.net/html/resources/radit.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '15px',
                    fontWeight: '600',
                    display: 'inline-block',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  📥 Download RAD-IT v9.3
                </a>
                <a
                  href="https://www.arc-it.org/tools/RAD-ITHelp2024-05-07.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'white',
                    color: '#059669',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    textDecoration: 'none',
                    fontSize: '15px',
                    fontWeight: '600',
                    border: '2px solid #059669',
                    display: 'inline-block'
                  }}
                >
                  📖 User Manual (PDF)
                </a>
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '8px',
              padding: '30px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              marginBottom: '20px'
            }}>
              <h3 style={{ marginTop: 0, color: '#059669' }}>Key Features</h3>
              <ul style={{ lineHeight: '1.8', color: '#374151' }}>
                <li><strong>Customize ARC-IT:</strong> Tailor the National ITS Architecture to your region's specific needs</li>
                <li><strong>Stakeholder Management:</strong> Identify and manage agencies and stakeholders in your region</li>
                <li><strong>Service Package Selection:</strong> Choose from 22 ARC-IT service packages relevant to your corridor</li>
                <li><strong>Standards Mapping:</strong> Align your architecture with ITS standards (SAE J2735, NTCIP, etc.)</li>
                <li><strong>Visual Outputs:</strong> Generate diagrams and reports for planning and stakeholder presentations</li>
                <li><strong>Project Architectures:</strong> Develop detailed architectures for specific ITS projects</li>
              </ul>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '8px',
              padding: '30px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0, color: '#059669' }}>Additional Resources</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <a
                  href="https://www.arc-it.net/html/raguide/raguide.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#059669', textDecoration: 'none', fontSize: '15px' }}
                >
                  📚 Regional ITS Architecture Guide
                </a>
                <a
                  href="https://www.arc-it.net/html/archuse/regional.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#059669', textDecoration: 'none', fontSize: '15px' }}
                >
                  🎯 Regional Architecture Best Practices
                </a>
                <a
                  href="https://www.arc-it.net/html/whatsnew/whatsnewradit.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#059669', textDecoration: 'none', fontSize: '15px' }}
                >
                  🆕 What's New in RAD-IT
                </a>
                <a
                  href="https://www.its.dot.gov/arch/regional.htm"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#059669', textDecoration: 'none', fontSize: '15px' }}
                >
                  🏛️ USDOT Regional Architecture Resources
                </a>
              </div>
            </div>
          </div>
        </div>
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
