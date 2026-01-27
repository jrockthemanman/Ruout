// ===================== MAP =====================
const map = L.map("map").setView([35.7796, -78.6382], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

// ===================== STATE =====================
let clickStage = 0;
let startPoint, endPoint;
let startMarker, endMarker;
let routingControl = null;
let visibleLights = [];
const allTrafficLights = [];

// ===================== UTILS =====================
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function metersBetween(a, b) {
  return map.distance([a.lat, a.lng], [b.lat, b.lng]);
}

// ===================== TRAFFIC LIGHT =====================
class TrafficLight {
  constructor(lat, lng) {
    this.lat = lat;
    this.lng = lng;
    this.state = Math.random() > 0.5 ? "red" : "green";
    this.timer = this.state === "red" ? rand(20, 40) : rand(15, 30);

    this.marker = L.circleMarker([lat, lng], {
      radius: 6,
      color: this.state,
      fillColor: this.state,
      fillOpacity: 1
    });
  }

  show() {
    this.marker.setStyle({
      color: this.state,
      fillColor: this.state
    });
    if (!map.hasLayer(this.marker)) this.marker.addTo(map);
  }

  hide() {
    if (map.hasLayer(this.marker)) map.removeLayer(this.marker);
  }

  tick() {
    this.timer--;
    if (this.timer <= 0) {
      this.state = this.state === "red" ? "green" : "red";
      this.timer = this.state === "red" ? rand(20, 40) : rand(15, 30);
      this.marker.setStyle({
        color: this.state,
        fillColor: this.state
      });
    }
  }
}

// ===================== LOAD LIGHTS =====================
fetch("./data/raleigh_traffic_lights.geojson")
  .then(r => r.json())
  .then(data => {
    data.features.forEach(f => {
      const [lng, lat] = f.geometry.coordinates;
      allTrafficLights.push(new TrafficLight(lat, lng));
    });
    console.log("Traffic lights loaded:", allTrafficLights.length);
  })
  .catch(err => console.error("Traffic light load failed", err));

// ===================== LIGHT ENGINE =====================
setInterval(() => {
  allTrafficLights.forEach(l => l.tick());
}, 1000);

// ===================== CLICK HANDLING =====================
map.on("click", e => {
  if (clickStage === 0) {
    resetAll();
    startPoint = e.latlng;
    startMarker = L.marker(startPoint).addTo(map).bindPopup("Start").openPopup();
    clickStage = 1;
  } else {
    endPoint = e.latlng;
    endMarker = L.marker(endPoint).addTo(map).bindPopup("Destination").openPopup();
    buildRoute();
    clickStage = 0;
  }
});

// ===================== ROUTING =====================
function buildRoute() {
  if (routingControl) map.removeControl(routingControl);

  routingControl = L.Routing.control({
    waypoints: [startPoint, endPoint],
    router: L.Routing.osrmv1({
      serviceUrl: "https://router.project-osrm.org/route/v1/driving",
      alternatives: true
    }),
    lineOptions: {
      styles: [{ color: "blue", weight: 8, opacity: 0.9 }]
    },
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    showAlternatives: true
  }).addTo(map);

  routingControl.on("routesfound", e => handleRoute(e.routes[0]));
  routingControl.on("routeselected", e => handleRoute(e.route));
}

// ===================== ROUTE PROCESSING =====================
function handleRoute(route) {
  showLightsForRoute(route);
  updateETA(route);
}

// ===================== LIGHT FILTER =====================
function showLightsForRoute(route) {
  visibleLights.forEach(l => l.hide());
  visibleLights = [];

  const thresholdMeters = 40;

  allTrafficLights.forEach(light => {
    const near = route.coordinates.some(pt =>
      metersBetween(pt, light) < thresholdMeters
    );

    if (near) {
      light.show();
      visibleLights.push(light);
    }
  });
}

// ===================== ETA =====================
function updateETA(route) {
  let eta = route.summary.totalTime;

  visibleLights.forEach(light => {
    if (light.state === "red") eta += light.timer;
  });

  document.getElementById("etaValue").innerText =
    (eta / 60).toFixed(1) + " min";
}

// ===================== RESET =====================
function resetAll() {
  if (routingControl) map.removeControl(routingControl);
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);

  visibleLights.forEach(l => l.hide());
  visibleLights = [];
}
