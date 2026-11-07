// A small live map for the school bus (OpenStreetMap tiles through Leaflet).
// Draws the bus (a dot), the path it has driven, and optional home points.
// Uses circle markers only, so no marker images are needed.

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BRAND = "#801524";

export default function BusMap({ bus, path = [], homes = [], height = 260 }) {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!box.current || map.current) return;
    map.current = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([5.2, -3.74], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap"
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const pts = [];
    homes.forEach((h) => {
      if (h.lat == null || h.lng == null) return;
      L.circleMarker([h.lat, h.lng], { radius: 6, color: "#3B6E8F", weight: 2, fillColor: h.done ? "#B9D3E3" : "#FFFFFF", fillOpacity: 1 })
        .bindTooltip(h.label || "", { direction: "top" }).addTo(layer.current);
      pts.push([h.lat, h.lng]);
    });
    if (path.length > 1) {
      L.polyline(path, { color: BRAND, weight: 4, opacity: 0.7 }).addTo(layer.current);
      pts.push(...path);
    }
    if (bus?.lat != null && bus?.lng != null) {
      L.circleMarker([bus.lat, bus.lng], { radius: 11, color: "#FFFFFF", weight: 3, fillColor: BRAND, fillOpacity: 1 })
        .bindTooltip("Bus", { direction: "top", permanent: false }).addTo(layer.current);
      pts.push([bus.lat, bus.lng]);
    }
    if (!pts.length) return;
    if (!fitted.current) {
      if (pts.length === 1) map.current.setView(pts[0], 15);
      else map.current.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 16 });
      fitted.current = true;
    } else if (bus?.lat != null) {
      // Keep the bus in view as it moves, without jumping the zoom around.
      if (!map.current.getBounds().pad(-0.1).contains([bus.lat, bus.lng])) map.current.panTo([bus.lat, bus.lng]);
    }
  }, [bus?.lat, bus?.lng, path.length, homes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} style={{ height, width: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid #EFE6E0", zIndex: 0, position: "relative" }} />;
}
