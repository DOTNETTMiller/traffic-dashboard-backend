CARS 511 WORK-ZONE REQUEST BUILDER — PACKAGE
============================================
A single-file tool that helps Iowa DOT field/RCE staff build a CARS 511
work-zone request from a map, then fill the official 511 PDF, email the TMC,
or submit to a database. Self-contained — just open the HTML file.


WHAT'S IN THIS ZIP
------------------
  CARS511-Request-Builder.html            The tool. Double-click to open in any
                                          browser (Chrome/Edge/Safari). The map,
                                          PDF engine, and official 511 PDF are all
                                          embedded — works offline except for live
                                          map tiles and the data lookups.

  docs/CARS511_QUICK_REFERENCE.md         Field staff: the step-by-step how-to,
                                          what's new, and the live data services.
  docs/CARS511_DATABASE_INTEGRATION.md    IT/developers: how to wire "Submit to
                                          database" into your own system (payload
                                          schema, endpoint contract, sample code).
  docs/CARS511_project_list_TEMPLATE.csv  Starter CSV for importing your office's
                                          project numbers into the tool.
  docs/NV_NE_WORKZONE_IMPROVEMENT_BRIEFING.md   (Reference) Nevada/Nebraska WZDx
                                          briefing — not needed to use the tool.


QUICK START (the panel runs top-to-bottom in 7 steps)
-----------------------------------------------------
  Toolbar   Load from live feed / Load .json / Save project / New.

  Step 1 — Mark the work zone
     Click the road for the BEGIN point, then the END point. Or tap
     "Use my location" (in the field) to set a point from GPS.
     The segment snaps to the Iowa DOT centerline and auto-fills posted
     mileposts, county, and the nearest RCE office.
     Drag the A / B pins to fine-tune; the segment re-snaps.
     Press "Check for existing closures / duplicates" before filing —
     each existing closure is pinned on the map with its route, dates and
     distance from your segment, so you can tell whether it is really yours.
     If your segment spans two routes the tool says so: the TMC has to
     enter each route as its own 511 entry, so file one request per route.

  Step 2 — Location & details
     Route/direction fill automatically — one box, interstates plus US and
     state routes. For the DOT project #, type to search (last 3 letting
     years + programmed), "find near segment", or import your office CSV.
     Fill description, contacts, and traffic impact (the lane hint shows
     how many lanes exist that direction). The 24-hr contact remembers
     names you have used and offers them back with the phone number.

  Step 3 — Detour
     Answer "Does this closure have a detour?" — the section only opens if
     you say yes. Suggest or draw one on the map, then Save it. You can
     save more than one, named by route and direction (e.g. "I-80
     eastbound detour"); all of them go in the request.

  Step 4 — Restrictions & clearances
     "Scan NBI clearances (route + detour)" lists the lowest bridge
     clearance on the route AND the detour, plus posted restrictions.
     "Apply" fills height/width.

  Step 5 — Devices & DMS
     Scan DMS / arrow boards / Street Smart (IWZ) devices; tap to attach.
     Press the scan button again to clear the pins. Street Smart (SS) units
     mark it an Intelligent Work Zone. Selections flow into the notes.
     The DMS field is a yes/no request — the TMC composes the sign text to
     the statewide MUTCD format, so describe the work rather than wording
     the message.

  Step 6 — Schedule
     Built the way the TMC enters it in OpenTMS. Each SEGMENT is a date
     span, a daily time window, and — if it repeats — the days of the week
     it runs on. Add one segment per pattern:
       - A single day, or a single overnight: one segment, leave
         "This scheduled item will recur" unticked. No week count needed.
       - Nights Monday to Thursday: one segment, tick recurring, check
         those four days.
       - Sunday nights starting an hour later: a SECOND segment. That is
         how it goes into 511, so the request arrives already split.
     Overnight windows are detected and marked as ending the following
     morning. The project begin/end dates fill in from the segments.
     Anything the fields do not capture goes in Schedule notes.

  Step 7 — Submit
     "Check readiness" flags missing required fields, then:
       - Fill official 511 PDF  (downloads the filled Iowa form)
       - Fill 511 site (copy fields)  (opens SeamlessDocs + copy buttons)
       - Email TMC (cc RCE)  (drafts the email; text auto-copied)
       - Summary PDF / Copy
       - Submit to database  (if your IT has set up an endpoint)

     The email arrives in the same field order and wording as the
     SeamlessDocs 511 form, so the TMC reads each value where they expect
     it.


IMPORTING A PROJECT LIST (CSV)
------------------------------
  Under "DOT project #" click "＋ import CSV". Format is flexible:
    - Recommended: a header row with a project-number column
      ("Project Number", "Project #", "PIN", "Project", ...) and an
      optional description column ("Description", "Work", "Type").
    - No recognizable header? Column 1 = number, Column 2 = description.
    - A single column of numbers (no header) also works.
    - Wrap any value containing a comma in "double quotes".
  Only the project number is required. See the template CSV in docs/.
  Imported lists are saved on the device and merge with the live list.


NOTE FOR IT (database submit)
-----------------------------
  For the browser "Submit to database" button to work, host the HTML on the
  SAME origin as your endpoint (or enable CORS on the endpoint). Everything
  else (map, scans, PDF fill, email) works straight from the opened file.
  Full details + drop-in endpoint code: docs/CARS511_DATABASE_INTEGRATION.md.


DATA SOURCES
------------
  All lookups are read-only and need no login (only the optional database
  submit uses a token you configure). Map tiles come from OpenStreetMap;
  Esri's basemap is still selectable but lags on route changes. Full list of
  connected services is in docs/CARS511_QUICK_REFERENCE.md.
