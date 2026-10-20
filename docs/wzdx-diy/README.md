# WZDx DIY Kits — Nebraska & Nevada

Self-contained packages for Nebraska DOT and Nevada DOT to stand up official WZDx v4.2
work zone feeds **without the Corridor Communicator** (with NODE/iNODE as an optional
hosting layer), and register them with FHWA/USDOT.

**Each state gets exactly two files** — one set of directions and one Python script:

| State | Complete directions | Script (stdlib-only, live-tested) |
|---|---|---|
| Nebraska | `NEBRASKA_WZDX_DIY_GUIDE.md` | `nebraska_wzdx_generator.py` |
| Nevada | `NEVADA_WZDX_DIY_GUIDE.md` | `nevada_wzdx_generator.py` |

Ready-to-forward zips of each pair are in `bundles/`.

**Also emitted (both states): a CIFS feed for Google/Waze.** Each generator now writes a
Common Incident Feed Specification file (`wzdx_<state>.cifs.xml`) automatically alongside
the WZDx GeoJSON, still standard-library only (add `--no-cifs` to skip). Publish it the same
way as the GeoJSON to feed Google and Waze directly.

**Optional shared tool: `wzdx_geometry_fix.py`.** Corrects two-point ("crow-flies") work zone
geometry into road-following polylines using your own centerline first, then FHWA ARNOLD,
then OSM routing, and can also emit CIFS. It is the same tool shared with Caltrans. It needs
the `shapely` and `pyproj` packages, so it is an optional post-step and is *not* required to
run the no-install generators above. Most useful for Nebraska (two-point source geometry);
Nevada's encoded polylines already follow the road.

Designed for the least-technical owner:

- The guide is written for a **program lead with no technical skills**, with the three
  technical parts (install Python, schedule the script, host one file) packaged as a
  half-day ticket for any IT person.
- The script needs **no installation beyond Python itself** — standard library only, no
  pip, no venv. Credentials go in a plain `credentials.txt`; errors come out in plain
  English; every run self-checks against the WZDx v4.2 spec and fails closed.
- Each run also writes a **data gap report** (`wzdx_<state>_gaps.md`) listing what the
  source data needs supplemented or corrected at the 511/CARS entry level, and each
  guide embeds the state-tailored **work-zone intake form** (Nebraska: parser-matched
  description phrases for CARS; Nevada: structured NV Roads fields) plus the live gap
  baseline as the starting scorecard.

**Registration path (both states):** stable public HTTPS URL → email `avdx@dot.gov` →
listed in the Work Zone Data Feed Registry
(https://data.transportation.gov/Roadways-and-Bridges/Work-Zone-Data-Feed-Registry/69qe-yiui).
