import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import axios from 'axios';
import { config } from '../config';

const API_BASE = config.apiUrl;

const IFCModelViewer = ({ modelId, filename }) => {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [highlightMode, setHighlightMode] = useState('none');
  const [elements, setElements] = useState([]);
  const [gaps, setGaps] = useState([]);
  const viewerRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    model: null,
    ifcLoader: null,
    originalMaterials: new Map()
  });

  useEffect(() => {
    if (!containerRef.current || !modelId) return;

    // Initialize Three.js scene
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
    camera.position.set(50, 50, 50);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    scene.add(directionalLight);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-100, -100, -50);
    scene.add(directionalLight2);

    // Grid
    const gridHelper = new THREE.GridHelper(200, 50, 0x888888, 0xcccccc);
    scene.add(gridHelper);

    // Store references
    viewerRef.current = { scene, camera, renderer, controls, model: null, ifcLoader: null, originalMaterials: new Map() };

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Load operational data
    const loadOperationalData = async () => {
      try {
        const [elementsRes, gapsRes] = await Promise.all([
          axios.get(`${API_BASE}/api/digital-infrastructure/elements/${modelId}`),
          axios.get(`${API_BASE}/api/digital-infrastructure/gaps/${modelId}`)
        ]);

        setElements(elementsRes.data.elements || []);
        setGaps(gapsRes.data.gaps || []);
      } catch (err) {
        console.warn('Could not load operational data:', err);
      }
    };

    // Load IFC model
    const loadModel = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load operational data first
        await loadOperationalData();

        const ifcLoader = new IFCLoader();
        viewerRef.current.ifcLoader = ifcLoader;

        // Setup web-ifc
        await ifcLoader.ifcManager.setWasmPath('/wasm/');

        // Load the model
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const modelUrl = `${apiUrl}/api/digital-infrastructure/models/${modelId}/file`;

        ifcLoader.load(
          modelUrl,
          (ifcModel) => {
            scene.add(ifcModel);
            viewerRef.current.model = ifcModel;

            // Store original materials
            ifcModel.traverse((child) => {
              if (child.isMesh && child.material) {
                viewerRef.current.originalMaterials.set(child.uuid, child.material.clone());
              }
            });

            // Center camera on model
            const box = new THREE.Box3().setFromObject(ifcModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
            cameraZ *= 1.5; // Zoom out a bit

            camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
            camera.lookAt(center);
            controls.target.copy(center);
            controls.update();

            setLoading(false);
          },
          (progressEvent) => {
            if (progressEvent.lengthComputable) {
              const percentComplete = (progressEvent.loaded / progressEvent.total) * 100;
              setProgress(Math.round(percentComplete));
            }
          },
          (err) => {
            console.error('Error loading IFC model:', err);
            setError('Failed to load IFC model. The file may be corrupted or incompatible.');
            setLoading(false);
          }
        );
      } catch (err) {
        console.error('Error initializing IFC loader:', err);
        setError('Failed to initialize IFC viewer.');
        setLoading(false);
      }
    };

    // Only load if it's an IFC file
    if (filename?.toLowerCase().endsWith('.ifc')) {
      loadModel();
    } else {
      setError('Only IFC files can be displayed in 3D viewer. CAD files (DXF/DWG/DGN) show preview cards only.');
      setLoading(false);
    }

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight || 600;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);

      if (viewerRef.current.renderer) {
        viewerRef.current.renderer.dispose();
      }

      if (viewerRef.current.model) {
        scene.remove(viewerRef.current.model);
      }

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [modelId, filename]);

  // Highlight elements based on mode
  useEffect(() => {
    if (!viewerRef.current.model || !viewerRef.current.ifcLoader) return;

    const model = viewerRef.current.model;
    const originalMaterials = viewerRef.current.originalMaterials;

    // Reset all materials first
    model.traverse((child) => {
      if (child.isMesh && originalMaterials.has(child.uuid)) {
        child.material = originalMaterials.get(child.uuid).clone();
      }
    });

    if (highlightMode === 'none') return;

    // Create highlight materials
    const highlightMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color(0xff0000),
      transparent: true,
      opacity: 0.8,
      depthTest: true
    });

    const v2xMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color(0x00ff00),
      transparent: true,
      opacity: 0.8,
      depthTest: true
    });

    const avMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color(0x0000ff),
      transparent: true,
      opacity: 0.8,
      depthTest: true
    });

    const gapMaterial = new THREE.MeshLambertMaterial({
      color: new THREE.Color(0xffa500),
      transparent: true,
      opacity: 0.8,
      depthTest: true
    });

    // Determine which elements to highlight
    let elementsToHighlight = [];

    if (highlightMode === 'gaps') {
      // Highlight elements with gaps
      const affectedGuids = new Set();
      gaps.forEach(gap => {
        if (gap.affected_element_guids) {
          gap.affected_element_guids.split(',').forEach(guid => {
            if (guid && guid.trim()) affectedGuids.add(guid.trim());
          });
        }
      });
      elementsToHighlight = elements.filter(el => affectedGuids.has(el.ifc_guid));
    } else if (highlightMode === 'v2x') {
      elementsToHighlight = elements.filter(el => el.v2x_applicable);
    } else if (highlightMode === 'av') {
      elementsToHighlight = elements.filter(el => el.av_critical);
    }

    // Apply highlighting (simplified - full implementation would need IFC GUID matching)
    // This is a basic version that highlights by element type
    if (elementsToHighlight.length > 0) {
      const typeColors = {};
      elementsToHighlight.forEach(el => {
        if (!typeColors[el.ifc_type]) {
          if (highlightMode === 'gaps') typeColors[el.ifc_type] = gapMaterial;
          else if (highlightMode === 'v2x') typeColors[el.ifc_type] = v2xMaterial;
          else if (highlightMode === 'av') typeColors[el.ifc_type] = avMaterial;
        }
      });

      // Apply highlight (basic version - highlights all matching types)
      model.traverse((child) => {
        if (child.isMesh) {
          elementsToHighlight.forEach(el => {
            // Simplified: highlight by checking if element type matches
            // In production, you'd match by IFC GUID using ifcLoader.ifcManager.getExpressId()
            if (child.name && child.name.includes(el.ifc_type)) {
              child.material = typeColors[el.ifc_type];
            }
          });
        }
      });
    }
  }, [highlightMode, elements, gaps]);

  const highlightOptions = [
    { value: 'none', label: 'No Highlighting', color: '#666', icon: '○' },
    { value: 'gaps', label: `Elements with Gaps (${gaps.length})`, color: '#ffa500', icon: '⚠️' },
    { value: 'v2x', label: `V2X Elements (${elements.filter(e => e.v2x_applicable).length})`, color: '#00ff00', icon: '📡' },
    { value: 'av', label: `AV Critical (${elements.filter(e => e.av_critical).length})`, color: '#0000ff', icon: '🚗' }
  ];

  return (
    <div style={{ position: 'relative', width: '100%', height: '600px', backgroundColor: '#f0f0f0', borderRadius: '8px', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Highlight Controls */}
      {!loading && !error && elements.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          minWidth: '250px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>
            🎨 Highlight Operations Data
          </div>
          {highlightOptions.map((option) => (
            <label
              key={option.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px',
                marginBottom: '5px',
                cursor: 'pointer',
                backgroundColor: highlightMode === option.value ? '#e3f2fd' : 'transparent',
                borderRadius: '4px',
                fontSize: '13px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (highlightMode !== option.value) e.currentTarget.style.backgroundColor = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                if (highlightMode !== option.value) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <input
                type="radio"
                name="highlight"
                value={option.value}
                checked={highlightMode === option.value}
                onChange={(e) => setHighlightMode(e.target.value)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ marginRight: '6px' }}>{option.icon}</span>
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}

      {loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          zIndex: 10
        }}>
          <div style={{ fontSize: '18px', marginBottom: '15px', color: '#1976d2', fontWeight: 'bold' }}>
            Loading 3D Model...
          </div>
          <div style={{ width: '300px', height: '8px', backgroundColor: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#1976d2',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
            {progress}%
          </div>
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          zIndex: 10,
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>⚠️</div>
          <div style={{ fontSize: '16px', color: '#d32f2f', fontWeight: 'bold', marginBottom: '10px' }}>
            {error}
          </div>
          <div style={{ fontSize: '14px', color: '#666', maxWidth: '400px' }}>
            {filename?.match(/\.(dxf|dwg|dgn)$/i)
              ? 'CAD files are shown as preview cards. Convert to IFC for full 3D visualization.'
              : 'Make sure the IFC file is valid and properly formatted.'}
          </div>
        </div>
      )}

      {!loading && !error && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          padding: '10px 15px',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#666',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>🖱️ Controls</div>
          <div>• Left click + drag: Rotate</div>
          <div>• Right click + drag: Pan</div>
          <div>• Scroll: Zoom</div>
        </div>
      )}
    </div>
  );
};

export default IFCModelViewer;
