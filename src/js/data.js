/** Module for handling data.
 * */

import { invoke } from "@tauri-apps/api";
import map from "./map";
import * as logging from "tauri-plugin-log-api";

/** PathData Feature Type
 * @typedef{{
 *  type: "Feature",
 *  properties: {
 *      temperature: Number,
 *      depth: Number,
 *      layer: ("surface" | "middle" | "sea bed"),
 *      time: Date,
 *  }
 *  geometry: {
 *      type: "Point",
 *      coordinates: import("maplibre-gl").LngLatLike
 *  },
 * }} BoatDataFeature
 */

/** Boat Data Type
 * @typedef {{
 *  type: "FeatureCollection",
 *  version: String,
 *  features: Array<BoatDataFeature>,
 * }} BoatData
 */

/** Reads the data path for saved data. */
async function read_data() {
    try {
        boat_data = await invoke("read_data");
    } catch (e) {
        logging.error(String(e));
        boat_data = {
            "type": "FeatureCollection",
            "version": "0.1.0",
            "features": []
        };
    }
}

/** The main GeoJSON data from the robot.
 *
 * @type{BoatData}
 * */
export let boat_data = undefined;

/** MaplibreJS source of the GEOJSON data.
 *
 * @type{import("maplibre-gl/dist/maplibre-gl.js").GeoJSONSource} */
let source = undefined;

map.once("load", async () => {
    await read_data();
    source_loaded();
});

/** Callback function when the data is loaded. */
function source_loaded() {
    // Adding boat data into data source
    map.addSource("boat-data", {
        "type": "geojson",
        "data": boat_data
    });
    source = map.getSource("boat-data");

    // Heatmap Layer
    map.addLayer(
        {
            "id": "boat-data-heat",
            "type": "heatmap",
            "source": "boat-data",
            "filter": ["==", "layer", "sea bed"],
            "paint": {
                // Increase the heatmap weight based on temperature
                // TODO: Make settings for min and max range
                "heatmap-weight": [
                    "interpolate",
                    ["linear"],
                    ["get", "temperature"],
                    0,
                    0,
                    40,
                    1
                ],
                // Increase the heatmap color weight weight by zoom level
                // heatmap-intensity is a multiplier on top of heatmap-weight
                "heatmap-intensity": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    10,
                    0,
                    21,
                    1
                ],
                // Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
                // Begin color ramp at 0-stop with a 0-transparancy color
                "heatmap-color": [
                    "interpolate",
                    ["linear"],
                    ["heatmap-density"],
                    0,
                    "rgba(33,102,172,0)",
                    0.17,
                    "rgb(103,169,207)",
                    0.33,
                    "rgb(209,229,240)",
                    0.67,
                    "rgb(253,219,199)",
                    0.83,
                    "rgb(239,138,98)",
                    1,
                    "rgb(178,24,43)"
                ],
                // to create a blur-like effect.
                // Adjust the heatmap radius by zoom level
                // TODO: Dynamically change this based on point distances
                "heatmap-radius": [
                    "interpolate",
                    ["exponential", 2],
                    ["zoom"],
                    10,
                    0,
                    21,
                    6 / 0.037
                ],
                // Transition from heatmap to circle layer by zoom level
                "heatmap-opacity": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    10,
                    0,
                    21,
                    1
                ]
            }
        },
    );

    // Data Point Layer
    map.addLayer(
        {
            "id": "boat-data-points",
            "type": "circle",
            "source": "boat-data",
            "minzoom": 7,
            "filter": ["==", "layer", "sea bed"],
            "paint": {
                // Size circle radius by temperature and zoom level
                // https://wiki.openstreetmap.org/wiki/Zoom_levels
                // https://stackoverflow.com/questions/37599561/drawing-a-circle-with-the-radius-in-miles-meters-with-mapbox-gl-js
                "circle-radius": [
                    "interpolate",
                    ["exponential", 2],
                    ["zoom"],
                    10,
                    0,
                    21,
                    0.5 / 0.037
                ],
                // Color circle by temperature
                // TODO: Make settings for min and max range
                "circle-color": [
                    "interpolate",
                    ["linear"],
                    ["get", "temperature"],
                    0,
                    "rgba(33,102,172,0)",
                    8,
                    "rgb(103,169,207)",
                    16,
                    "rgb(209,229,240)",
                    24,
                    "rgb(253,219,199)",
                    32,
                    "rgb(239,138,98)",
                    40,
                    "rgb(178,24,43)"
                ],
                "circle-stroke-color": "white",
                "circle-stroke-width": 1,
                // Transition from heatmap to circle layer by zoom level
                "circle-opacity": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    10,
                    0,
                    21,
                    1
                ]
            }
        },
    );
}

/** Updates the data displayed.
 *
 * This function will mutate the boat_data variable.
 *
 * @param {BoatData} data The new BoatData to set to.
 * */
export function update_data(data) {
    source.setData(data);
    boat_data = data;
}

/** The select element for filtering the layer.
 * @type{HTMLSelectElement}
 * */
const filter_element = document.getElementById("display-layer");

if (filter_element === null) {
    logging.error("Unable to Find Display Layer Select");
} else {
    filter_element.addEventListener("input", update_filter);
}

/** Update the filter of the layer to display.
 *
 * @param {InputEvent} event The input event.
 */
function update_filter(event) {
    const filter = ["==", "layer", event.target.value];
    map.setFilter("boat-data-points", filter);
    map.setFilter("boat-data-heat", filter);
}
