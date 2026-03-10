# Architecture Diagram Specifications
## For PowerPoint Slide Integration

Since automated diagram generation encountered network issues, here are detailed specifications for creating diagrams manually using PowerPoint SmartArt, draw.io, or similar tools.

---

## Diagram 1: System Architecture Overview

**Placement:** Slide 6 (Processes: Operational Workflows) or Appendix
**Type:** Layered architecture diagram (5 layers, bottom-up)
**Size:** Full slide width, portrait orientation
**Colors:** Blue (#003399), Light Blue (#3366cc), Orange (#ff6600), Green (#00cc66), Gray (#666666)

### Layer Structure (Bottom to Top):

#### **Layer 1: Data Sources** (Bottom, Gray background)
```
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│   511   │State DOT│  USDOT  │  FHWA   │ IPAWS   │ Census/ │ Weather │
│ Systems │ WFS/WMS │V2X Data │ ARNOLD  │ Alerts  │LandScan │  APIs   │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```
**Elements:** 7 boxes, rounded corners, light gray fill
**Labels:** Centered, bold, 10pt font

#### **Layer 2: Integration & Processing** (Light Blue background)
```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│  Geometry    │     Data     │  Population  │  CADD/IFC    │  Real-time   │
│  Validation  │Normalization │  Analytics   │   Parsing    │ Aggregation  │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```
**Elements:** 5 boxes, rounded corners, light blue fill (#3366cc)
**Labels:** White text, bold, 11pt font
**Arrows:** Thin gray arrows from each Layer 1 box to multiple Layer 2 boxes

#### **Layer 3: Backend Services** (Orange background)
```
┌────────────────────────────────────────────────────────────────────┐
│  Node.js/Express Backend                                           │
│  ┌────────┬──────────┬────────┬────────┬──────────┐               │
│  │RESTful │ Database │  OSRM  │  File  │WebSocket │               │
│  │  API   │SQLite/PG │Routing │Storage │Streaming │               │
│  └────────┴──────────┴────────┴────────┴──────────┘               │
└────────────────────────────────────────────────────────────────────┘
```
**Elements:** Large orange rounded rectangle containing 5 smaller white boxes
**Labels:** Orange (#ff6600) header, internal boxes with white background
**Arrows:** Bold orange arrows from Layer 2 boxes converging to center of Layer 3

#### **Layer 4: Frontend Application** (Green background)
```
┌────────────────────────────────────────────────────────────────────┐
│  React.js Frontend                                                 │
│  ┌────────┬──────────┬──────────┬──────────┬──────────┐           │
│  │Traffic │   IPAWS  │ Digital  │Analytics │CADD/IFC  │           │
│  │  Map   │  Alert   │  Infra   │Dashboard │  Viewer  │           │
│  │(Leaflet)│Generator│  Viewer  │          │          │           │
│  └────────┴──────────┴──────────┴──────────┴──────────┘           │
└────────────────────────────────────────────────────────────────────┘
```
**Elements:** Large green rounded rectangle containing 5 smaller white boxes
**Labels:** Green (#00cc66) header, internal boxes with white background
**Arrows:** Bidirectional thick blue arrow between Layer 3 and Layer 4, labeled "REST API / WebSocket"

#### **Layer 5: End Users** (Top, No background)
```
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│  🎛️  │  │  🚨  │  │  👔  │  │  🚛  │  │  🚗  │
│ TMC  │  │Emerg.│  │  DOT │  │Freight│  │Public│
│Oper. │  │Mgrs. │  │Leader│  │Oper. │  │Travel│
└──────┘  └──────┘  └──────┘  └──────┘  └──────┘
```
**Elements:** 5 small boxes with emojis, minimal styling
**Labels:** Centered below emoji
**Arrows:** Dashed gray arrows from Layer 4 to each user type

---

## Diagram 2: Incident Processing Data Flow

**Placement:** Slide 6 (Processes: Operational Workflows)
**Type:** Flowchart diagram
**Size:** Full slide width, landscape orientation
**Colors:** Blue, Orange, Purple, Red, Green

### Flow Structure (Left to Right):

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   511 Feed  │────▶│  Geometry   │────▶│  ARNOLD/DOT │────▶│ Population  │────▶│    IPAWS    │
│  Ingestion  │     │ Validation  │     │ Correction  │     │   Impact    │     │    Alert    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
  (Blue)              (Orange)            (Orange)            (Purple)            (Red)
      │                   │                    │                    │                    │
      │                   ▼                    ▼                    ▼                    ▼
      │            ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
      └───────────▶│  Database   │     │Freight TTTR │     │ Stakeholder │     │     Map     │
                   │   Storage   │     │ Calculation │     │Notification │     │Visualization│
                   └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                     (Green)             (Purple)            (Red)               (Green)
                          │                    │                    │                    │
                          └────────────────────┴────────────────────┴────────────────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────────┐
                                              │   Real-time         │
                                              │   Dashboard & API   │
                                              └─────────────────────┘
                                                   (Blue/Green)
```

**Key Features:**
- Use thick arrows (3pt) for primary flow
- Use thin arrows (1pt) for secondary outputs
- Label arrows with data type (e.g., "Raw Incident", "Corrected Geometry")
- Include timing annotation: "⏱️ 30-60 second end-to-end latency"

---

## Diagram 3: Interstate 2.0 Coverage Gap Analysis

**Placement:** Slide 9 (Gap Analysis)
**Type:** Comparative progress bars
**Size:** Full slide width, horizontal layout
**Colors:** Green (on track), Yellow (needs improvement), Red (critical gap)

### Layout:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CURRENT STATE              │  TARGET (Interstate 2.0)                   │
├─────────────────────────────────────────────────────────────────────────┤
│                             │                                            │
│  V2X RSU Coverage           │  V2X RSU Coverage                          │
│  ███████░░░░░░░ 35% 🔴      │  ████████████████ 95% 🟢                   │
│                             │                                            │
│  WZDx Adoption              │  WZDx Adoption                             │
│  ████████████░░ 60% 🟡      │  ████████████████ 100% 🟢                  │
│                             │                                            │
│  Digital Infrastructure     │  Digital Infrastructure                    │
│  █████░░░░░░░░░ 25% 🔴      │  ███████████████░ 90% 🟢                   │
│                             │                                            │
│  Interstate HD Mapping      │  Interstate HD Mapping                     │
│  ███░░░░░░░░░░░ 15% 🔴      │  ██████████████░░ 85% 🟢                   │
│                             │                                            │
│  AI/ML Analytics            │  AI/ML Analytics                           │
│  ████████░░░░░░ 40% 🟡      │  ██████████████░░ 80% 🟢                   │
│                             │                                            │
└─────────────────────────────┴────────────────────────────────────────────┘
                    ──────────────────▶
                  Investment & Standardization
```

**Implementation Notes:**
- Use PowerPoint progress bar SmartArt or create custom rectangles
- Color code current state: Red <40%, Yellow 40-70%, Green >70%
- All target states should be green
- Add large arrow between columns showing progression

**Legend:**
- 🟢 On Track
- 🟡 Needs Improvement
- 🔴 Critical Gap

---

## PowerPoint SmartArt Recommendations

### For System Architecture (Diagram 1):
1. Insert → SmartArt → Hierarchy → "Hierarchy List"
2. Customize to 5 levels
3. Change colors to match specification
4. Add connector arrows manually

### For Data Flow (Diagram 2):
1. Insert → SmartArt → Process → "Basic Process"
2. Add additional shapes for parallel processes
3. Use "Elbow Arrow Connector" for data flows
4. Add text boxes for annotations

### For Coverage Gaps (Diagram 3):
1. Insert → Shapes → Rectangle
2. Create progress bar backgrounds (gray)
3. Create progress bar fills (colored by percentage)
4. Duplicate and align for each metric
5. Add percentage labels

---

## Alternative: Use Draw.io or Lucidchart

If you prefer professional diagramming tools:

1. **Draw.io (free):** https://app.diagrams.net/
   - Import into PowerPoint as PNG/SVG
   - Use "AWS Architecture" template for layered diagrams
   - Use "Flowchart" template for data flow

2. **Lucidchart (paid):** https://www.lucidchart.com/
   - Has DOT/transportation-specific icons
   - Direct PowerPoint export

3. **Microsoft Visio (paid):** Native Office integration
   - Network Diagram templates work well for architecture
   - Process Flow templates for data flow

---

## Screenshot Capture Guide

### Recommended Screenshots for Slide 11 (Demo):

**To capture:**
1. Start the frontend application
2. Zoom browser to 100%
3. Hide browser toolbars (F11 for full screen)
4. Use native screenshot tools:
   - macOS: Cmd+Shift+4 (select area) or Cmd+Shift+3 (full screen)
   - Windows: Win+Shift+S or Snipping Tool
5. Save as PNG (highest quality)
6. Name systematically: `screenshot_[feature]_[number].png`

### Priority Screenshots (in order):

1. **Main Map Overview**
   - Show: 10+ active incidents across multiple states
   - Zoom level: Interstate corridors visible
   - Filename: `screenshot_map_overview_01.png`

2. **V2X Deployments Layer**
   - Show: V2X deployment markers with info panel
   - Zoom to area with multiple deployments (Tampa, Ohio, Wyoming)
   - Filename: `screenshot_v2x_deployments_02.png`

3. **IPAWS Alert Generator (Full Screen)**
   - Open the IPAWS modal on a major incident
   - Show all controls: buffer slider, severity, alert type
   - Show geofence polygon on map
   - Filename: `screenshot_ipaws_geofence_03.png`

4. **Population Impact Detail**
   - Event card showing population statistics
   - Visible population numbers
   - Filename: `screenshot_population_impact_04.png`

5. **CADD/IFC Viewer**
   - Open a sample model
   - Show ITS Equipment tab or Layers tab
   - Filename: `screenshot_cadd_viewer_05.png`

6. **Work Zone with Corrected Geometry**
   - Event card showing "Corrected Geometry" badge
   - Source attribution visible (ARNOLD or Iowa DOT)
   - Filename: `screenshot_corrected_geometry_06.png`

7. **CADD Elements on Map**
   - CADD Elements Layer active
   - Show element markers with feedback panel
   - Filename: `screenshot_cadd_map_layer_07.png`

### Screenshot Editing Tips:

- **Crop:** Remove unnecessary browser chrome, focus on content
- **Annotate:** Add arrows/callouts in PowerPoint, not before capture
- **Resolution:** Capture at least 1920x1080, resize in PowerPoint
- **Consistency:** Use same browser zoom level for all screenshots
- **Privacy:** Ensure no sensitive data is visible

---

## Inserting Diagrams and Screenshots into PowerPoint

### Method 1: Replace Placeholders
The Python-generated PowerPoint has text placeholders where diagrams should go. To replace:

1. Open `Interstate_2.0_Presentation.pptx`
2. Navigate to relevant slide
3. Delete placeholder text
4. Insert → Pictures → Select your diagram/screenshot
5. Resize to fit content area
6. Use "Format Picture" → "Crop" to adjust if needed

### Method 2: Embed as Objects
For interactive diagrams:

1. Create diagram in Visio or Draw.io
2. Insert → Object → From File
3. Check "Link to file" for live updates
4. Resize and position

### Method 3: Copy-Paste
Quickest method for screenshots:

1. Take screenshot
2. Open in Preview/Photos
3. Cmd+C (copy)
4. Go to PowerPoint slide
5. Cmd+V (paste)
6. Resize and position

---

## Quality Checklist

Before finalizing presentation, verify:

- [ ] All diagrams are high resolution (no pixelation when projected)
- [ ] Colors match brand guidelines (USDOT blue #003399)
- [ ] Text is readable from 10 feet away (minimum 14pt font)
- [ ] Screenshots show real data (not "lorem ipsum" or test data)
- [ ] Arrows and connectors are clear and purposeful
- [ ] No sensitive information visible in screenshots
- [ ] Diagrams align with narrative in speaker notes
- [ ] File size is reasonable (<50MB for entire presentation)

---

## Next Steps

1. **Option A - Manual Creation:**
   - Use specifications above to create diagrams in PowerPoint SmartArt
   - Estimated time: 30-45 minutes

2. **Option B - Professional Tools:**
   - Import specifications into Draw.io or Lucidchart
   - Estimated time: 60-90 minutes (higher quality)

3. **Option C - Hire Designer:**
   - Send specifications to graphic designer
   - Estimated time: 24-48 hours, ~$100-200 cost

4. **Option D - Screenshot Only:**
   - Skip complex diagrams, focus on real application screenshots
   - Use application itself as visual proof of concept
   - Estimated time: 15-20 minutes

**Recommendation:** Start with Option D (screenshots) for immediate presentation needs, then create proper diagrams for future reuse (Option A or B).
