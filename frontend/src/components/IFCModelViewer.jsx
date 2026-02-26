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
    originalMaterials: new Map(),
    animationFrameId: null
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

    // Grid (will be positioned after model loads)
    const gridHelper = new THREE.GridHelper(200, 50, 0x888888, 0xcccccc);
    scene.add(gridHelper);

    // Store references
    viewerRef.current = { scene, camera, renderer, controls, model: null, ifcLoader: null, originalMaterials: new Map(), guidToMeshMap: new Map(), gridHelper };

    // Animation loop
    const animate = () => {
      viewerRef.current.animationFrameId = requestAnimationFrame(animate);
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

        // Verify WASM files are accessible before proceeding
        const wasmFiles = ['web-ifc.wasm', 'web-ifc-mt.wasm'];
        const wasmChecks = await Promise.all(
          wasmFiles.map(file =>
            fetch(`/wasm/${file}`, { method: 'HEAD' })
              .then(res => ({ file, ok: res.ok, status: res.status }))
              .catch(err => ({ file, ok: false, error: err.message }))
          )
        );

        console.log('WASM file accessibility check:', wasmChecks);
        const inaccessibleFiles = wasmChecks.filter(check => !check.ok);
        if (inaccessibleFiles.length > 0) {
          console.warn('Some WASM files are not accessible:', inaccessibleFiles);
          // Continue anyway - the files might be lazy-loaded
        }

        const ifcLoader = new IFCLoader();
        viewerRef.current.ifcLoader = ifcLoader;

        // Setup web-ifc with cross-platform compatibility
        // Try multiple path strategies in order
        let wasmInitialized = false;
        const pathsToTry = [
          '/wasm/',  // Relative path (standard)
          window.location.origin + '/wasm/',  // Absolute URL
          './wasm/',  // Relative to current page
        ];

        console.log('Platform:', navigator.platform, 'User Agent:', navigator.userAgent);

        for (let i = 0; i < pathsToTry.length && !wasmInitialized; i++) {
          const wasmPath = pathsToTry[i];
          try {
            console.log(`[Attempt ${i + 1}/${pathsToTry.length}] Setting WASM path to:`, wasmPath);
            await ifcLoader.ifcManager.setWasmPath(wasmPath);
            console.log('✓ WASM path set successfully:', wasmPath);

            // Wait for WASM to fully initialize (important for Windows)
            console.log('Waiting for WASM module to initialize...');
            await new Promise(resolve => setTimeout(resolve, 500));

            // Test that the WASM module is actually usable
            try {
              const state = ifcLoader.ifcManager.state;
              if (state && state.api) {
                console.log('✓ WASM module initialized and ready');
                wasmInitialized = true;
              } else {
                console.warn('WASM module loaded but not fully initialized, trying next path...');
              }
            } catch (testErr) {
              console.warn('WASM module test failed:', testErr);
            }
          } catch (wasmErr) {
            console.warn(`✗ Failed to set WASM path (${wasmPath}):`, wasmErr);
            if (i === pathsToTry.length - 1) {
              throw new Error('Failed to initialize WASM components after trying all paths. Please ensure web-ifc WASM files are accessible.');
            }
          }
        }

        // Load the model
        const modelUrl = `${API_BASE}/api/digital-infrastructure/models/${modelId}/file`;

        ifcLoader.load(
          modelUrl,
          (ifcModel) => {
            scene.add(ifcModel);
            viewerRef.current.model = ifcModel;

            // Store original materials and collect meshes for GUID mapping
            const guidToMeshMap = new Map();
            const meshesWithExpressID = [];

            ifcModel.traverse((child) => {
              if (child.isMesh && child.material) {
                // Handle both single materials and arrays of materials
                if (Array.isArray(child.material)) {
                  viewerRef.current.originalMaterials.set(child.uuid, child.material.map(m => m.clone ? m.clone() : m));
                } else if (child.material.clone) {
                  viewerRef.current.originalMaterials.set(child.uuid, child.material.clone());
                } else {
                  viewerRef.current.originalMaterials.set(child.uuid, child.material);
                }

                // Collect meshes that have express IDs
                if (child.expressID !== undefined) {
                  meshesWithExpressID.push(child);
                }
              }
            });

            // Build GUID map asynchronously
            (async () => {
              console.log('Building GUID map for', meshesWithExpressID.length, 'meshes');
              let successCount = 0;
              let errorCount = 0;

              for (const mesh of meshesWithExpressID) {
                try {
                  // Check if ifcManager and its methods are properly initialized
                  if (!ifcLoader.ifcManager || typeof ifcLoader.ifcManager.getItemProperties !== 'function') {
                    console.error('IFC Manager not properly initialized');
                    break;
                  }

                  const props = await ifcLoader.ifcManager.getItemProperties(ifcModel.modelID, mesh.expressID);
                  const globalId = props?.GlobalId?.value;
                  if (globalId) {
                    guidToMeshMap.set(globalId, mesh);
                    successCount++;
                  }
                } catch (err) {
                  errorCount++;
                  // Log first few errors for debugging
                  if (errorCount <= 3) {
                    console.warn(`Error getting properties for expressID ${mesh.expressID}:`, err.message);
                  }
                }
              }

              console.log('GUID map built:', successCount, 'successful,', errorCount, 'errors. Total map size:', guidToMeshMap.size);
            })();

            viewerRef.current.guidToMeshMap = guidToMeshMap;

            // Center camera on model
            const box = new THREE.Box3().setFromObject(ifcModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            // Position grid at the bottom of the model
            if (viewerRef.current.gridHelper) {
              viewerRef.current.gridHelper.position.y = box.min.y;
            }

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
            console.error('Error stack:', err.stack);

            // Check if it's a 404 error (file not found on server)
            if (err.message && err.message.includes('404')) {
              setError('IFC file not found on server. The file may need to be re-uploaded. Please contact an administrator.');
            } else if (err.message && (err.message.includes('WASM') || err.message.includes('wasm'))) {
              setError('Failed to load IFC viewer WASM components. This may be a browser compatibility issue. Try refreshing the page or using a different browser (Chrome/Edge recommended).');
            } else if (err.message && err.message.includes('fetch')) {
              setError('Network error loading IFC model. Please check your internet connection and try again.');
            } else {
              setError(`Failed to load IFC model: ${err.message || 'Unknown error'}. The file may be corrupted or incompatible.`);
            }
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
      console.log('IFCModelViewer: Starting cleanup');

      // Cancel animation loop
      if (viewerRef.current.animationFrameId) {
        cancelAnimationFrame(viewerRef.current.animationFrameId);
        viewerRef.current.animationFrameId = null;
      }

      // Remove event listener
      window.removeEventListener('resize', handleResize);

      // Dispose controls
      if (viewerRef.current.controls) {
        viewerRef.current.controls.dispose();
      }

      // Dispose model and all its children
      if (viewerRef.current.model) {
        viewerRef.current.model.traverse((child) => {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => {
                if (material.map) material.map.dispose();
                if (material.lightMap) material.lightMap.dispose();
                if (material.bumpMap) material.bumpMap.dispose();
                if (material.normalMap) material.normalMap.dispose();
                if (material.specularMap) material.specularMap.dispose();
                if (material.envMap) material.envMap.dispose();
                material.dispose();
              });
            } else {
              if (child.material.map) child.material.map.dispose();
              if (child.material.lightMap) child.material.lightMap.dispose();
              if (child.material.bumpMap) child.material.bumpMap.dispose();
              if (child.material.normalMap) child.material.normalMap.dispose();
              if (child.material.specularMap) child.material.specularMap.dispose();
              if (child.material.envMap) child.material.envMap.dispose();
              child.material.dispose();
            }
          }
        });

        if (viewerRef.current.scene) {
          viewerRef.current.scene.remove(viewerRef.current.model);
        }
        viewerRef.current.model = null;
      }

      // Dispose scene objects
      if (viewerRef.current.scene) {
        while(viewerRef.current.scene.children.length > 0) {
          const object = viewerRef.current.scene.children[0];
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(m => m.dispose());
            } else {
              object.material.dispose();
            }
          }
          viewerRef.current.scene.remove(object);
        }
      }

      // Dispose IFC loader
      if (viewerRef.current.ifcLoader) {
        try {
          // Close the IFC model if it was loaded
          if (viewerRef.current.model && viewerRef.current.model.modelID !== undefined) {
            viewerRef.current.ifcLoader.ifcManager.close(viewerRef.current.model.modelID);
          }
          // Dispose the IFC manager
          if (viewerRef.current.ifcLoader.ifcManager) {
            viewerRef.current.ifcLoader.ifcManager.dispose();
          }
        } catch (err) {
          console.warn('Error disposing IFC loader:', err);
        }
        viewerRef.current.ifcLoader = null;
      }

      // Dispose renderer
      if (viewerRef.current.renderer) {
        viewerRef.current.renderer.dispose();
        viewerRef.current.renderer.forceContextLoss();
        viewerRef.current.renderer.domElement = null;
        viewerRef.current.renderer = null;
      }

      // Remove canvas from DOM
      if (container && container.firstChild && container.firstChild.tagName === 'CANVAS') {
        container.removeChild(container.firstChild);
      }

      // Clear maps
      if (viewerRef.current.originalMaterials) {
        viewerRef.current.originalMaterials.clear();
      }
      if (viewerRef.current.guidToMeshMap) {
        viewerRef.current.guidToMeshMap.clear();
      }

      // Clear all references
      viewerRef.current.scene = null;
      viewerRef.current.camera = null;
      viewerRef.current.controls = null;
      viewerRef.current.gridHelper = null;

      console.log('IFCModelViewer: Cleanup complete');
    };
  }, [modelId, filename]);

  // Highlight elements based on mode
  useEffect(() => {
    if (!viewerRef.current.model || !viewerRef.current.ifcLoader) return;

    const model = viewerRef.current.model;
    const originalMaterials = viewerRef.current.originalMaterials;
    const ifcLoader = viewerRef.current.ifcLoader;

    // Reset all materials first
    model.traverse((child) => {
      if (child.isMesh && originalMaterials.has(child.uuid)) {
        const storedMaterial = originalMaterials.get(child.uuid);
        // Handle both single materials and arrays of materials
        if (Array.isArray(storedMaterial)) {
          child.material = storedMaterial.map(m => m.clone ? m.clone() : m);
        } else if (storedMaterial.clone) {
          child.material = storedMaterial.clone();
        } else {
          child.material = storedMaterial;
        }
      }
    });

    if (highlightMode === 'none') return;

    // Build set of GUIDs to highlight based on mode
    let guidsToHighlight = new Set();
    if (highlightMode === 'gaps') {
      gaps.forEach(gap => guidsToHighlight.add(gap.ifc_guid));
    } else if (highlightMode === 'v2x') {
      elements.filter(e => e.v2x_applicable).forEach(el => guidsToHighlight.add(el.ifc_guid));
    } else if (highlightMode === 'av') {
      elements.filter(e => e.av_critical).forEach(el => guidsToHighlight.add(el.ifc_guid));
    }

    if (guidsToHighlight.size === 0) return;

    // Select color based on highlight mode
    let highlightColor;
    if (highlightMode === 'gaps') {
      highlightColor = new THREE.Color(0xffa500); // Orange for gaps
    } else if (highlightMode === 'v2x') {
      highlightColor = new THREE.Color(0x00ff00); // Green for V2X
    } else if (highlightMode === 'av') {
      highlightColor = new THREE.Color(0x0000ff); // Blue for AV
    }

    // Use the pre-built GUID map to highlight elements
    const guidToMeshMap = viewerRef.current.guidToMeshMap;
    console.log('GUIDs to highlight:', guidsToHighlight.size, 'Mesh map size:', guidToMeshMap.size);

    guidsToHighlight.forEach(guid => {
      const mesh = guidToMeshMap.get(guid);
      if (mesh) {
        // Create a new material with the highlight color
        const highlightMaterial = new THREE.MeshLambertMaterial({
          color: highlightColor,
          transparent: true,
          opacity: 0.7,
          depthTest: true
        });
        mesh.material = highlightMaterial;
      } else {
        console.warn('Mesh not found for GUID:', guid);
      }
    });
  }, [highlightMode, elements, gaps]);

  const highlightOptions = [
    { value: 'none', label: 'No Highlighting', color: '#666', icon: '○' },
    { value: 'gaps', label: `Elements with Gaps (${gaps.length})`, color: '#6b7280', icon: '⚠️' },
    { value: 'v2x', label: `V2X Elements (${elements.filter(e => e.v2x_applicable).length})`, color: '#00ff00', icon: '📡' },
    { value: 'av', label: `AV Critical (${elements.filter(e => e.av_critical).length})`, color: '#0000ff', icon: '🚗' }
  ];

  return (
    <div style={{ position: 'relative', width: '100%', height: '600px', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
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
