import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import type { Restaurant } from '@/types';

interface Props {
  restaurants: Restaurant[];
  userLocation: { lat: number; lng: number } | null;
}

export default function RestaurantMap({ restaurants, userLocation }: Props) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);

  const valid = restaurants.filter(r => r.location?.lat && r.location?.lng);

  useEffect(() => {
    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    if ((window as any).L) { initMap(); return; }
    if (document.getElementById('leaflet-js')) return;

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = initMap;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (mapRef.current) updateMarkers();
  }, [valid.length, userLocation]);

  function initMap() {
    if (!containerRef.current || !(window as any).L) return;
    const L = (window as any).L;

    const center = userLocation
      ? [userLocation.lat, userLocation.lng]
      : valid.length > 0
      ? [valid[0].location.lat, valid[0].location.lng]
      : [40.7128, -74.006];

    mapRef.current = L.map(containerRef.current).setView(center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);

    updateMarkers();
  }

  function updateMarkers() {
    if (!mapRef.current || !(window as any).L) return;
    const L = (window as any).L;
    const bounds: any[] = [];

    if (userLocation) {
      L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8, fillColor: '#4285F4', color: '#fff', weight: 2, fillOpacity: 1,
      }).addTo(mapRef.current).bindPopup('You are here');
      bounds.push([userLocation.lat, userLocation.lng]);
    }

    valid.forEach(r => {
      const marker = L.marker([r.location.lat, r.location.lng]).addTo(mapRef.current);
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.address || r.name)}`;
      marker.bindPopup(`
        <div style="font-family:sans-serif;min-width:180px">
          <div style="font-weight:700;font-size:14px;margin-bottom:2px">${r.name}</div>
          ${r.rating ? `<div style="font-size:12px;color:#888;margin-bottom:4px">⭐ ${r.rating}</div>` : ''}
          <div style="font-size:12px;color:#666;margin-bottom:8px">${r.address || ''}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <a href="${mapsUrl}" target="_blank" style="font-size:12px;color:#C17A3C;font-weight:600;text-decoration:none;background:#fdf3e7;padding:4px 10px;border-radius:20px;border:1px solid #C17A3C">📍 Directions</a>
            ${r.websiteUri ? `<a href="${r.websiteUri}" target="_blank" style="font-size:12px;color:#C17A3C;font-weight:600;text-decoration:none;background:#fdf3e7;padding:4px 10px;border-radius:20px;border:1px solid #C17A3C">🌐 Website</a>` : ''}
          </div>
        </div>
      `);
      bounds.push([r.location.lat, r.location.lng]);
    });

    if (bounds.length > 1) mapRef.current.fitBounds(bounds, { padding: [40, 40] });
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
