const weatherApiKey = 'c187d98affc672274800884de4804ba0';

let map, radarLayer;
const carMarkers = new Map();
const carTrails = new Map();
const teamColors = {
  "Red Bull Racing": "#1E41FF",
  "Mercedes": "#00D2BE",
  "Ferrari": "#DC0000",
  "McLaren": "#FF8700",
  "Aston Martin": "#006F62",
  "Alpine F1 Team": "#0090FF",
  "Williams": "#005AFF",
  "AlphaTauri": "#2B4562",
  "Alfa Romeo": "#900000",
  "Haas F1 Team": "#B6BABD"
};

async function fetchLeaderboard() {
  try {
    const res = await fetch('https://api.openf1.org/v1/position?session_key=latest');
    const data = await res.json();

    const uniqueDrivers = new Map();
    data.reverse().forEach(pos => {
      if (!uniqueDrivers.has(pos.driver_number)) {
        uniqueDrivers.set(pos.driver_number, pos);
      }
    });

    const sorted = Array.from(uniqueDrivers.values()).sort((a, b) => a.position - b.position);
    const html = `
      <table>
        <thead><tr><th>Pos</th><th>Driver</th><th>Number</th><th>Team</th><th>Nationality</th></tr></thead>
        <tbody>
          ${sorted.map(d => `
            <tr>
              <td>${d.position}</td>
              <td>${d.full_name || 'Unknown'}</td>
              <td>${d.driver_number}</td>
              <td>${d.team_name || 'Unknown'}</td>
              <td>${d.country_code || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    document.getElementById('leaderboard-table').innerHTML = html;
  } catch (err) {
    console.error(err);
    document.getElementById('leaderboard-table').textContent = 'Failed to load leaderboard.';
  }
}

async function fetchLapData() {
  try {
    const res = await fetch('https://api.openf1.org/v1/lap_count?session_key=latest');
    const data = await res.json();

    const uniqueDrivers = new Map();
    data.reverse().forEach(lap => {
      if (!uniqueDrivers.has(lap.driver_number)) {
        uniqueDrivers.set(lap.driver_number, lap);
      }
    });

    const html = `
      <table>
        <thead><tr><th>Driver #</th><th>Laps</th><th>Last Lap Time</th><th>Current Lap</th></tr></thead>
        <tbody>
          ${Array.from(uniqueDrivers.values()).map(l => `
            <tr>
              <td>${l.driver_number}</td>
              <td>${l.lap_number}</td>
              <td>${l.lap_time ? l.lap_time.toFixed(3) + 's' : 'N/A'}</td>
              <td>${l.current_lap || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    document.getElementById('lap-table').innerHTML = html;
  } catch (err) {
    console.error(err);
    document.getElementById('lap-table').textContent = 'Failed to load lap data.';
  }
}

async function getTrackLocation() {
  return { lat: 43.7347, lon: 7.4206 }; // Monte Carlo
}

async function initMap() {
  const { lat, lon } = await getTrackLocation();
  map = L.map('map').setView([lat, lon], 10);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  radarLayer = L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${weatherApiKey}`, {
    maxZoom: 19,
    opacity: 0.6
  }).addTo(map);

  // Overlay a circuit layout (example: dummy polyline)
  const circuitCoords = [
    [43.7347, 7.4206], [43.7352, 7.423], [43.736, 7.4215], [43.737, 7.419], [43.736, 7.417], [43.735, 7.416]
  ];
  L.polyline(circuitCoords, { color: 'white', weight: 3, dashArray: '5,10' }).addTo(map);
}

function refreshRadarLayer() {
  if (radarLayer) {
    map.removeLayer(radarLayer);
  }
  radarLayer = L.tileLayer(`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${weatherApiKey}&_=${Date.now()}`, {
    maxZoom: 19,
    opacity: 0.6
  }).addTo(map);
}

async function updateCarPositions() {
  try {
    const res = await fetch('https://api.openf1.org/v1/location?session_key=latest');
    const data = await res.json();

    const latestPositions = new Map();
    data.reverse().forEach(pos => {
      if (!latestPositions.has(pos.driver_number)) {
        latestPositions.set(pos.driver_number, pos);
      }
    });

    latestPositions.forEach((pos, driverNum) => {
      const lat = pos.latitude;
      const lon = pos.longitude;

      if (!lat || !lon) return;

      const color = teamColors[pos.team_name] || 'gray';
      const popupText = `<strong>#${driverNum}</strong><br>${pos.full_name || ''}<br><img src="${pos.headshot_url || ''}" width="80"/>`;

      if (carMarkers.has(driverNum)) {
        carMarkers.get(driverNum).setLatLng([lat, lon]).setPopupContent(popupText);
      } else {
        const marker = L.circleMarker([lat, lon], {
          radius: 6,
          color,
          fillColor: color,
          fillOpacity: 0.9
        }).addTo(map).bindPopup(popupText);
        carMarkers.set(driverNum, marker);
      }

      // Car trails
      if (!carTrails.has(driverNum)) {
        carTrails.set(driverNum, []);
      }
      const trail = carTrails.get(driverNum);
      trail.push([lat, lon]);
      if (trail.length > 10) trail.shift(); // keep last 10 points

      // Remove existing trail
      if (marker.trailLine) {
        map.removeLayer(marker.trailLine);
      }
      const trailLine = L.polyline(trail, { color, weight: 2, opacity: 0.5 }).addTo(map);
      marker.trailLine = trailLine;
    });

  } catch (err) {
    console.error('Error updating car positions:', err);
  }
}

function autoUpdate() {
  fetchLeaderboard();
  fetchLapData();
  refreshRadarLayer();
  updateCarPositions();
}

fetchLeaderboard();
fetchLapData();
initMap();
updateCarPositions();

setInterval(autoUpdate, 30000);
