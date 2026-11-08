// A small live map for the school bus (OpenStreetMap tiles through Leaflet).
// Draws the BIS school bus (with the school logo), the path it has driven, and optional home points.
// The bus glides smoothly from one position to the next instead of jumping.

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BRAND = "#801524";

const BUS_ICON = L.divIcon({
  className: "bis-bus-marker",
  iconSize: [64, 58],
  iconAnchor: [32, 29],
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
      <svg width="58" height="38" viewBox="0 0 58 38" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="3" width="54" height="26" rx="6" fill="#F6C343" stroke="#7A5A00" stroke-width="1.5"/>
        <rect x="6" y="7" width="9" height="8" rx="1.5" fill="#DDEFF8"/>
        <rect x="43" y="7" width="9" height="8" rx="1.5" fill="#DDEFF8"/>
        <circle cx="29" cy="15" r="10.5" fill="#FFFFFF" stroke="${BRAND}" stroke-width="1.5"/>
        <image href="/logo.png" x="20" y="6" width="18" height="18" preserveAspectRatio="xMidYMid meet"/>
        <rect x="2" y="24" width="54" height="3" fill="${BRAND}"/>
        <circle cx="14" cy="31" r="5" fill="#2B2B2B" stroke="#FFFFFF" stroke-width="1.5"/>
        <circle cx="44" cy="31" r="5" fill="#2B2B2B" stroke="#FFFFFF" stroke-width="1.5"/>
      </svg>
      <span style="margin-top:1px;padding:0 6px;border-radius:8px;background:${BRAND};color:#FFFFFF;font:700 11px/16px system-ui,sans-serif;letter-spacing:.5px">BIS</span>
    </div>`
});

export default function BusMap({ bus, path = [], homes = [], height = 260 }) {
  const box = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const fitted = useRef(false);
  const busMarker = useRef(null);
  const anim = useRef(null);

  useEffect(() => {
    if (!box.current || map.current) return;
    map.current = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([5.2, -3.74], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap"
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { cancelAnimationFrame(anim.current); map.current?.remove(); map.current = null; busMarker.current = null; };
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
      const to = L.latLng(bus.lat, bus.lng);
      if (!busMarker.current) {
        busMarker.current = L.marker(to, { icon: BUS_ICON, zIndexOffset: 1000, keyboard: false })
          .bindTooltip("BrightSteps school bus", { direction: "top", offset: [0, -24] }).addTo(map.current);
      } else {
        // Glide from the current spot to the new one over about 2 seconds
        cancelAnimationFrame(anim.current);
        const from = busMarker.current.getLatLng();
        const t0 = performance.now();
        const step = (now) => {
          const k = Math.min(1, (now - t0) / 2000);
          busMarker.current?.setLatLng([from.lat + (to.lat - from.lat) * k, from.lng + (to.lng - from.lng) * k]);
          if (k < 1) anim.current = requestAnimationFrame(step);
        };
        anim.current = requestAnimationFrame(step);
      }
      pts.push([bus.lat, bus.lng]);
    } else if (busMarker.current) {
      busMarker.current.remove();
      busMarker.current = null;
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
