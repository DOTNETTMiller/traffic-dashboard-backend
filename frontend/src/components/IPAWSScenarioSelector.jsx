import { useState } from 'react';
import { theme } from '../styles/theme';

/**
 * IPAWS Scenario Escalation Selector
 *
 * SOP Compliance:
 * - Section 6.2: Timeline & Escalation
 *
 * Guides operators through decision matrix for different incident scenarios
 */
export default function IPAWSScenarioSelector({ event, onScenarioSelect }) {
  const [selectedScenario, setSelectedScenario] = useState(null);

  // SOP Section 6.2 Scenarios
  const scenarios = [
    {
      id: 'partial_lane_crash',
      title: 'Partial Lane Crash',
      icon: '🚗',
      initialAction: 'DMS / 511',
      escalationTrigger: 'Full closure >2 hour or safety risk',
      ipawsRequired: 'When escalated to full closure with extended duration',
      color: '#fef3c7',
      borderColor: '#f59e0b',
      steps: [
        '1. Deploy DMS messaging immediately',
        '2. Update 511ia.org status',
        '3. Monitor for escalation triggers',
        '4. If full closure expected >2 hours: Activate IPAWS',
        '5. Coordinate with State Patrol'
      ]
    },
    {
      id: 'scheduled_event',
      title: 'Scheduled Event (Construction/Maintenance)',
      icon: '🚧',
      initialAction: 'Internal notification',
      escalationTrigger: 'Hazard arises from weather/incidents that threaten life safety',
      ipawsRequired: 'Only if unforeseen life-safety hazard develops',
      color: '#dbeafe',
      borderColor: '#3b82f6',
      steps: [
        '1. Internal DOT notification 48-72 hours advance',
        '2. DMS and 511 updates',
        '3. Public announcements if major impact',
        '4. Monitor weather and incidents during work',
        '5. If life-safety threat emerges: Activate IPAWS',
        '6. Document any unforeseen complications'
      ]
    },
    {
      id: 'hazmat_hold',
      title: 'Hazmat Spill / Hold',
      icon: '☢️',
      initialAction: 'Notify HAZMAT & TMC immediately',
      escalationTrigger: 'Shelter/evacuation or >15 min delay (plume/smoke/fire)',
      ipawsRequired: 'IMMEDIATE if shelter-in-place or evacuation needed',
      color: '#fee2e2',
      borderColor: '#ef4444',
      urgent: true,
      steps: [
        '1. IMMEDIATE notification to HAZMAT team',
        '2. Alert TMC and State Patrol',
        '3. Assess plume/smoke/fire risk',
        '4. If shelter-in-place needed: ACTIVATE IPAWS IMMEDIATELY',
        '5. If evacuation required: ACTIVATE IPAWS IMMEDIATELY',
        '6. If delay >15 min with hazard exposure: Consider IPAWS',
        '7. Coordinate with Incident Command',
        '8. Monitor air quality and public safety'
      ]
    },
    {
      id: 'weather_closure',
      title: 'Weather-Related Closure',
      icon: '🌨️',
      initialAction: 'Monitor conditions / DMS',
      escalationTrigger: 'Whiteout, blizzard, or vehicles stranded >30 min',
      ipawsRequired: 'IMMEDIATE for stranded vehicles in severe weather',
      color: '#e0e7ff',
      borderColor: '#6366f1',
      urgent: true,
      steps: [
        '1. Monitor weather conditions continuously',
        '2. Deploy DMS warnings of deteriorating conditions',
        '3. Coordinate with weather service',
        '4. If vehicles stopped >30 min in blizzard/extreme cold: ACTIVATE IPAWS',
        '5. Include survival guidance (run engine 10 min/hr, clear exhaust)',
        '6. Renew every 60-90 minutes if hazard persists',
        '7. Cancel promptly when traffic moving'
      ]
    },
    {
      id: 'flooding',
      title: 'Flooding / Rising Water',
      icon: '🌊',
      initialAction: 'Monitor water levels / Road closure',
      escalationTrigger: 'Vehicles stopped near rising water',
      ipawsRequired: 'IMMEDIATE if vehicles at risk from water',
      color: '#ccfbf1',
      borderColor: '#14b8a6',
      urgent: true,
      steps: [
        '1. Monitor water levels at all crossings',
        '2. Close roads when water reaches threshold',
        '3. Deploy barricades and closure points',
        '4. If vehicles stopped near rising water: ACTIVATE IPAWS IMMEDIATELY',
        '5. Advise "Do NOT drive through water"',
        '6. Coordinate with emergency management',
        '7. Update as water levels change'
      ]
    },
    {
      id: 'multi_vehicle_pileup',
      title: 'Multi-Vehicle Pileup (≥20 vehicles)',
      icon: '🚙',
      initialAction: 'Emergency response / TMC alert',
      escalationTrigger: 'Immediate - qualifies for IPAWS',
      ipawsRequired: 'YES - Activate immediately',
      color: '#fee2e2',
      borderColor: '#dc2626',
      urgent: true,
      steps: [
        '1. IMMEDIATE emergency response dispatch',
        '2. Alert TMC and State Patrol',
        '3. ACTIVATE IPAWS for approaching traffic',
        '4. Deploy advance warning DMS upstream',
        '5. Establish traffic control points',
        '6. Include "STOPPED TRAFFIC AHEAD" in message',
        '7. Monitor for secondary crashes',
        '8. Update/renew as situation evolves'
      ]
    }
  ];

  const handleScenarioClick = (scenario) => {
    setSelectedScenario(scenario);
    if (onScenarioSelect) {
      onScenarioSelect(scenario);
    }
  };

  return (
    <div style={{ padding: theme.spacing.md }}>
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: '16px',
        fontWeight: '700',
        color: '#111827'
      }}>
        📋 Scenario Escalation Guide (SOP Section 6.2)
      </h3>

      <div style={{
        padding: theme.spacing.sm,
        backgroundColor: '#eff6ff',
        borderRadius: '6px',
        border: '1px solid #3b82f6',
        marginBottom: theme.spacing.md,
        fontSize: '11px',
        color: '#1e40af'
      }}>
        <strong>Purpose:</strong> Select the scenario type to view escalation triggers and IPAWS activation criteria per SOP Section 6.2
      </div>

      {/* Scenario Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.lg
      }}>
        {scenarios.map(scenario => (
          <button
            key={scenario.id}
            onClick={() => handleScenarioClick(scenario)}
            style={{
              padding: theme.spacing.md,
              backgroundColor: selectedScenario?.id === scenario.id ? scenario.color : 'white',
              border: `2px solid ${selectedScenario?.id === scenario.id ? scenario.borderColor : '#e5e7eb'}`,
              borderRadius: '8px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative'
            }}
            onMouseEnter={(e) => {
              if (selectedScenario?.id !== scenario.id) {
                e.currentTarget.style.backgroundColor = '#f9fafb';
                e.currentTarget.style.borderColor = scenario.borderColor;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedScenario?.id !== scenario.id) {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }
            }}
          >
            {scenario.urgent && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                padding: '2px 6px',
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '4px',
                fontSize: '9px',
                fontWeight: '700'
              }}>
                URGENT
              </div>
            )}

            <div style={{
              fontSize: '24px',
              marginBottom: '8px'
            }}>
              {scenario.icon}
            </div>

            <div style={{
              fontSize: '13px',
              fontWeight: '700',
              color: '#111827',
              marginBottom: '8px'
            }}>
              {scenario.title}
            </div>

            <div style={{
              fontSize: '11px',
              color: '#6b7280',
              marginBottom: '4px'
            }}>
              <strong>Initial:</strong> {scenario.initialAction}
            </div>

            <div style={{
              fontSize: '11px',
              color: '#374151',
              fontWeight: '600'
            }}>
              <strong>IPAWS:</strong> {scenario.ipawsRequired}
            </div>
          </button>
        ))}
      </div>

      {/* Selected Scenario Details */}
      {selectedScenario && (
        <div style={{
          padding: theme.spacing.md,
          backgroundColor: selectedScenario.color,
          border: `2px solid ${selectedScenario.borderColor}`,
          borderRadius: '8px',
          marginTop: theme.spacing.md
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.md
          }}>
            <div style={{ fontSize: '32px' }}>{selectedScenario.icon}</div>
            <div style={{ flex: 1 }}>
              <h4 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '700',
                color: '#111827'
              }}>
                {selectedScenario.title}
              </h4>
              {selectedScenario.urgent && (
                <div style={{
                  fontSize: '11px',
                  color: '#991b1b',
                  fontWeight: '600',
                  marginTop: '4px'
                }}>
                  🚨 URGENT SCENARIO - Immediate action required
                </div>
              )}
            </div>
          </div>

          <div style={{
            padding: theme.spacing.sm,
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            borderRadius: '6px',
            marginBottom: theme.spacing.md
          }}>
            <div style={{
              fontSize: '12px',
              color: '#374151',
              marginBottom: '8px'
            }}>
              <strong>Escalation Trigger:</strong> {selectedScenario.escalationTrigger}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#374151'
            }}>
              <strong>IPAWS Activation:</strong> {selectedScenario.ipawsRequired}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: '13px',
              fontWeight: '700',
              color: '#111827',
              marginBottom: '8px'
            }}>
              Response Protocol:
            </div>
            <ol style={{
              margin: 0,
              paddingLeft: '20px',
              fontSize: '12px',
              color: '#374151',
              lineHeight: '1.8'
            }}>
              {selectedScenario.steps.map((step, idx) => (
                <li key={idx} style={{
                  marginBottom: '6px',
                  fontWeight: step.includes('IMMEDIATE') || step.includes('ACTIVATE') ? '700' : '400',
                  color: step.includes('IMMEDIATE') || step.includes('ACTIVATE') ? '#991b1b' : '#374151'
                }}>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {selectedScenario.urgent && (
            <div style={{
              marginTop: theme.spacing.md,
              padding: theme.spacing.sm,
              backgroundColor: '#fee2e2',
              border: '1px solid #ef4444',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#991b1b',
              fontWeight: '600'
            }}>
              ⚠️ CRITICAL: This scenario requires immediate IPAWS activation per SOP Section 6.1. Do not delay alert issuance.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
