import { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Restaurant } from '@/types';

interface Props {
  restaurants: Restaurant[];
  userLocation: { lat: number; lng: number } | null;
}

export default function RestaurantMap({ restaurants, userLocation }: Props) {
  const valid = restaurants.filter(r => r.location?.lat && r.location?.lng);

  const center = userLocation
    ? [userLocation.lat, userLocation.lng]
    : valid.length > 0
    ? [valid[0].location.lat, valid[0].location.lng]
    : [40.7128, -74.006];

  const markers = valid.map(r => ({
    lat: r.location.lat,
    lng: r.location.lng,
    name: r.name,
    address: r.address || '',
    mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.address || r.name)}`,
  }));

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .popup-name { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
    .popup-addr { font-size: 12px; color: #666; margin-bottom: 8px; }
    .popup-link { font-size: 13px; color: #C17A3C; font-weight: 600; text-decoration: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map').setView(${JSON.stringify(center)}, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const markers = ${JSON.stringify(markers)};
    const bounds = [];

    ${userLocation ? `
    L.circleMarker([${userLocation.lat}, ${userLocation.lng}], {
      radius: 8, fillColor: '#4285F4', color: '#fff', weight: 2, fillOpacity: 1
    }).addTo(map).bindPopup('You are here');
    bounds.push([${userLocation.lat}, ${userLocation.lng}]);
    ` : ''}

    markers.forEach(m => {
      const marker = L.marker([m.lat, m.lng]).addTo(map);
      marker.bindPopup(
        '<div class="popup-name">' + m.name + '</div>' +
        '<div class="popup-addr">' + m.address + '</div>' +
        '<a class="popup-link" href="' + m.mapsUrl + '" target="_blank">📍 Get Directions</a>'
      );
      bounds.push([m.lat, m.lng]);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  </script>
</body>
</html>`;

  return (
    <WebView
      source={{ html }}
      style={StyleSheet.absoluteFill}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
    />
  );
}
