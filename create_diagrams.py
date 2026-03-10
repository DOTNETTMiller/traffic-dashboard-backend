#!/usr/bin/env python3
"""
Generate architecture diagrams for Interstate 2.0 presentation
Requires: pip install matplotlib pillow
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.lines as mlines

def create_system_architecture_diagram():
    """Create system architecture overview diagram"""
    fig, ax = plt.subplots(1, 1, figsize=(14, 10))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 10)
    ax.axis('off')

    # Colors
    blue = '#003399'
    light_blue = '#3366cc'
    orange = '#ff6600'
    green = '#00cc66'
    gray = '#666666'
    light_gray = '#e6e6e6'

    # Title
    ax.text(7, 9.5, 'DOT Corridor Communicator\nSystem Architecture',
            ha='center', va='top', fontsize=18, fontweight='bold', color=blue)

    # Layer 1: Data Sources (Bottom)
    sources_y = 0.5
    source_width = 1.8
    source_height = 0.6

    sources = [
        ('511\nSystems', 0.5),
        ('State DOT\nWFS/WMS', 2.5),
        ('USDOT\nV2X Data', 4.5),
        ('FHWA\nARNOLD', 6.5),
        ('IPAWS\nAlerts', 8.5),
        ('Census/\nLandScan', 10.5),
        ('Weather\nAPIs', 12.5)
    ]

    ax.text(0.5, 1.5, 'Data Sources Layer', fontsize=12, fontweight='bold', color=gray)

    for source_name, x in sources:
        rect = FancyBboxPatch((x, sources_y), source_width, source_height,
                               boxstyle="round,pad=0.05",
                               edgecolor=blue, facecolor=light_gray, linewidth=2)
        ax.add_patch(rect)
        ax.text(x + source_width/2, sources_y + source_height/2, source_name,
                ha='center', va='center', fontsize=8, fontweight='bold')

    # Layer 2: Integration/Processing Layer
    integration_y = 2.5

    ax.text(0.5, 3.8, 'Integration & Processing Layer', fontsize=12, fontweight='bold', color=gray)

    # Integration components
    integration_boxes = [
        ('Geometry\nValidation', 1.5, light_blue),
        ('Data\nNormalization', 4, light_blue),
        ('Population\nAnalytics', 6.5, light_blue),
        ('CADD/IFC\nParsing', 9, light_blue),
        ('Real-time\nAggregation', 11.5, light_blue)
    ]

    for name, x, color in integration_boxes:
        rect = FancyBboxPatch((x, integration_y), 2, 0.8,
                               boxstyle="round,pad=0.05",
                               edgecolor=blue, facecolor=color, linewidth=2)
        ax.add_patch(rect)
        ax.text(x + 1, integration_y + 0.4, name,
                ha='center', va='center', fontsize=9, fontweight='bold', color='white')

    # Arrows from sources to integration
    for _, sx in sources:
        for name, ix, _ in integration_boxes:
            arrow = FancyArrowPatch((sx + source_width/2, sources_y + source_height),
                                   (ix + 1, integration_y),
                                   arrowstyle='->', mutation_scale=15,
                                   linewidth=0.5, color=gray, alpha=0.3)
            ax.add_patch(arrow)

    # Layer 3: Backend Services
    backend_y = 4.5

    ax.text(0.5, 5.8, 'Backend Services (Node.js/Express)', fontsize=12, fontweight='bold', color=gray)

    backend_box = FancyBboxPatch((1, backend_y), 12, 1,
                                  boxstyle="round,pad=0.1",
                                  edgecolor=orange, facecolor='#fff5e6', linewidth=3)
    ax.add_patch(backend_box)

    backend_services = [
        ('RESTful API', 1.5, 4.7),
        ('Database\n(SQLite/PostgreSQL)', 3.8, 4.7),
        ('OSRM Routing', 6.5, 4.7),
        ('File Storage', 9, 4.7),
        ('WebSocket\nStreaming', 11.2, 4.7)
    ]

    for name, x, y in backend_services:
        ax.text(x, y, name, ha='center', va='center',
                fontsize=8, fontweight='bold', color=orange,
                bbox=dict(boxstyle='round,pad=0.3', facecolor='white', edgecolor=orange, linewidth=1.5))

    # Arrows from integration to backend
    for name, ix, _ in integration_boxes:
        arrow = FancyArrowPatch((ix + 1, integration_y + 0.8),
                               (7, backend_y),
                               arrowstyle='->', mutation_scale=20,
                               linewidth=2, color=orange)
        ax.add_patch(arrow)

    # Layer 4: Frontend Application
    frontend_y = 6.5

    ax.text(0.5, 7.8, 'Frontend Application (React.js)', fontsize=12, fontweight='bold', color=gray)

    frontend_box = FancyBboxPatch((1, frontend_y), 12, 1,
                                   boxstyle="round,pad=0.1",
                                   edgecolor=green, facecolor='#e6ffe6', linewidth=3)
    ax.add_patch(frontend_box)

    frontend_components = [
        ('Traffic Map\n(Leaflet)', 1.5, 6.7),
        ('IPAWS Alert\nGenerator', 3.8, 6.7),
        ('Digital Infra\nViewer', 6, 6.7),
        ('Analytics\nDashboard', 8.5, 6.7),
        ('CADD/IFC\nViewer', 11, 6.7)
    ]

    for name, x, y in frontend_components:
        ax.text(x, y, name, ha='center', va='center',
                fontsize=8, fontweight='bold', color=green,
                bbox=dict(boxstyle='round,pad=0.3', facecolor='white', edgecolor=green, linewidth=1.5))

    # Arrow from backend to frontend
    arrow = FancyArrowPatch((7, backend_y + 1),
                           (7, frontend_y),
                           arrowstyle='<->', mutation_scale=25,
                           linewidth=3, color=blue)
    ax.add_patch(arrow)
    ax.text(7.5, 6, 'REST API\nWebSocket', ha='left', va='center',
            fontsize=8, fontweight='bold', color=blue)

    # Layer 5: End Users
    users_y = 8.5

    users = [
        ('TMC\nOperators', 2, '🎛️'),
        ('Emergency\nManagers', 4.5, '🚨'),
        ('DOT\nLeadership', 7, '👔'),
        ('Freight\nOperators', 9.5, '🚛'),
        ('Public\nTravelers', 12, '🚗')
    ]

    for name, x, icon in users:
        # Icon
        ax.text(x, users_y + 0.3, icon, ha='center', va='center', fontsize=24)
        # Label
        ax.text(x, users_y - 0.2, name, ha='center', va='top', fontsize=8, fontweight='bold')

        # Arrow from frontend to user
        arrow = FancyArrowPatch((x, frontend_y + 1),
                               (x, users_y - 0.3),
                               arrowstyle='->', mutation_scale=15,
                               linewidth=1.5, color=gray, linestyle='dashed')
        ax.add_patch(arrow)

    plt.tight_layout()
    plt.savefig('system_architecture_diagram.png', dpi=300, bbox_inches='tight', facecolor='white')
    print("✅ Created: system_architecture_diagram.png")
    plt.close()

def create_data_flow_diagram():
    """Create data flow diagram for incident processing"""
    fig, ax = plt.subplots(1, 1, figsize=(14, 8))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 8)
    ax.axis('off')

    # Colors
    blue = '#003399'
    green = '#00cc66'
    orange = '#ff6600'
    red = '#dc3545'
    purple = '#8b5cf6'

    # Title
    ax.text(7, 7.5, 'Incident Processing Data Flow',
            ha='center', va='top', fontsize=18, fontweight='bold', color=blue)

    # Process boxes
    processes = [
        # (name, x, y, width, height, color)
        ('511 Feed\nIngestion', 1, 5.5, 1.8, 1, blue),
        ('Geometry\nValidation', 3.5, 5.5, 1.8, 1, orange),
        ('ARNOLD/DOT\nCorrection', 6, 5.5, 1.8, 1, orange),
        ('Population\nImpact', 8.5, 5.5, 1.8, 1, purple),
        ('IPAWS Alert\nGeneration', 11, 5.5, 1.8, 1, red),

        # Second row
        ('Database\nStorage', 3.5, 3.5, 1.8, 1, green),
        ('Freight TTTR\nCalculation', 6, 3.5, 1.8, 1, purple),
        ('Stakeholder\nNotification', 8.5, 3.5, 1.8, 1, red),
        ('Map\nVisualization', 11, 3.5, 1.8, 1, green),

        # Third row
        ('Real-time\nDashboard', 5, 1.5, 2, 1, green),
        ('API\nEndpoints', 8, 1.5, 2, 1, blue)
    ]

    for name, x, y, w, h, color in processes:
        rect = FancyBboxPatch((x, y), w, h,
                               boxstyle="round,pad=0.1",
                               edgecolor=color, facecolor='white', linewidth=2.5)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h/2, name,
                ha='center', va='center', fontsize=9, fontweight='bold', color=color)

    # Data flow arrows
    flows = [
        # (from_box_idx, to_box_idx, label)
        (0, 1, 'Raw\nIncident'),
        (1, 2, 'Invalid\nGeometry'),
        (2, 3, 'Corrected\nGeometry'),
        (3, 4, 'Population\nData'),
        (1, 5, 'Valid Data'),
        (2, 6, 'Interstate\nEvents'),
        (4, 7, 'WEA Alert'),
        (3, 8, 'Geo Data'),
        (5, 9, 'Live Data'),
        (6, 10, 'Metrics'),
        (7, 10, 'Alerts'),
        (8, 10, 'Layers')
    ]

    # Calculate box centers
    box_centers = [(x + w/2, y + h/2) for name, x, y, w, h, color in processes]

    for from_idx, to_idx, label in flows:
        from_x, from_y = box_centers[from_idx]
        to_x, to_y = box_centers[to_idx]

        # Adjust start/end points to box edges
        if from_y > to_y:  # Going down
            from_y = from_y - processes[from_idx][4]/2
            to_y = to_y + processes[to_idx][4]/2
        elif from_y < to_y:  # Going up
            from_y = from_y + processes[from_idx][4]/2
            to_y = to_y - processes[to_idx][4]/2

        if from_x < to_x:  # Going right
            from_x = from_x + processes[from_idx][3]/2
            to_x = to_x - processes[to_idx][3]/2
        elif from_x > to_x:  # Going left
            from_x = from_x - processes[from_idx][3]/2
            to_x = to_x + processes[to_idx][3]/2

        arrow = FancyArrowPatch((from_x, from_y), (to_x, to_y),
                               arrowstyle='->', mutation_scale=20,
                               linewidth=2, color='#666666')
        ax.add_patch(arrow)

        # Add label
        mid_x = (from_x + to_x) / 2
        mid_y = (from_y + to_y) / 2
        ax.text(mid_x, mid_y, label, ha='center', va='center',
                fontsize=7, color='#333333',
                bbox=dict(boxstyle='round,pad=0.2', facecolor='white', edgecolor='none', alpha=0.8))

    # Add timing annotations
    ax.text(1, 7, '⏱️ Real-time Processing (30-60 second latency)',
            ha='left', va='center', fontsize=10, fontweight='bold', color='#666666',
            bbox=dict(boxstyle='round,pad=0.3', facecolor='#ffffcc', edgecolor='#999999'))

    plt.tight_layout()
    plt.savefig('data_flow_diagram.png', dpi=300, bbox_inches='tight', facecolor='white')
    print("✅ Created: data_flow_diagram.png")
    plt.close()

def create_interstate_coverage_diagram():
    """Create Interstate 2.0 coverage gap visualization"""
    fig, ax = plt.subplots(1, 1, figsize=(14, 6))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 6)
    ax.axis('off')

    # Colors
    green = '#00cc66'
    yellow = '#ffc107'
    red = '#dc3545'
    blue = '#003399'

    # Title
    ax.text(7, 5.5, 'Interstate 2.0: Coverage Gap Analysis',
            ha='center', va='top', fontsize=18, fontweight='bold', color=blue)

    # Current State
    ax.text(3.5, 4.5, 'Current State', ha='center', va='center',
            fontsize=14, fontweight='bold', color=blue)

    current_metrics = [
        ('V2X RSU Coverage', 35, green),
        ('WZDx Adoption', 60, yellow),
        ('Digital Infrastructure Catalog', 25, red),
        ('Interstate HD Mapping', 15, red),
        ('AI/ML Analytics', 40, yellow)
    ]

    y_pos = 3.8
    for metric, percent, color in current_metrics:
        # Label
        ax.text(1, y_pos, metric, ha='left', va='center', fontsize=9, fontweight='bold')

        # Progress bar background
        rect_bg = FancyBboxPatch((2.5, y_pos - 0.15), 1.8, 0.3,
                                  boxstyle="round,pad=0.01",
                                  edgecolor='#cccccc', facecolor='#f0f0f0', linewidth=1)
        ax.add_patch(rect_bg)

        # Progress bar fill
        rect_fill = FancyBboxPatch((2.5, y_pos - 0.15), 1.8 * percent/100, 0.3,
                                    boxstyle="round,pad=0.01",
                                    edgecolor=color, facecolor=color, linewidth=1)
        ax.add_patch(rect_fill)

        # Percentage
        ax.text(4.5, y_pos, f'{percent}%', ha='left', va='center',
                fontsize=9, fontweight='bold', color=color)

        y_pos -= 0.6

    # Target State (Interstate 2.0)
    ax.text(10.5, 4.5, 'Interstate 2.0 Target', ha='center', va='center',
            fontsize=14, fontweight='bold', color=green)

    target_metrics = [
        ('V2X RSU Coverage', 95),
        ('WZDx Adoption', 100),
        ('Digital Infrastructure Catalog', 90),
        ('Interstate HD Mapping', 85),
        ('AI/ML Analytics', 80)
    ]

    y_pos = 3.8
    for metric, percent in target_metrics:
        # Label
        ax.text(8, y_pos, metric, ha='left', va='center', fontsize=9, fontweight='bold')

        # Progress bar background
        rect_bg = FancyBboxPatch((9.5, y_pos - 0.15), 1.8, 0.3,
                                  boxstyle="round,pad=0.01",
                                  edgecolor='#cccccc', facecolor='#f0f0f0', linewidth=1)
        ax.add_patch(rect_bg)

        # Progress bar fill (always green for targets)
        rect_fill = FancyBboxPatch((9.5, y_pos - 0.15), 1.8 * percent/100, 0.3,
                                    boxstyle="round,pad=0.01",
                                    edgecolor=green, facecolor=green, linewidth=1)
        ax.add_patch(rect_fill)

        # Percentage
        ax.text(11.5, y_pos, f'{percent}%', ha='left', va='center',
                fontsize=9, fontweight='bold', color=green)

        y_pos -= 0.6

    # Arrow showing progression
    arrow = FancyArrowPatch((5, 2.5), (7.5, 2.5),
                           arrowstyle='->', mutation_scale=30,
                           linewidth=4, color=blue)
    ax.add_patch(arrow)
    ax.text(6.25, 2.8, 'Investment &\nStandardization', ha='center', va='bottom',
            fontsize=10, fontweight='bold', color=blue)

    # Legend
    legend_y = 0.5
    ax.text(1, legend_y, '🟢 On Track  🟡 Needs Improvement  🔴 Critical Gap',
            ha='left', va='center', fontsize=9, fontweight='bold')

    plt.tight_layout()
    plt.savefig('interstate_coverage_diagram.png', dpi=300, bbox_inches='tight', facecolor='white')
    print("✅ Created: interstate_coverage_diagram.png")
    plt.close()

if __name__ == "__main__":
    try:
        print("Creating architecture diagrams...")
        create_system_architecture_diagram()
        create_data_flow_diagram()
        create_interstate_coverage_diagram()
        print("\n✅ All diagrams created successfully!")
        print("   - system_architecture_diagram.png")
        print("   - data_flow_diagram.png")
        print("   - interstate_coverage_diagram.png")
    except ImportError as e:
        print(f"❌ Error: Missing required library - {e}")
        print("Install with: pip install matplotlib")
        exit(1)
