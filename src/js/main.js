import * as maplibregl from "maplibre-gl/dist/maplibre-gl.js"
import "maplibre-gl/dist/maplibre-gl.css"
import * as pmtiles from "pmtiles";

let protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

const map = new maplibregl.Map({
    container: 'map',
    style: 'style.json', // stylesheet location
    center: [101.87513, 2.94575], // starting position [lng, lat]
    zoom: 18, // starting zoom
});

map.on("error", function() { })
