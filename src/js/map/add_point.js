/** Functions and initialization for path manipulation on the map. */
"use strict";

import { map } from "../map";
import { Marker } from "maplibre-gl";
import { interpolate_points as interpolate } from "./interpolate";
import { debug } from "tauri-plugin-log-api";
import { invoke } from "@tauri-apps/api";

/** Reads the data path for saved path.
 *
 * @returns{Promise<GeoJSON>} The saved data or default.
 * */
async function read_path() {
    try {
        path_data = await invoke("read_path");
    } catch (e) {
        console.error(e);
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
}

/** Save the data path.
 *
 * @returns{Promise<null>} The saved data or default.
 * */
function save_path() {
    try {
        return invoke("save_path", { path: path_data });
    } catch (e) {
        console.error(e);
        return new Promise();
    }
}


/** The main GeoJSON data for the robot. */
export let path_data = undefined;

/** All the coordinates of the path.
 *
 * @type{[number, number]} */
let line_coords = undefined;
/** All the coordinates where the robot will collect data.
 *
 * @type{[number, number]} */
let point_coords = undefined;

/** Draggable markers to manipulate paths.
 *
 * @type{Array<Marker>} */
const markers = [];

/** MaplibreJS source of the GEOJSON data.
 *
 * @type{import("maplibre-gl/dist/maplibre-gl.js").GeoJSONSource} */
let source = undefined;

map.once("load", async () => {
    await read_path();
    source_loaded();
})

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
        debug(`User Clicked: ${location.toString()}`);

        const source = map.getSource("path");
        debug(`Source: ${source.toString()}`);

        // Adding data to geoJSON
        line_coords.push(location);
        point_coords.push(location);
        source.setData(path_data);

        // Adding marker
        add_marker(location);
        recalculate_points();

        debug(`New Path: ${path_data.toString()}`);
        save_path();
    });
};

/** Callback function when a marker is dragged.
 *
 * @param {import("maplibre-gl").MapLibreEvent} event The drag event emitted by the Marker.
 * */
function marker_on_drag(event) {
    /** @type{Marker} */
    const marker = event.target;
    // We should get a valid index here
    const marker_index = markers.indexOf(marker);

    debug(`Marker Moved: ${marker}`);
    debug(`Marker Index: ${marker_index.toString()}`);

    const new_coords = marker.getLngLat().toArray();
    line_coords[marker_index] = new_coords;
    recalculate_points();
    source.setData(path_data);

    debug(`Marker Moved to: ${new_coords.toString()}`);
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
    for (const [i, marker] of markers.entries()) {
        const location = line_coords[i];

        if (marker !== undefined) {
            marker.setLngLat(location).addTo(map);
            continue;
        }

        // Adding draggable markers
        markers[i] = new Marker({
            draggable: true
        })
            .setLngLat(location)
            .addTo(map);

        markers[i].on("drag", marker_on_drag);
        markers[i].on("dragend", () => save_path());
    }
}

/** Recalculate all the collection points.
 *
 * This function will mutate the point_coords variable.
 * */
function recalculate_points() {
    const new_values = interpolate(line_coords, 5);
    point_coords.length = new_values.length;
    for (const i in new_values) {
        point_coords[i] = new_values[i];
    }
}

/** Addas a new marker to the map.
 *
 * @param {import("maplibre-gl/dist/maplibre-gl.js").LngLatLike} location The location of the new marker.
 * */
function add_marker(location) {
    const marker_line_index = markers.length;
    debug(`Line Marker Index: ${marker_line_index.toString()}`);

    // Adding draggable markers
    const marker = new Marker({
        draggable: true
    })
        .setLngLat(location)
        .addTo(map);

    marker.on("drag", marker_on_drag);
    marker.on("dragend", () => save_path());
    markers.push(marker);
}

export default path_data;
