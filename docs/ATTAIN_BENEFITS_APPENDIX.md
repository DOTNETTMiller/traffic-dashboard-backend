# ATTAIN Benefits Appendix — Quantifying the 60→30 Parking Goal (DRAFT)

*Calculation framework for the Iowa-led ATTAIN application. Formulas are
ready; {N} values need corridor-specific inputs the team can pull from FHWA
freight data and state counts. Verify all citations against current
publications before submission.*

## Baseline (citable today)

- **ATRI driver diaries** (~600 drivers, two-week journals): average **56
  minutes/day** searching for parking; ≈**$5,000/year in lost wages** per
  driver — roughly 10% of average driver pay at the time of the study.
  {VERIFY: exact report title/year — ATRI truck parking diaries; consider
  requesting updated figures from ATRI directly.}
- **Jason's Law survey** (FHWA): documents systemic parking shortage;
  {VERIFY: latest survey year and corridor-state shortage figures.}
- Search difficulty peaks starting ~4 p.m. — exactly the end-of-shift window
  the 60→30 goal targets.

## Benefit 1 — Driver productivity (the headline)

```
Annual hours saved = Trucks parking on corridor nightly {N₁}
                   × 0.5 hr saved/night × 365
Value              = hours × $ {N₂}/hr driver + truck operating cost
```
- {N₁}: derive from corridor AADTT × % long-haul × parking events/truck.
  {PLACEHOLDER: I-35 corridor AADTT from FHWA FAF/state counts.}
- {N₂}: ATRI operational cost per hour (~$70–75/hr running; use the
  *non-running* driver wage component for parked-search conservatism —
  {VERIFY current ATRI Ops Costs report}).
- Even a conservative 10,000 trucks/night → **1.8M hours/year returned to
  the supply chain**.

## Benefit 2 — Fuel and emissions

```
Gallons saved = {N₁} trucks × 0.5 hr × {N₃} gal/hr search-speed burn × 365
```
- {N₃}: low-speed circulation burn ≈ 1.5–2.5 gal/hr {VERIFY: EPA SmartWay /
  ANL idle-and-creep figures}. CO₂ at 10.19 kg/gal diesel (EPA).

## Benefit 3 — Safety: unsafe parking eliminated

- Trucks parked on ramps/shoulders are a documented fatal-crash factor
  {PLACEHOLDER: cite FHWA/NTSB examples + corridor-state crash records where
  parked-truck involvement is coded; the platform's crash analytics (live
  I-35 + FARS) can query this}.
- Benefit = crashes avoided × USDOT VSL ($13.2M, 2024 guidance — {VERIFY
  current value}). Even 1–2 avoided fatal crashes/year dominates the BCA.

## Benefit 4 — Hours-of-service compliance

- ATRI: ELD-era drivers show measurably longer search times; drivers out of
  hours with no spot face the choice between violation and unsafe parking.
- Quantify as risk reduction: {N₄} violations avoided × average violation +
  crash-risk cost {PLACEHOLDER: FMCSA CSA data for corridor states}.

## Benefit 5 — Work zone crash reduction (supporting element)

- Queue warning / connected work zone CMFs: 18–45% rear-end reduction
  {VERIFY: FHWA smart work zone CMF clearinghouse}.
- Applied to corridor work zone crash baseline {PLACEHOLDER: 3-yr average
  from state data; platform crash module can generate}.

## BCA shape (for the narrative)

With placeholder-conservative inputs, driver productivity + fuel alone
typically clears a 2:1 benefit-cost ratio on a $15M project; safety benefits
move it well above. {PLACEHOLDER: run final numbers once N₁–N₄ are fixed;
discount at 7% per OMB A-94 / current USDOT BCA guidance — verify rate.}

## Measurement plan (already operational — a differentiator)

| Metric | Instrument | Status |
|---|---|---|
| Parking search time | Prediction accuracy + ground-truth observations + fleet telematics sampling + driver survey | Prediction/calibration/accuracy stack live today |
| Facility occupancy truth | Iowa rest-area camera AI counts; TPIMS sensors | Live (Iowa) |
| Work zone data accuracy | Multi-source corroboration (TomTom, HaulHub, devices, Drivewyze) | TomTom live; partners in discussion |
| Market penetration | Observatory comparing published events vs. what nav services display | TomTom layer live; Google/Apple invited |
