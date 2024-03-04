/** Module for setting up the interactive slippy map.
 * */
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as pmtiles from "pmtiles";
import * as logging from "tauri-plugin-log-api";

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol("pmtiles", protocol.tile);

export const map = new maplibregl.Map({
    container: "map",
    style: "style.json", // stylesheet location
    center: [101.87513, 2.94575], // starting position [lng, lat]
    zoom: 18, // starting zoom
    maxZoom: 21,
    minZoom: 10,
});

map.on("error", function(e) {
    logging.error(String(e.error.message));
});

/** Fit to the bounds of a coordinates array.
 *
 * @see https://maplibre.org/maplibre-gl-js/docs/examples/zoomto-linestring/
 *
 * @param {maplibregl.Coordinates[]} coordinates Geographic coordinates of the boundary.
 * @param {Number?} padding The padding to the boundary.
 */
export function fit_bounds(coordinates, padding = 20) {
    logging.debug("In fit_bounds");
    logging.debug("Coordinates: " + "[" + coordinates) + "]";
    logging.debug("Padding: " + padding);
    // Pass the first coordinates in the LineString to `lngLatBounds` &
    // wrap each coordinate pair in `extend` to include them in the bounds
    // result. A variation of this technique could be applied to zooming
    // to the bounds of multiple Points or Polygon geomteries - it just
    // requires wrapping all the coordinates with the extend method.
    const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
    }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));
    logging.debug("New Bounds: " + bounds);

    map.fitBounds(bounds, {
        padding: padding
    })
}

export default map;
