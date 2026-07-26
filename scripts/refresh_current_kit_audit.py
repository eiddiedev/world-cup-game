#!/usr/bin/env python3
"""Rebuild the playable-team kit audit from the PNG files currently in public/.

This script never regenerates artwork. It only normalizes catalog metadata and
records an audit whose terminology distinguishes 16 national-team kits from
the two runtime role asset sets (outfield / goalkeeper) stored for each team.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
CATALOG_PATH = PUBLIC / "pixel" / "kit-studio" / "catalog.json"
AUDIT_PATH = PUBLIC / "pixel" / "kit-studio" / "asset-audit.json"

EXPECTED_TEAM_COUNT = 16
REQUIRED_SLOTS = {
    "home": (
        "shirt_front", "shirt_back", "sleeve_left", "sleeve_right",
        "shorts", "shorts_leg", "socks", "shoes",
    ),
    "goalkeeper": (
        "shirt_front", "shirt_back", "sleeve_left", "sleeve_right",
        "shorts", "shorts_leg", "socks", "shoes", "hand_left", "hand_right",
    ),
}
RUNTIME_SIZES = {
    "shirt_front": (56, 52),
    "shirt_back": (56, 52),
    "sleeve_left": (14, 22),
    "sleeve_right": (23, 18),
    "shorts": (55, 8),
    "shorts_leg": (12, 16),
    "socks": (11, 14),
    "shoes": (16, 6),
    "hand_left": (26, 24),
    "hand_right": (26, 25),
}


def json_text(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def inspect_png(asset_path: str, slot_id: str, required: bool) -> dict:
    path = PUBLIC / asset_path.lstrip("/")
    if not path.is_file():
        raise SystemExit(f"Missing kit asset: {asset_path}")

    with Image.open(path) as source:
        image = source.convert("RGBA")
        pixels = list(image.getdata())
        opaque_colors = len({pixel for pixel in pixels if pixel[3]})
        semi_transparent = sum(1 for pixel in pixels if 0 < pixel[3] < 255)
        non_empty = image.getbbox() is not None
        actual_size = image.size

    expected_size = RUNTIME_SIZES.get(slot_id) if required else actual_size
    passed = non_empty and semi_transparent == 0 and actual_size == expected_size
    return {
        "path": asset_path,
        "slotId": slot_id,
        "width": actual_size[0],
        "height": actual_size[1],
        "opaqueColors": opaque_colors,
        "semiTransparentPixels": semi_transparent,
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "requiredAtRuntime": required,
        "passed": passed,
    }


def build_current_state() -> tuple[dict, dict]:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    entries = catalog.get("kits", [])
    team_ids = sorted({entry.get("teamId") for entry in entries})
    if len(team_ids) != EXPECTED_TEAM_COUNT:
        raise SystemExit(
            f"Expected {EXPECTED_TEAM_COUNT} playable teams, found {len(team_ids)}"
        )

    normalized_entries = []
    for team_id in team_ids:
        team_entries = [entry for entry in entries if entry.get("teamId") == team_id]
        if sorted(entry.get("kitType") for entry in team_entries) != ["goalkeeper", "home"]:
            raise SystemExit(f"{team_id}: expected home and goalkeeper asset sets")

    for entry in entries:
        kit_type = entry.get("kitType")
        if kit_type not in REQUIRED_SLOTS:
            raise SystemExit(f"Unsupported kit type: {kit_type}")
        required_slots = set(REQUIRED_SLOTS[kit_type])
        source_files = {item.get("slotId"): item for item in entry.get("files", [])}
        missing_slots = sorted(required_slots - set(source_files))
        if missing_slots:
            raise SystemExit(
                f"{entry.get('teamId')}/{kit_type}: missing {', '.join(missing_slots)}"
            )

        files = [
            inspect_png(item["path"], slot_id, slot_id in required_slots)
            for slot_id, item in source_files.items()
        ]
        required_files = [item for item in files if item["requiredAtRuntime"]]
        passed = all(item["passed"] for item in required_files)
        reference_path = entry.get("referencePath", "")
        normalized_entries.append({
            **entry,
            "source": {
                "kind": "local-authored-master",
                "path": reference_path,
            },
            "status": "gold-pass" if passed else "review-required",
            "files": files,
        })

    normalized_catalog = {
        "schemaVersion": "happyseed-kit-catalog-v2",
        "playableTeamCount": len(team_ids),
        "runtimeRoleAssetSetsPerTeam": 2,
        "kits": normalized_entries,
    }
    outfield_sets = [entry for entry in normalized_entries if entry["kitType"] == "home"]
    goalkeeper_sets = [entry for entry in normalized_entries if entry["kitType"] == "goalkeeper"]
    passed_sets = [entry for entry in normalized_entries if entry["status"] == "gold-pass"]
    audit = {
        "schemaVersion": "happyseed-kit-asset-audit-v2",
        "partSetId": normalized_entries[0].get("partSetId") if normalized_entries else "",
        "playableTeamCount": len(team_ids),
        "nationalTeamKitCount": len(team_ids),
        "runtimeRoleAssetSetsPerTeam": 2,
        "outfieldAssetSetCount": len(outfield_sets),
        "goalkeeperAssetSetCount": len(goalkeeper_sets),
        "runtimeRoleAssetSetCount": len(normalized_entries),
        "passedTeamCount": sum(
            all(entry["status"] == "gold-pass" for entry in normalized_entries if entry["teamId"] == team_id)
            for team_id in team_ids
        ),
        "passedRuntimeRoleAssetSetCount": len(passed_sets),
        "fileCount": sum(len(entry["files"]) for entry in normalized_entries),
        "rules": {
            "artworkSource": "current-authored-assets",
            "artworkRegenerated": False,
            "fixedRuntimeCanvas": True,
            "semiTransparentEdgesAllowed": False,
            "runtimeStickerBorder": False,
        },
        "assetSets": normalized_entries,
    }
    return normalized_catalog, audit


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="write normalized metadata")
    args = parser.parse_args()
    catalog, audit = build_current_state()
    expected_catalog = json_text(catalog)
    expected_audit = json_text(audit)

    if args.write:
        CATALOG_PATH.write_text(expected_catalog, encoding="utf-8")
        AUDIT_PATH.write_text(expected_audit, encoding="utf-8")
        print(f"Updated {CATALOG_PATH.relative_to(ROOT)}")
        print(f"Updated {AUDIT_PATH.relative_to(ROOT)}")
    else:
        if CATALOG_PATH.read_text(encoding="utf-8") != expected_catalog:
            raise SystemExit("Kit catalog metadata is stale; run with --write")
        if AUDIT_PATH.read_text(encoding="utf-8") != expected_audit:
            raise SystemExit("Kit asset audit is stale; run with --write")

    print(
        f"Kit audit passed: {audit['playableTeamCount']} playable teams / "
        f"{audit['runtimeRoleAssetSetCount']} runtime role asset sets / "
        f"{audit['fileCount']} files"
    )


if __name__ == "__main__":
    main()
