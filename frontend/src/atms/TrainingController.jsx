import { useEffect, useState } from 'react';

export default function TrainingController({ device, disabled, onAction }) {
  const [fault, setFault] = useState(device.protocolScenario || 'healthy');
  useEffect(() => setFault(device.protocolScenario || 'healthy'), [device.protocolScenario]);
  return <div className="training-controller">
    <strong>Local controller emulator</strong>
    <p>Commands travel over SNMP to a virtual sign. All results remain simulated.</p>
    <label>Controller scenario<select aria-label={'Controller scenario for ' + device.name} value={fault} disabled={disabled} onChange={e => setFault(e.target.value)}>
      <option value="healthy">Healthy controller</option><option value="offline">No communications</option><option value="local">Local control</option><option value="validation">Reject message validation</option><option value="lost-ack">Lose activation acknowledgment</option><option value="mismatch">Display a different message</option>
    </select></label>
    <div className="training-controller-actions"><button className="ops-button compact" disabled={disabled} onClick={() => onAction({ action: 'fault', fault })}>Apply scenario</button><button className="ops-button compact" disabled={disabled} onClick={() => onAction({ action: 'override' })}>Simulate field override</button><button className="ops-button compact" disabled={disabled} onClick={() => onAction({ action: 'expire' })}>Advance to expiry</button><button className="ops-button compact" disabled={disabled} onClick={() => onAction({ action: 'reset' })}>Reset emulator to blank</button></div>
    <small>Central mode: {device.controllerMode === 4 ? 'available' : device.controllerMode === 2 ? 'local control' : 'unconfirmed'} · Controller validity: {device.controllerMinutesRemaining ?? '—'} min</small>
    <details><summary>SNMP exchange evidence</summary><p>Last command exchange followed by recent controller polls. No device credentials are exposed.</p><ol>{[...(device.commandTrace || []), ...(device.protocolTrace || [])].map((entry, index) => <li key={index}><b>{entry.operation}</b> <code>{entry.oid}</code></li>)}</ol></details>
  </div>;
}
