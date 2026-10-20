import React from 'react';
import ReactDOM from 'react-dom/client';
import Workspace from './Workspace';
import './atms.css';

class WorkspaceBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    return this.state.error ? <main className="atms-fatal"><h1>The workspace needs to reload.</h1><p>No device action has been confirmed by this screen. Reload and review the command log before retrying.</p><button onClick={() => window.location.reload()}>Reload workspace</button></main> : this.props.children;
  }
}
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><WorkspaceBoundary><Workspace /></WorkspaceBoundary></React.StrictMode>);
