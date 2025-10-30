#!/usr/bin/env python3
"""Build hourly truck parking availability predictions for Iowa without pandas.

This script streams the historical truck parking export (~48M rows) and
aggregates availability statistics by site and hour-of-week. The output JSON is
consumed by the backend to serve simple hourly predictions per site and for the
entire state.
"""

from __future__ import annotations

import csv
import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
RAW_PATH = BASE_DIR / "TruckStopsExport" / "TruckParkingExport_IA.csv"
OUTPUT_PATH = BASE_DIR / "data" / "truck_parking_predictions.json"


def parse_timestamp(value: str) -> datetime | None:
    """Parse the timestamp from the export in a robust manner."""
    if not value:
        return None
    try:
        # The export uses seven decimal places for seconds. datetime.fromisoformat
        # gracefully handles that and strips trailing zeros.
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def hour_of_week(dt: datetime) -> int:
    return dt.weekday() * 24 + dt.hour


def build_predictions() -> None:
    if not RAW_PATH.exists():
        raise FileNotFoundError(f"Historical data not found at {RAW_PATH}")

    aggregates: dict[tuple[str, int], list[float]] = defaultdict(
        lambda: [0.0, 0.0, 0.0, 0.0, 0.0]
    )

    total_rows = 0
    with RAW_PATH.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            total_rows += 1

            site_id = row["SiteId"]
            if not site_id:
                continue

            dt = parse_timestamp(row.get("TimeStamp", ""))
            if dt is None:
                continue

            try:
                is_open = int(row.get("IsOpen", "0"))
                capacity = float(row.get("Capacity", "0"))
                true_available = float(row.get("TrueAvailable", "0"))
            except ValueError:
                continue

            if is_open != 1 or capacity <= 0:
                continue

            if true_available < 0:
                true_available = 0.0
            if true_available > capacity:
                true_available = capacity

            hov = hour_of_week(dt)
            ratio = true_available / capacity

            stats = aggregates[(site_id, hov)]
            stats[0] += 1.0  # observations
            stats[1] += ratio
            stats[2] += ratio * ratio
            stats[3] += true_available
            stats[4] += capacity

    if not aggregates:
        raise RuntimeError("No data aggregated; check the input file.")

    site_records: dict[str, dict[str, object]] = {}
    statewide_accumulator: list[dict[str, float]] = []
    statewide_map: dict[int, dict[str, float]] = {}

    for (site_id, hov), stats in aggregates.items():
        observations, sum_ratio, sum_ratio_sq, sum_available, sum_capacity = stats
        if observations == 0:
            continue

        mean_ratio = sum_ratio / observations
        mean_ratio_sq = sum_ratio_sq / observations
        variance_ratio = max(mean_ratio_sq - mean_ratio**2, 0.0)
        std_ratio = math.sqrt(variance_ratio)
        mean_available = sum_available / observations
        mean_capacity = sum_capacity / observations
        predicted_available = mean_ratio * mean_capacity

        hourly_record = {
            "hour_of_week": hov,
            "observations": int(observations),
            "mean_available": round(mean_available, 3),
            "mean_capacity": round(mean_capacity, 3),
            "mean_ratio": round(mean_ratio, 5),
            "std_ratio": round(std_ratio, 5),
            "predicted_available": round(predicted_available, 3),
        }

        site_entry = site_records.setdefault(site_id, {"hourly": []})
        site_entry["hourly"].append(hourly_record)

        statewide_bucket = statewide_map.setdefault(
            hov,
            {
                "hour_of_week": hov,
                "total_capacity": 0.0,
                "predicted_available": 0.0,
            },
        )
        statewide_bucket["total_capacity"] += mean_capacity
        statewide_bucket["predicted_available"] += predicted_available

    for entry in site_records.values():
        entry["hourly"].sort(key=lambda row: row["hour_of_week"])

    statewide_hourly = []
    for hov in sorted(statewide_map.keys()):
        bucket = statewide_map[hov]
        predicted_available = bucket["predicted_available"]
        total_capacity = bucket["total_capacity"]
        statewide_hourly.append(
            {
                "hour_of_week": hov,
                "total_capacity": round(total_capacity, 3),
                "predicted_available": round(predicted_available, 3),
                "predicted_occupancy": round(total_capacity - predicted_available, 3),
            }
        )

    artifact = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_file": str(RAW_PATH),
        "metadata": {
            "site_count": len(site_records),
            "total_observations": int(sum(v["observations"] for site in site_records.values() for v in site["hourly"])),
            "processed_rows": total_rows,
        },
        "sites": site_records,
        "statewide_hourly": statewide_hourly,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as fp:
        json.dump(artifact, fp, indent=2)

    print(
        f"Generated predictions for {len(site_records)} sites, wrote {OUTPUT_PATH.relative_to(BASE_DIR)}"
    )


if __name__ == "__main__":
    build_predictions()
