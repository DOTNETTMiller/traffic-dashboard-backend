import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { config } from '../config';
import { theme } from '../styles/theme';

export default function ProjectManagement({ onClose, onProjectCreated, clickedLocation }) {
  const [view, setView] = useState('list'); // 'list', 'create-project', 'create-biweekly'
  const [projects, setProjects] = useState([]);
  const [biweeklyReports, setBiweeklyReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    latitude: clickedLocation?.latitude || '',
    longitude: clickedLocation?.longitude || '',
    location_name: clickedLocation?.locationName || '',
    status: 'active',
    priority: 'medium',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: ''
  });

  const [biweeklyForm, setBiweeklyForm] = useState({
    project_id: null,
    title: '',
    content: '',
    report_date: format(new Date(), 'yyyy-MM-dd'),
    latitude: clickedLocation?.latitude || '',
    longitude: clickedLocation?.longitude || '',
    location_name: clickedLocation?.locationName || ''
  });

  // Update forms when clicked location changes
  useEffect(() => {
    if (clickedLocation) {
      setProjectForm(prev => ({
        ...prev,
        latitude: clickedLocation.latitude,
        longitude: clickedLocation.longitude,
        location_name: clickedLocation.locationName || ''
      }));
      setBiweeklyForm(prev => ({
        ...prev,
        latitude: clickedLocation.latitude,
        longitude: clickedLocation.longitude,
        location_name: clickedLocation.locationName || ''
      }));
    }
  }, [clickedLocation]);

  // Load projects and reports
  useEffect(() => {
    if (view === 'list') {
      loadProjects();
      loadBiweeklyReports();
    }
  }, [view]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/projects`);
      const data = await response.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (err) {
      setError('Failed to load projects');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadBiweeklyReports = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/biweekly-reports`);
      const data = await response.json();
      if (data.success) {
        setBiweeklyReports(data.reports);
      }
    } catch (err) {
      console.error('Failed to load biweekly reports:', err);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectForm)
      });

      const data = await response.json();
      if (data.success) {
        setView('list');
        loadProjects();
        if (onProjectCreated) onProjectCreated(data.project);
        setProjectForm({
          title: '',
          description: '',
          latitude: '',
          longitude: '',
          location_name: '',
          status: 'active',
          priority: 'medium',
          start_date: format(new Date(), 'yyyy-MM-dd'),
          end_date: ''
        });
      } else {
        setError(data.error || 'Failed to create project');
      }
    } catch (err) {
      setError('Network error creating project');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBiweekly = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/api/biweekly-reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(biweeklyForm)
      });

      const data = await response.json();
      if (data.success) {
        setView('list');
        loadBiweeklyReports();
        setBiweeklyForm({
          project_id: null,
          title: '',
          content: '',
          report_date: format(new Date(), 'yyyy-MM-dd'),
          latitude: '',
          longitude: '',
          location_name: ''
        });
      } else {
        setError(data.error || 'Failed to create biweekly report');
      }
    } catch (err) {
      setError('Network error creating biweekly report');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderList = () => (
    <div style={{ padding: theme.spacing.md, height: '100%', overflow: 'auto' }}>
      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: theme.spacing.sm,
        marginBottom: theme.spacing.lg
      }}>
        <button
          onClick={() => setView('create-project')}
          style={{
            flex: 1,
            padding: theme.spacing.md,
            background: theme.colors.accentBlue,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: theme.shadows.md,
            transition: `all ${theme.transitions.fast}`
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          📋 New Project
        </button>
        <button
          onClick={() => setView('create-biweekly')}
          style={{
            flex: 1,
            padding: theme.spacing.md,
            background: theme.colors.accentPurple,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: theme.shadows.md,
            transition: `all ${theme.transitions.fast}`
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          📝 New Biweekly
        </button>
      </div>

      {/* Projects List */}
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: '700',
          marginBottom: theme.spacing.md,
          color: theme.colors.text
        }}>
          📂 Projects ({projects.length})
        </h3>
        {projects.length === 0 ? (
          <div style={{
            padding: theme.spacing.xl,
            textAlign: 'center',
            color: theme.colors.textSecondary,
            background: theme.colors.glassLight,
            borderRadius: '12px',
            border: `1px solid ${theme.colors.border}`
          }}>
            No projects yet. Click on the map and create one!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
            {projects.map(project => (
              <div
                key={project.id}
                style={{
                  padding: theme.spacing.md,
                  background: theme.colors.glassLight,
                  border: `1px solid ${theme.colors.border}`,
                  borderLeft: `4px solid ${project.status === 'active' ? theme.colors.success : theme.colors.gray[400]}`,
                  borderRadius: '12px',
                  boxShadow: theme.shadows.sm
                }}
              >
                <div style={{ fontWeight: '700', marginBottom: theme.spacing.xs }}>
                  {project.title}
                </div>
                <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>
                  {project.location_name || `${project.latitude.toFixed(4)}, ${project.longitude.toFixed(4)}`}
                </div>
                <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
                  {project.start_date && `Start: ${format(new Date(project.start_date), 'MMM d, yyyy')}`}
                  {project.end_date && ` • End: ${format(new Date(project.end_date), 'MMM d, yyyy')}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Biweekly Reports List */}
      <div>
        <h3 style={{
          fontSize: '16px',
          fontWeight: '700',
          marginBottom: theme.spacing.md,
          color: theme.colors.text
        }}>
          📊 Biweekly Reports ({biweeklyReports.length})
        </h3>
        {biweeklyReports.length === 0 ? (
          <div style={{
            padding: theme.spacing.xl,
            textAlign: 'center',
            color: theme.colors.textSecondary,
            background: theme.colors.glassLight,
            borderRadius: '12px',
            border: `1px solid ${theme.colors.border}`
          }}>
            No biweekly reports yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
            {biweeklyReports.map(report => (
              <div
                key={report.id}
                style={{
                  padding: theme.spacing.md,
                  background: theme.colors.glassLight,
                  border: `1px solid ${theme.colors.border}`,
                  borderLeft: `4px solid ${theme.colors.accentPurple}`,
                  borderRadius: '12px',
                  boxShadow: theme.shadows.sm
                }}
              >
                <div style={{ fontWeight: '700', marginBottom: theme.spacing.xs }}>
                  {report.title}
                </div>
                <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginBottom: theme.spacing.xs }}>
                  {report.location_name || (report.latitude && `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`)}
                </div>
                <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
                  Report Date: {format(new Date(report.report_date), 'MMM d, yyyy')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderProjectForm = () => (
    <form onSubmit={handleCreateProject} style={{ padding: theme.spacing.md, height: '100%', overflow: 'auto' }}>
      <div style={{ marginBottom: theme.spacing.lg }}>
        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: '600', fontSize: '13px' }}>
          Title *
        </label>
        <input
          type="text"
          value={projectForm.title}
          onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
          required
          style={{
            width: '100%',
            padding: theme.spacing.sm,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{ marginBottom: theme.spacing.lg }}>
        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: '600', fontSize: '13px' }}>
          Description
        </label>
        <textarea
          value={projectForm.description}
          onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
          rows={4}
          style={{
            width: '100%',
            padding: theme.spacing.sm,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            fontSize: '14px',
            fontFamily: 'inherit'
          }}
        />
      </div>

      <div style={{ marginBottom: theme.spacing.lg }}>
        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: '600', fontSize: '13px' }}>
          Location Name
        </label>
        <input
          type="text"
          value={projectForm.location_name}
          onChange={(e) => setProjectForm({ ...projectForm, location_name: e.target.value })}
          style={{
            width: '100%',
            padding: theme.spacing.sm,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
        <div>
          <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: '600', fontSize: '13px' }}>
            Latitude *
          </label>
          <input
            type="number"
            step="any"
            value={projectForm.latitude}
            onChange={(e) => setProjectForm({ ...projectForm, latitude: parseFloat(e.target.value) })}
            required
            style={{
              width: '100%',
              padding: theme.spacing.sm,
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              fontSize: '14px'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: '600', fontSize: '13px' }}>
            Longitude *
          </label>
          <input
            type="number"
            step="any"
            value={projectForm.longitude}
            onChange={(e) => setProjectForm({ ...projectForm, longitude: parseFloat(e.target.value) })}
            required
            style={{
              width: '100%',
              padding: theme.spacing.sm,
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
        <div>
          <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: '600', fontSize: '13px' }}>
            Start Date
          </label>
          <input
            type="date"
            value={projectForm.start_date}
            onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
            style={{
              width: '100%',
              padding: theme.spacing.sm,
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              fontSize: '14px'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: '600', fontSize: '13px' }}>
            End Date
          </label>
          <input
            type="date"
            value={projectForm.end_date}
            onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })}
            style={{
              width: '100%',
              padding: theme.spacing.sm,
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              fontSize: '14px'
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.xl }}>
        <button
          type="button"
          onClick={() => setView('list')}
          style={{
            flex: 1,
            padding: theme.spacing.md,
            background: theme.colors.gray[200],
            color: theme.colors.text,
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          style={{
            flex: 1,
            padding: theme.spacing.md,
            background: theme.colors.accentBlue,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Creating...' : 'Create Project'}
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: theme.spacing.md,
          padding: theme.spacing.sm,
          background: '#fee',
          color: '#c00',
          borderRadius: '8px',
          fontSize: '13px'
        }}>
          {error}
        </div>
      )}
    </form>
  );

  const renderBiweeklyForm = () => (
    <form onSubmit={handleCreateBiweekly} style={{ padding: theme.spacing.md, height: '100%', overflow: 'auto' }}>
      <div style={{ marginBottom: theme.spacing.lg }}>
        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: '600', fontSize: '13px' }}>
          Project (Optional)
        </label>
        <select
          value={biweeklyForm.project_id || ''}
          onChange={(e) => setBiweeklyForm({ ...biweeklyForm, project_id: e.target.value ? parseInt(e.target.value) : null })}
          style={{
            width: '100%',
            padding: theme.spacing.sm,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            fontSize: '14px'
          }}
        >
          <option value="">No project</option>
          {projects.map(project => (
            <option key={project.id} value={project.id}>{project.title}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: theme.spacing.lg }}>
        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: '600', fontSize: '13px' }}>
          Title *
        </label>
        <input
          type="text"
          value={biweeklyForm.title}
          onChange={(e) => setBiweeklyForm({ ...biweeklyForm, title: e.target.value })}
          required
          style={{
            width: '100%',
            padding: theme.spacing.sm,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{ marginBottom: theme.spacing.lg }}>
        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: '600', fontSize: '13px' }}>
          Content
        </label>
        <textarea
          value={biweeklyForm.content}
          onChange={(e) => setBiweeklyForm({ ...biweeklyForm, content: e.target.value })}
          rows={6}
          style={{
            width: '100%',
            padding: theme.spacing.sm,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            fontSize: '14px',
            fontFamily: 'inherit'
          }}
        />
      </div>

      <div style={{ marginBottom: theme.spacing.lg }}>
        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: '600', fontSize: '13px' }}>
          Report Date *
        </label>
        <input
          type="date"
          value={biweeklyForm.report_date}
          onChange={(e) => setBiweeklyForm({ ...biweeklyForm, report_date: e.target.value })}
          required
          style={{
            width: '100%',
            padding: theme.spacing.sm,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{ marginBottom: theme.spacing.lg }}>
        <label style={{ display: 'block', marginBottom: theme.spacing.xs, fontWeight: '600', fontSize: '13px' }}>
          Location Name
        </label>
        <input
          type="text"
          value={biweeklyForm.location_name}
          onChange={(e) => setBiweeklyForm({ ...biweeklyForm, location_name: e.target.value })}
          style={{
            width: '100%',
            padding: theme.spacing.sm,
            borderRadius: '8px',
            border: `1px solid ${theme.colors.border}`,
            fontSize: '14px'
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.xl }}>
        <button
          type="button"
          onClick={() => setView('list')}
          style={{
            flex: 1,
            padding: theme.spacing.md,
            background: theme.colors.gray[200],
            color: theme.colors.text,
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          style={{
            flex: 1,
            padding: theme.spacing.md,
            background: theme.colors.accentPurple,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Creating...' : 'Create Report'}
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: theme.spacing.md,
          padding: theme.spacing.sm,
          background: '#fee',
          color: '#c00',
          borderRadius: '8px',
          fontSize: '13px'
        }}>
          {error}
        </div>
      )}
    </form>
  );

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'white'
    }}>
      {/* Header */}
      <div style={{
        padding: theme.spacing.md,
        borderBottom: `2px solid ${theme.colors.border}`,
        background: theme.colors.glassDark,
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            color: theme.colors.text
          }}>
            {view === 'list' && '📋 Projects & Reports'}
            {view === 'create-project' && '✨ New Project'}
            {view === 'create-biweekly' && '✨ New Biweekly Report'}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '4px 8px',
                lineHeight: 1
              }}
            >
              ×
            </button>
          )}
        </div>

        {clickedLocation && (
          <div style={{
            marginTop: theme.spacing.sm,
            fontSize: '12px',
            color: theme.colors.textSecondary,
            background: `${theme.colors.accentBlue}15`,
            padding: '6px 10px',
            borderRadius: '8px',
            border: `1px solid ${theme.colors.accentBlue}30`
          }}>
            📍 Map location: {clickedLocation.latitude.toFixed(4)}, {clickedLocation.longitude.toFixed(4)}
            {clickedLocation.locationName && ` (${clickedLocation.locationName})`}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {view === 'list' && renderList()}
        {view === 'create-project' && renderProjectForm()}
        {view === 'create-biweekly' && renderBiweeklyForm()}
      </div>
    </div>
  );
}
