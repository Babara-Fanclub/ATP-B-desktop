/** Functions and initialization for path manipulation on the map. */
"use strict";

import { map, fit_bounds } from "../map";
import { Marker } from "maplibre-gl";
import * as logging from "tauri-plugin-log-api";
import { invoke } from "@tauri-apps/api";
import start_icon from "../../icons/start-point.png";
import end_icon from "../../icons/end-point.png";

/** PathData Geometry Type
 * @typedef{{
 *   type: ("MultiPoint" | "LineString"),
 *   coordinates: Array<Array<Number>>,
 * }} PathDataGeometry
 */

/** PathData Feature Type
 * @typedef{{
 *  type: "Feature",
 *  geometry: PathDataGeometry,
 * }} PathDataFeature
 */

/** Path Data Type
 * @typedef {{
 *  type: "FeatureCollection",
 *  version: String,
 *  features: Array<PathDataFeature>,
 * }} PathData
 */

const start_image = document.createElement("img");
start_image.src = start_icon;
start_image.style.translate = "0px 5px";
start_image.width = 100;

const end_image = document.createElement("img");
end_image.src = end_icon;
end_image.style.translate = "12px -10px";
end_image.width = 80;

/** Reads the data path for saved path.
 *
 * @returns{Promise<PathData>} The saved data or default.
 * */
async function read_path() {
    try {
        path_data = await invoke("read_path");
    } catch (e) {
        logging.error(String(e));
        path_data = {
            "type": "FeatureCollection",
            "version": "0.1.0",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "MultiPoint",
                        "coordinates": []
                    }
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": []
                    }
                }
            ]
        };
    }
    line_coords = path_data.features[1].geometry.coordinates;
    point_coords = path_data.features[0].geometry.coordinates;
    if (line_coords.length > 0) {
        fit_bounds(line_coords, 100);
    }
}

/** Save the data path.
 *
 * @returns{Promise<null>} The saved data or default.
 * */
export function save_path() {
    try {
        return invoke("save_path", { path: path_data });
    } catch (e) {
        logging.error(String(e));
        return new Promise();
    }
}


/** The main GeoJSON data for the robot. */
export let path_data = undefined;

/** All the coordinates of the path.
 *
 * @type{[number, number]} */
export let line_coords = undefined;
/** All the coordinates where the robot will collect data.
 *
 * @type{[number, number]} */
export let point_coords = undefined;

/** Draggable markers to manipulate paths.
 *
 * @type{Array<Marker>} */
export const markers = [];

/** MaplibreJS source of the GEOJSON data.
 *
 * @type{import("maplibre-gl/dist/maplibre-gl.js").GeoJSONSource} */
export let source = undefined;

map.once("load", async () => {
    await read_path();
    source_loaded();
});

function source_loaded() {
    // Adding path into data source
    map.addSource("path", {
        "type": "geojson",
        "data": path_data
    });
    source = map.getSource("path");

    // Path layer
    map.addLayer({
        "id": "route",
        "type": "line",
        "source": "path",
        "layout": {
            "line-join": "round",
            "line-cap": "round"
        },
        "paint": {
            "line-color": "#888888",
            "line-width": 8
        },
    });

    // Collection point layer
    map.addLayer({
        "id": "collection-points",
        "type": "circle",
        "source": "path",
        "paint": {
            "circle-radius": 6,
            "circle-color": "#B42222"
        },
        "filter": ["==", "$type", "Point"]
    });

    redraw_markers();

    // Adding new point
    map.on("click", (event) => {
        const location = event.lngLat.toArray();
        logging.debug(`User Clicked: ${JSON.stringify(location)}`);

        const source = map.getSource("path");
        logging.debug(`Source: ${source.id}`);

        // Adding marker
        logging.info("Adding new marker");
        add_marker(location);
    });
}

/** Redraws all the markers on the map.
 *
 * This function will mutate the markers variable.
 * */
export function redraw_markers() {
    // Removing all markers from the map
    for (const marker of markers) {
        marker.remove();
    }

    // Reallocating space for new data
    markers.length = line_coords.length;

    // Mapping new data
    for (const i of markers.keys()) {
        const location = line_coords[i];

        // Adding draggable markers
        markers[i] = new Marker({
            draggable: true,
        })
            .setLngLat(location)
            .addTo(map);
    }
    if (markers.length > 1) {
        const start = markers[0].getElement();
        start.replaceChildren(start_image);
        const end = markers[markers.length - 1].getElement();
        end.replaceChildren(end_image);
    }
}

/** Addas a new marker to the map.
 *
 * @param {import("maplibre-gl/dist/maplibre-gl.js").LngLatLike} location The location of the new marker.
 * */
function add_marker(location) {
    const marker_line_index = markers.length;
    logging.debug(`Line Marker Index: ${marker_line_index.toString()}`);

    // Adding draggable markers
    const marker = new Marker({
        draggable: true
    })
        .setLngLat(location)
        .addTo(map);

    markers.push(marker);
}

export default path_data;
