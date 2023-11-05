import * as L from "./leaflet-src.esm.js";
import heatLayer from "./leaflet-heat.js";
import PathList from "./path-list.js";
// import * as leaflet from "https://unpkg.com/leaflet/dist/leaflet-src.esm.js";

const coords = L.latLng(2.94575, 101.87513);
/** @type{PathList} */
let point = null;

/**
 * Draws the heatmap from the data base.
 *
 * @param map {L.Map} The map to draw the heatmap on.
 * */
function draw_heatmap(map) {
  // https://wiki.openstreetmap.org/wiki/Zoom_levels
  // https://stackoverflow.com/questions/27545098/leaflet-calculating-meters-per-pixel-at-zoom-level
  const meters_per_pixel = 40075016.686 * Math.abs(Math.cos(map.getCenter().lat * Math.PI / 180)) / Math.pow(2, map.getZoom() + 8);
  const five_meters = 5 / meters_per_pixel;
  const hm = heatLayer([], { radius: five_meters }).addTo(map);

  // Using Fake Data for now
  /**
   * @type {L.LatLng}
   * */
  const pond = L.latLng(2.943729, 101.874668, 0.5);
  const ref = 30;
  for (let lat = 0; lat < 10; lat++) {
    for (let lang = 0; lang < 10; lang++) {
      const temp = 25 + getRandomIntInclusive(-5, 5);
      const point = L.latLng(pond.lat + lat * 0.00005, pond.lng + lang * 0.00005, temp / ref);
      hm.addLatLng(point);
    }
  }
}

function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min); // The maximum is inclusive and the minimum is inclusive
}

/**
 * Adds a new point in the path.
 *
 * @param event {} The event triggered.
 * */
function add_point(event) {
  if (point === null) {
    point = new PathList(event.latlng);
  } else {
    point.push(event.latlng);
  }
}

/**
 * Main function to execute.
 * */
function main() {
  const map = L.map("map").setView(coords, 19);
  L.tileLayer('https:tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http:www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  draw_heatmap(map);
  map.on("click", add_point);
}

// Adding event listener for when page loaded
window.addEventListener("load", main);
