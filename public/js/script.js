const socket = io();
const map = L.map('map').setView([0, 0], 2);

// Base layers: OpenStreetMap street and MapTiler satellite
const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map © OpenStreetMap contributors'
});

const satelliteLayer = L.tileLayer('https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=9tPWI8c3n9o6GNLCVzeY', {
  attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a> contributors',
  tileSize: 512,
  zoomOffset: -1
});

const baseMaps = {
  "Street View": streetLayer,
  "Satellite View": satelliteLayer
};

// Add satellite as default visible
satelliteLayer.addTo(map);

// Add layer control on top-left corner to avoid overlap with custom controls
L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);

// Markers and tracking data
const markers = {};
const paths = {};
const userColors = ['red', 'blue', 'green', 'orange', 'yellow', 'violet', 'grey'];
const assignedColors = {};
let sharedURL = "";

function getColorForId(id) {
  if (!assignedColors[id]) {
    const available = userColors.filter(c => !Object.values(assignedColors).includes(c));
    assignedColors[id] = available[Math.floor(Math.random() * available.length)] || 'red';
  }
  return assignedColors[id];
}

function createCustomIcon(color = 'red') {
  return L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    shadowSize: [41, 41]
  });
}

// Geolocation tracking
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    ({ coords }) => {
      const { latitude, longitude } = coords;
      socket.emit('send-location', { latitude, longitude });
      updateSelfMarker(latitude, longitude);
    },
    (err) => console.error('Geolocation error:', err),
    { enableHighAccuracy: true }
  );
} else {
  alert("Geolocation not supported.");
}

function updateSelfMarker(lat, lng) {
  if (markers['self']) {
    markers['self'].setLatLng([lat, lng]);
    addToPath('self', [lat, lng]);
  } else {
    const icon = createCustomIcon('grey');
    markers['self'] = L.marker([lat, lng], { icon }).addTo(map).bindPopup("You").openPopup();
    paths['self'] = L.polyline([[lat, lng]], { color: 'grey' }).addTo(map);
    map.setView([lat, lng], 16);
  }
  updateBounds();
}

// Receive other users' locations
socket.on('receive-location', ({ id, username, latitude, longitude }) => {
  if (id === socket.id) return;

  const color = getColorForId(id);
  const name = username || `User: ${id}`;

  if (markers[id]) {
    markers[id].setLatLng([latitude, longitude]);
    addToPath(id, [latitude, longitude]);
  } else {
    const icon = createCustomIcon(color);
    markers[id] = L.marker([latitude, longitude], { icon }).addTo(map).bindPopup(name);
    paths[id] = L.polyline([[latitude, longitude]], { color }).addTo(map);
  }

  updateBounds();
});

// Remove marker and path on user disconnect
socket.on('user-disconnected', (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    map.removeLayer(paths[id]);
    delete markers[id];
    delete paths[id];
    updateBounds();
  }
});

// Add coordinates to path polyline
function addToPath(id, latlng) {
  if (paths[id]) {
    paths[id].addLatLng(latlng);
  }
}

// Adjust map to fit all markers with some padding
function updateBounds() {
  const allMarkers = Object.values(markers);
  if (allMarkers.length === 0) return;

  const group = L.featureGroup(allMarkers);
  map.fitBounds(group.getBounds().pad(0.3));
}

// Share link generation
function copyShareLink() {
  const username = prompt("Enter a name to include in the link (optional):");
  const id = socket.id;
  const base = `${window.location.origin}/track/${id}`;
  const url = username ? `${base}?name=${encodeURIComponent(username)}` : base;
  sharedURL = url;
  navigator.clipboard.writeText(url).then(() => {
    alert("Link copied to clipboard: " + url);
    generateQRCode(url);
  });
}

// Generate QR code in the #qrcode div
function generateQRCode(url) {
  const qrcode = document.getElementById("qrcode");
  qrcode.innerHTML = "";
  new QRCode(qrcode, {
    text: url,
    width: 150,
    height: 150,
    colorDark: "#000",
    colorLight: "#fff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

// Social share buttons
function shareTo(platform) {
  if (!sharedURL) {
    alert("Please generate your link first.");
    return;
  }

  const encodedURL = encodeURIComponent(sharedURL);
  let shareLink = "";

  switch (platform) {
    case 'whatsapp':
      shareLink = `https://wa.me/?text=${encodedURL}`;
      break;
    case 'telegram':
      shareLink = `https://t.me/share/url?url=${encodedURL}`;
      break;
    default:
      alert("Platform not supported yet.");
      return;
  }

  window.open(shareLink, '_blank');
}

// Copy link button function
function copyLink() {
  if (!sharedURL) {
    alert("No link generated yet.");
    return;
  }
  navigator.clipboard.writeText(sharedURL)
    .then(() => alert("Link copied to clipboard."))
    .catch(() => alert("Failed to copy."));
}
