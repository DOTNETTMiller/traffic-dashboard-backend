Self-Contained Work-Zone Request Builders - all 50 states and the District of Columbia. Open any file in a browser
(offline); it uses that state's own public GIS + national NBI/NHS, and exports WZDx v4.2.
NBI scan flags structures your route passes UNDER (which restrict you) vs bridges that
carry your route OVER something (n/a), with carries/crosses + inspection date. Direction
includes a "Both" option (Iowa uses a Both-directions checkbox). Named by DOT (Iowa is iadot).

SCHEDULE (changed Sept 2026, after review with the Iowa TMC)
-----------------------------------------------------------
The schedule is built the way a TMC enters it in OpenTMS. Each SEGMENT is a date span, a
daily time window, and - if it repeats - the days of the week it runs on. Add one segment
per pattern:
  - A single day, or a single overnight: one segment, leave "This scheduled item will
    recur" unticked. There is no week count to invent.
  - Nights Monday to Thursday: one segment, tick recurring, check those four days.
  - Sunday nights starting an hour later: a SECOND segment. That is how it goes into 511,
    so the request arrives already split the way it has to be entered.
Overnight windows are detected and marked as ending the following morning. The project
begin/end dates fill in from the segments. Anything the fields do not capture goes in
Schedule notes.

MAP TILES (changed Sept 2026)
----------------------------
The basemap is now Esri World Street Map. OpenStreetMap's tile usage policy does not cover
a downloadable tool run from file://, and their servers answer those requests with an
"Access blocked" tile instead of a map - so the old default simply stopped drawing. Carto
was tried and watermarks browser requests without a key. Esri is the one that works
unauthenticated from a local file.
The known cost is the one noted before: Esri's labels lag on route changes (it still showed
IA 401, decommissioned in 1991). Geometry and alignment are correct; a recently renumbered
route may carry an old label. Check the route field, not the label on the tile.

Iowa (iadot) additionally carries the CARS 511 request email in the exact field order
and wording of the SeamlessDocs form, multiple named detours, and existing-closure pins.

District of Columbia (ddot) uses Ward instead of County, carries DC's freeways, US routes
and principal arterials.
