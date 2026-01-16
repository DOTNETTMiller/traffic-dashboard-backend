import { useState } from 'react';

export default function FederalGrantResources({ darkMode = false }) {
  const [expandedGrant, setExpandedGrant] = useState(null);

  const theme = {
    bg: darkMode ? '#0f172a' : '#ffffff',
    bgSecondary: darkMode ? '#1e293b' : '#f8fafc',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    accent: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
  };

  const federalGrants = [
    {
      id: 'smart',
      name: 'SMART Grant',
      fullName: 'Strengthening Mobility and Revolutionizing Transportation',
      agency: 'USDOT - Office of the Secretary',
      funding: '$100M - $500M annually',
      eligibility: 'State DOTs, Local Governments, Transit Agencies, MPOs',
      focus: [
        'Advanced Transportation Technologies',
        'Coordinated Automation',
        'Connected Vehicles',
        'Sensor-Based Infrastructure',
        'Systems Integration'
      ],
      arcItsRelevance: 'HIGH - Requires ARC-ITS compliant ITS inventory',
      nofoUrl: 'https://www.transportation.gov/grants/SMART',
      grantsGovUrl: 'https://www.grants.gov/web/grants/view-opportunity.html?oppId=355389',
      applicationPeriod: 'FY24 Stage 2 closed. FY25 Stage 2 expected Fall 2025',
      keyRequirements: [
        'Technology deployment plan',
        'Safety impact analysis',
        'Partnership agreements',
        'Data sharing commitments',
        'ARC-IT architecture alignment'
      ],
      typicalAward: '$2M - $15M',
      matchRequired: 'Up to 50% (varies by project type)',
      color: '#3b82f6'
    },
    {
      id: 'raise',
      name: 'RAISE Grant',
      fullName: 'Rebuilding American Infrastructure with Sustainability and Equity',
      agency: 'USDOT - Office of the Secretary',
      funding: '$1.5B - $2.26B annually',
      eligibility: 'State DOTs, Local Governments, Transit Agencies, Port Authorities, Tribal Governments',
      focus: [
        'Multimodal Projects',
        'Safety Improvements',
        'Environmental Sustainability',
        'Quality of Life',
        'Mobility and Community Connectivity',
        'Economic Competitiveness'
      ],
      arcItsRelevance: 'MEDIUM - ITS components strengthen applications',
      nofoUrl: 'https://www.transportation.gov/RAISEgrants/raise-nofo',
      grantsGovUrl: 'https://www.grants.gov/web/grants/view-opportunity.html?oppId=356890',
      applicationPeriod: 'FY2025: Deadline January 30, 2025 (CFDA 20.933)',
      keyRequirements: [
        'Benefit-Cost Analysis (BCA)',
        'Project readiness documentation',
        'Community engagement plan',
        'Environmental review status',
        'Safety analysis'
      ],
      typicalAward: '$5M - $25M',
      matchRequired: '20% minimum',
      color: '#10b981'
    },
    {
      id: 'fmcsa-itd',
      name: 'FMCSA IT-D',
      fullName: 'Commercial Motor Vehicle Information Technology and Data Grant',
      agency: 'FMCSA - Federal Motor Carrier Safety Administration',
      funding: '$10M - $50M annually',
      eligibility: 'State DOTs, State Motor Carrier Safety Agencies',
      focus: [
        'CMV Safety Data Systems',
        'Electronic Screening Systems',
        'Weigh Station Technology',
        'PrePass/Bypass Systems',
        'Safety Information Exchange',
        'Credential Verification'
      ],
      arcItsRelevance: 'HIGH - Freight and commercial vehicle ITS focus',
      nofoUrl: 'https://www.fmcsa.dot.gov/fy25grantfundingopportunities',
      grantsGovUrl: 'https://www.fmcsa.dot.gov/fy25grantfundingopportunities',
      applicationPeriod: 'FY2025: Deadline June 20, 2025 (search "HP-ITD" on Grants.gov)',
      keyRequirements: [
        'CMV safety data plan',
        'System interoperability plan',
        'Data sharing agreements',
        'State MCSAP participation',
        'Performance metrics'
      ],
      typicalAward: '$500K - $3M',
      matchRequired: '20% match',
      color: '#f59e0b'
    },
    {
      id: 'protect',
      name: 'PROTECT Grant',
      fullName: 'Promoting Resilient Operations for Transformative, Efficient, and Cost-Saving Transportation',
      agency: 'USDOT - FHWA',
      funding: '$848M - $1.4B annually (FY 2022-2026)',
      eligibility: 'State DOTs, MPOs, Local Governments, Tribal Governments',
      focus: [
        'Resilience Improvements',
        'Evacuation Routes',
        'At-Risk Infrastructure',
        'Natural Disaster Protection',
        'Real-Time Monitoring Systems'
      ],
      arcItsRelevance: 'MEDIUM - ITS for emergency management and monitoring',
      nofoUrl: 'https://www.fhwa.dot.gov/environment/protect/discretionary/',
      grantsGovUrl: 'https://www.grants.gov/web/grants/view-opportunity.html?oppId=356840',
      applicationPeriod: 'NOFO under review by FHWA. Check grants.gov for re-posting',
      keyRequirements: [
        'Resilience improvement plan',
        'Vulnerability assessment',
        'Risk analysis',
        'Evacuation planning',
        'Multi-hazard mitigation'
      ],
      typicalAward: '$5M - $50M',
      matchRequired: 'Formula: 0%, Competitive: 25-40%',
      color: '#8b5cf6'
    },
    {
      id: 'attain',
      name: 'ATTAIN (formerly ATCMTD)',
      fullName: 'Advanced Transportation Technologies and Innovative Mobility Deployment',
      agency: 'USDOT - FHWA',
      funding: '$60M annually (FY2022-2026)',
      eligibility: 'State DOTs, Local Governments, Transit Agencies, Metropolitan Planning Organizations',
      focus: [
        'Advanced Traveler Information',
        'Traffic Signal Optimization',
        'Electronic Pricing',
        'Vehicle-to-Infrastructure (V2I)',
        'Automated Transportation',
        'ITS Integration'
      ],
      arcItsRelevance: 'VERY HIGH - Core ITS technology deployment',
      nofoUrl: 'https://www.fhwa.dot.gov/infrastructure-investment-and-jobs-act/attain.cfm',
      grantsGovUrl: 'https://www.grants.gov/web/grants/view-opportunity.html?oppId=343624',
      applicationPeriod: '$60M annually (FY22-26). Check grants.gov for current NOFO',
      keyRequirements: [
        'Technology deployment plan',
        'Data sharing requirements',
        'Interoperability standards',
        'ARC-IT alignment required',
        'Performance measurement plan'
      ],
      typicalAward: '$2M - $12M',
      matchRequired: '50% minimum',
      color: '#ec4899'
    },
    {
      id: 'infra',
      name: 'INFRA Grant',
      fullName: 'Infrastructure for Rebuilding America',
      agency: 'USDOT - Office of the Secretary',
      funding: '$1.5B annually',
      eligibility: 'State DOTs, Local Governments, Transit Agencies, Port Authorities',
      focus: [
        'Freight and Highway Projects',
        'Multimodal Corridors',
        'Critical Infrastructure',
        'Economic Competitiveness',
        'Safety Improvements'
      ],
      arcItsRelevance: 'LOW-MEDIUM - ITS can be project component',
      nofoUrl: 'https://www.transportation.gov/grants/infra-grants-program',
      grantsGovUrl: 'https://www.transportation.gov/grants/mpdg',
      applicationPeriod: 'FY25-26: Part of MPDG. Search "INFRA" or "MPDG" on Grants.gov',
      keyRequirements: [
        'Benefit-Cost Analysis',
        'Project readiness',
        'Non-federal funding commitment',
        'Economic analysis',
        'Long-term maintenance plan'
      ],
      typicalAward: '$25M - $100M',
      matchRequired: 'Minimum 30%',
      color: '#06b6d4'
    },
    {
      id: 'build',
      name: 'BUILD Grant',
      fullName: 'Better Utilizing Investments to Leverage Development (formerly RAISE)',
      agency: 'USDOT - Office of the Secretary',
      funding: '$1.5B annually (FY 2022-2026)',
      eligibility: 'State DOTs, Local Governments, Counties, Tribal Governments, Transit Agencies, Port Authorities',
      focus: [
        'Multimodal Infrastructure Projects',
        'Surface Transportation Projects',
        'Safety Improvements',
        'Economic Competitiveness',
        'Environmental Sustainability',
        'Quality of Life Enhancements',
        'State of Good Repair',
        'Partnership and Collaboration'
      ],
      arcItsRelevance: 'MEDIUM - ITS components strengthen multimodal applications',
      nofoUrl: 'https://www.transportation.gov/BUILDgrants',
      grantsGovUrl: 'https://www.grants.gov/web/grants/view-opportunity.html?oppId=356890',
      applicationPeriod: 'FY2025: Deadline January 30, 2025. Annual solicitations expected.',
      keyRequirements: [
        'Benefit-Cost Analysis (BCA)',
        'Multi-jurisdictional or multimodal impact',
        'Project readiness documentation',
        'Community engagement plan',
        'Merit criteria alignment (safety, equity, climate, economic, mobility)',
        'Environmental review status'
      ],
      typicalAward: '$5M - $25M (rural); $25M+ (urban)',
      matchRequired: '20% minimum (lower for rural areas)',
      color: '#14b8a6'
    }
  ];

  const handleGrantClick = (grantId) => {
    setExpandedGrant(expandedGrant === grantId ? null : grantId);
  };

  const styles = {
    container: {
      padding: '24px',
      background: theme.bg,
      minHeight: '100vh',
    },
    header: {
      marginBottom: '32px',
    },
    title: {
      fontSize: '32px',
      fontWeight: '700',
      color: theme.text,
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    subtitle: {
      fontSize: '16px',
      color: theme.textSecondary,
      lineHeight: '1.6',
    },
    grantsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
      gap: '24px',
      marginTop: '24px',
    },
    grantCard: {
      background: theme.bgSecondary,
      borderRadius: '16px',
      padding: '24px',
      border: `2px solid ${theme.border}`,
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden',
    },
    grantCardExpanded: {
      gridColumn: 'span 2',
    },
    grantHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '16px',
    },
    grantName: {
      fontSize: '24px',
      fontWeight: '700',
      color: theme.text,
      marginBottom: '4px',
    },
    grantFullName: {
      fontSize: '13px',
      color: theme.textSecondary,
      fontStyle: 'italic',
      marginBottom: '8px',
    },
    grantAgency: {
      fontSize: '12px',
      color: theme.textSecondary,
      fontWeight: '600',
    },
    relevanceBadge: {
      position: 'absolute',
      top: '16px',
      right: '16px',
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    infoGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '16px',
      marginTop: '16px',
    },
    infoItem: {
      background: darkMode ? '#0f172a' : '#ffffff',
      padding: '12px',
      borderRadius: '8px',
      border: `1px solid ${theme.border}`,
    },
    infoLabel: {
      fontSize: '11px',
      fontWeight: '600',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      marginBottom: '4px',
    },
    infoValue: {
      fontSize: '14px',
      color: theme.text,
      fontWeight: '600',
    },
    focusAreas: {
      marginTop: '16px',
    },
    focusTitle: {
      fontSize: '13px',
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: '8px',
      textTransform: 'uppercase',
    },
    focusList: {
      listStyle: 'none',
      padding: 0,
      margin: 0,
    },
    focusItem: {
      padding: '6px 0',
      fontSize: '13px',
      color: theme.text,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    linksSection: {
      marginTop: '20px',
      paddingTop: '20px',
      borderTop: `1px solid ${theme.border}`,
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap',
    },
    linkButton: {
      padding: '10px 20px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      textDecoration: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s ease',
    },
    nofoLink: {
      background: theme.accent,
      color: '#ffffff',
    },
    grantsGovLink: {
      background: theme.success,
      color: '#ffffff',
    },
    expandedContent: {
      marginTop: '20px',
      paddingTop: '20px',
      borderTop: `2px solid ${theme.border}`,
    },
    requirementsList: {
      marginTop: '12px',
      paddingLeft: '20px',
    },
    requirementItem: {
      fontSize: '13px',
      color: theme.text,
      marginBottom: '6px',
    }
  };

  const getRelevanceBadgeStyle = (relevance) => {
    const baseStyle = styles.relevanceBadge;
    if (relevance.includes('VERY HIGH') || relevance.includes('HIGH')) {
      return { ...baseStyle, background: '#dcfce7', color: '#166534' };
    } else if (relevance.includes('MEDIUM')) {
      return { ...baseStyle, background: '#fef3c7', color: '#92400e' };
    } else {
      return { ...baseStyle, background: '#f3f4f6', color: '#6b7280' };
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>
          <span>💰</span>
          Federal Transportation Grant Programs
        </h1>
        <p style={styles.subtitle}>
          Comprehensive guide to USDOT funding opportunities for ITS, infrastructure, and technology deployment.
          Click each grant card to view detailed requirements, eligibility, and application links.
        </p>
      </div>

      <div style={styles.grantsGrid}>
        {federalGrants.map((grant) => (
          <div
            key={grant.id}
            style={{
              ...styles.grantCard,
              borderLeft: `4px solid ${grant.color}`,
              ...(expandedGrant === grant.id && styles.grantCardExpanded)
            }}
            onClick={() => handleGrantClick(grant.id)}
          >
            <div style={getRelevanceBadgeStyle(grant.arcItsRelevance)}>
              {grant.arcItsRelevance.split(' - ')[0]}
            </div>

            <div style={styles.grantHeader}>
              <div>
                <div style={styles.grantName}>{grant.name}</div>
                <div style={styles.grantFullName}>{grant.fullName}</div>
                <div style={styles.grantAgency}>{grant.agency}</div>
              </div>
            </div>

            <div style={styles.infoGrid}>
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>Annual Funding</div>
                <div style={styles.infoValue}>{grant.funding}</div>
              </div>
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>Typical Award</div>
                <div style={styles.infoValue}>{grant.typicalAward}</div>
              </div>
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>Match Required</div>
                <div style={styles.infoValue}>{grant.matchRequired}</div>
              </div>
              <div style={styles.infoItem}>
                <div style={styles.infoLabel}>Application Period</div>
                <div style={styles.infoValue}>{grant.applicationPeriod}</div>
              </div>
            </div>

            <div style={styles.focusAreas}>
              <div style={styles.focusTitle}>Focus Areas:</div>
              <ul style={styles.focusList}>
                {grant.focus.slice(0, expandedGrant === grant.id ? grant.focus.length : 3).map((area, idx) => (
                  <li key={idx} style={styles.focusItem}>
                    <span style={{ color: grant.color, fontSize: '12px' }}>▪</span>
                    {area}
                  </li>
                ))}
                {!expandedGrant && grant.focus.length > 3 && (
                  <li style={{ ...styles.focusItem, fontStyle: 'italic', color: theme.textSecondary }}>
                    +{grant.focus.length - 3} more...
                  </li>
                )}
              </ul>
            </div>

            {expandedGrant === grant.id && (
              <div style={styles.expandedContent}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={styles.focusTitle}>Eligibility:</div>
                  <div style={{ fontSize: '13px', color: theme.text }}>{grant.eligibility}</div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={styles.focusTitle}>ARC-ITS Relevance:</div>
                  <div style={{ fontSize: '13px', color: theme.text }}>{grant.arcItsRelevance}</div>
                </div>

                <div>
                  <div style={styles.focusTitle}>Key Requirements:</div>
                  <ul style={styles.requirementsList}>
                    {grant.keyRequirements.map((req, idx) => (
                      <li key={idx} style={styles.requirementItem}>{req}</li>
                    ))}
                  </ul>
                </div>

                <div style={styles.linksSection}>
                  <a
                    href={grant.nofoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...styles.linkButton, ...styles.nofoLink }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    📄 NOFO / Program Page
                  </a>
                  <a
                    href={grant.grantsGovUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...styles.linkButton, ...styles.grantsGovLink }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    🔗 Grants.gov Application
                  </a>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '40px',
        padding: '24px',
        background: darkMode ? '#1e293b' : '#f0f9ff',
        borderRadius: '16px',
        border: `2px solid ${darkMode ? '#334155' : '#bae6fd'}`,
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: theme.text,
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>💡</span>
          Grant Writing Tips with ARC-ITS Inventory
        </h3>
        <ul style={{ paddingLeft: '24px', margin: 0 }}>
          <li style={{ fontSize: '14px', color: theme.text, marginBottom: '8px', lineHeight: '1.6' }}>
            <strong>HIGH relevance grants</strong> (SMART, FMCSA IT-D, ATCMTD) require detailed ITS equipment inventories - use your ARC-ITS export
          </li>
          <li style={{ fontSize: '14px', color: theme.text, marginBottom: '8px', lineHeight: '1.6' }}>
            Include equipment counts, standards compliance (NTCIP, SAE J2735), and deployment locations
          </li>
          <li style={{ fontSize: '14px', color: theme.text, marginBottom: '8px', lineHeight: '1.6' }}>
            Demonstrate interoperability with existing systems using ARC-IT 10.0 architecture diagrams
          </li>
          <li style={{ fontSize: '14px', color: theme.text, marginBottom: '8px', lineHeight: '1.6' }}>
            For RAISE and INFRA grants, focus on broader benefits but include ITS as enabling technology
          </li>
          <li style={{ fontSize: '14px', color: theme.text, marginBottom: '8px', lineHeight: '1.6' }}>
            Always highlight multi-state coordination capabilities and data sharing agreements
          </li>
        </ul>
      </div>
    </div>
  );
}
