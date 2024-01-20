import PathList from "./path-list.js";
import * as maplibregl from "maplibre-gl/dist/maplibre-gl.js"

// 101.87513, 2.94575
/** @type{PathList} */
let point = null;

/**
 * Draws the heatmap from the data base.
 *
 * @param map {maplibregl.Map} The map to draw the heatmap on.
 * */
function draw_heatmap(map) {
  // https://wiki.openstreetmap.org/wiki/Zoom_levels
  // https://stackoverflow.com/questions/27545098/leaflet-calculating-meters-per-pixel-at-zoom-level
  const meters_per_pixel = 40075016.686 * Math.abs(Math.cos(map.getCenter().lat * Math.PI / 180)) / Math.pow(2, map.getZoom() + 8);
  const five_meters = 5 / meters_per_pixel;
  const hm = map.addLayer({
    id: "hm",
    type: "heatmap"
  });

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

const map = new maplibregl.Map({
  container: 'map',
  style: 'style.json', // stylesheet location
  center: [101.87513, 2.94575], // starting position [lng, lat]
  zoom: 10 // starting zoom
});

map.on("error", function () {})
