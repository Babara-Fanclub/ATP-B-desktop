/** Module for setting up the interactive slippy map.
 * */
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as pmtiles from "pmtiles";

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

export const map = new maplibregl.Map({
  container: "map",
  style: "style.json", // stylesheet location
  center: [101.87513, 2.94575], // starting position [lng, lat]
  zoom: 18, // starting zoom
});

map.on("error", function () {});

export default map;
