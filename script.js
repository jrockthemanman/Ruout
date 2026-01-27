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

const allTrafficLights = [];

// ===================== TRAFFIC LIGHT =====================
class TrafficLight {
  constructor(lat, lng) {
    this.lat = lat;
    this.lng = lng;
    this.state = Math.random() > 0.5 ? "red" : "green";

    this.marker = L.circleMarker([lat, lng], {
      radius: 6,
      color: this.state,
      fillColor: this.state,
      fillOpacity: 1
    }).addTo(map);
  }

  toggle() {
    this.state = this.state === "red" ? "green" : "red";
    this.marker.setStyle({
      color: this.state,
      fillColor: this.state
    });
  }
}

// ===================== LOAD ALL TRAFFIC LIGHTS =====================
fetch("./data/raleigh_traffic_lights.geojson")
  .then(res => res.json())
  .then(data => {
    data.features.forEach(feature => {
      const [lng, lat] = feature.geometry.coordinates;
      allTrafficLights.push(new TrafficLight(lat, lng));
    });
    console.log("Traffic lights loaded:", allTrafficLights.length);
  })
  .catch(err => console.error("Failed to load traffic lights:", err));

// ===================== GLOBAL LIGHT TIMER (30s) =====================
setInterval(() => {
  allTrafficLights.forEach(light => light.toggle());
}, 30000);

// ===================== CLICK HANDLING =====================
map.on("click", e => {
  if (clickStage === 0) {
    resetAll();
    startPoint = e.latlng;
    startMarker = L.marker(startPoint)
      .addTo(map)
      .bindPopup("Start")
      .openPopup();
    clickStage = 1;
  } else {
    endPoint = e.latlng;
    endMarker = L.marker(endPoint)
      .addTo(map)
      .bindPopup("Destination")
      .openPopup();
    buildRoute();
    clickStage = 0;
  }
});

// ===================== ROUTING =====================
function buildRoute() {
  if (!startPoint || !endPoint) return;

  if (routingControl) map.removeControl(routingControl);

  routingControl = L.Routing.control({
    waypoints: [startPoint, endPoint].map(p => L.latLng(p.lat, p.lng)),
    router: L.Routing.osrmv1({
      serviceUrl: "https://router.project-osrm.org/route/v1/driving"
    }),
    lineOptions: {
      styles: [{ color: "blue", weight: 8, opacity: 0.9 }]
    },
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    showAlternatives: false
  }).addTo(map);

  routingControl.on("routesfound", e => handleRoute(e.routes[0]));
  routingControl.on("routeselected", e => handleRoute(e.route));
}

// ===================== ROUTE PROCESSING =====================
function handleRoute(route) {
  updateETA(route);
}

// ===================== ETA =====================
function updateETA(route) {
  let eta = route.summary.totalTime;

  allTrafficLights.forEach(light => {
    if (light.state === "red") eta += 30; // approximate 30s delay
  });

  document.getElementById("etaValue").innerText =
    (eta / 60).toFixed(1) + " min";
}

// ===================== RESET =====================
function resetAll() {
  if (routingControl) map.removeControl(routingControl);
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);
}
