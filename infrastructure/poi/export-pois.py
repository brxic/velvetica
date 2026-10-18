"""Offline extraction only. Never queries OSM/Overpass or connects to a database."""
import argparse
import json
from datetime import datetime, timezone
import osmium


def category(tags):
    if tags.get("access") in ("no", "private"):
        return None
    water_feature = tags.get("amenity") == "fountain" or tags.get("man_made") == "water_tap" or tags.get("natural") == "spring"
    if tags.get("drinking_water") != "no" and (tags.get("amenity") == "drinking_water" or (water_feature and tags.get("drinking_water") == "yes")):
        return "water"
    if tags.get("amenity") in ("cafe", "restaurant", "fast_food"):
        return "food"
    if tags.get("shop") in ("supermarket", "convenience", "bakery", "greengrocer", "deli", "farm", "butcher"):
        return "shop"
    return None


class Exporter(osmium.SimpleHandler):
    def __init__(self, output):
        super().__init__()
        self.output = output
        self.factory = osmium.geom.GeoJSONFactory()
        self.count = 0
        self.skipped = 0

    def emit(self, obj, osm_type, osm_id, geometry):
        tags = {tag.k: tag.v for tag in obj.tags}
        if not category(tags):
            return
        kept = {key: tags[key][:500] for key in ("name", "amenity", "shop", "natural", "man_made", "drinking_water", "access", "opening_hours") if key in tags}
        if "name" in kept:
            kept["name"] = kept["name"][:200]
        timestamp = obj.timestamp.isoformat().replace("+00:00", "Z") if obj.timestamp else None
        self.output.write(json.dumps({"osmType": osm_type, "osmId": str(osm_id), "geometry": geometry, "properties": kept, "sourceUpdatedAt": timestamp}, ensure_ascii=False) + "\n")
        self.count += 1

    def node(self, node):
        if category(node.tags) and node.location.valid():
            self.emit(node, "node", node.id, json.loads(self.factory.create_point(node)))

    def area(self, area):
        if not category(area.tags):
            return
        try:
            geometry = json.loads(self.factory.create_multipolygon(area))
            self.emit(area, "way" if area.from_way() else "relation", area.orig_id(), geometry)
        except RuntimeError:
            self.skipped += 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="Local Swiss OSM PBF")
    parser.add_argument("output", help="New JSONL file (must not already exist)")
    args = parser.parse_args()
    with osmium.io.Reader(args.input) as reader:
        stamp = reader.header().get("osmosis_replication_timestamp") or reader.header().get("timestamp")
    if not stamp:
        raise ValueError("Extract has no snapshot timestamp; do not substitute file modification/import time")
    datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    with open(args.output, "x", encoding="utf-8") as output:
        output.write(json.dumps({"type": "metadata", "version": 1, "regionId": "ch", "snapshotAt": stamp, "exportedAt": datetime.now(timezone.utc).isoformat()}) + "\n")
        exporter = Exporter(output)
        exporter.apply_file(args.input, locations=True, idx="flex_mem")
        output.write(json.dumps({"type": "complete", "count": exporter.count}) + "\n")
    print(json.dumps({"exported": exporter.count, "invalidAreasSkipped": exporter.skipped, "snapshotAt": stamp}))


if __name__ == "__main__":
    main()
