/** Functions to interpolate points between two locations. */

import * as maplibregl from "maplibre-gl";
import * as logging from "tauri-plugin-log-api";
import * as path_vars from "./add_point";

export let current_distance = 3;

/** Interates through elements pairwise.
 *
 * @see{https://stackoverflow.com/questions/31973278/iterate-an-array-as-a-pair-current-next-in-javascript}
 * */
function* pairwise(iterable) {
    const iterator = iterable[Symbol.iterator]();
    let a = iterator.next();
    if (a.done) return;
    let b = iterator.next();
    while (!b.done) {
        yield [a.value, b.value];
        a = b;
        b = iterator.next();
    }
}

/** Converts a number from degrees to radians.
 *
 * @param {Number} deg The angle in degrees.
 * @returns{Number} The angle in radians.
 */
function deg_to_rad(deg) {
    return deg * Math.PI / 180;
}

/** Converts a number from radians to degrees.
 *
 * @param {Number} rad The angle in radians.
 * @returns{Number} The angle in degrees.
 */
function rad_to_deg(rad) {
    return rad * 180 / Math.PI;
}

/** Fill in the points with fixed distance between them.
 *
 * @param {Array<[number, number]>} points The points to interpolate.
 * @param {number} distance The distance between the points.
 * @returns {Array<[number, number]>} An array with interpolated points.
 * */
function interpolate(distance, points) {
    // Radius of Earth
    logging.debug(`Interpolating points for: ${JSON.stringify(points)}`);
    const points_mapped = points.map(maplibregl.LngLat.convert);
    let from_point = points_mapped[0];

    const lat1 = deg_to_rad(from_point.lat);
    const lng1 = deg_to_rad(from_point.lng);

    logging.info("Calculating Distance Between the Points");
    const point_distance = points_mapped[0].distanceTo(points_mapped[1]);
    logging.debug(`Point Distance: ${point_distance}`);

    logging.info("Calculating Number of Points");
    const count = Math.ceil(Math.floor(point_distance / distance) - 1, 0);
    logging.debug(`Adding ${count} new points`);

    const result = [];
    result.length = count + 1;

    for (const i of result.slice(0, count).keys()) {
        logging.info(`Interpolating Point ${i}`);

        // https://www.movable-type.co.uk/scripts/latlong.html
        const lat2 = deg_to_rad(points_mapped[1].lat);
        const lng2 = deg_to_rad(points_mapped[1].lng);

        logging.info("Calculating Bearing");
        const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
        const brng = Math.atan2(y, x);
        logging.debug(`Bearing: ${brng}`);

        result[i] = calculate_destination(from_point, brng, distance);
        logging.debug(`Inerpolated Point ${i}: ${JSON.stringify(result[i])}`);
        from_point = maplibregl.LngLat.convert(result[i]);
    }
    result[result.length - 1] = points[1];

    logging.debug(`Interpolated Points: ${JSON.stringify(result)}`);
    return result;
}

/** Calculate a destination point given distances and bearing from a starting point.
 *
 * @param {maplibregl.LngLatLike} from The starting point.
 * @param {Number} brng The bearing from starting point to destination.
 * @param {Number} distance The distance of the destination.
 * @returns{maplibregl.LngLatLike} The destination point.
 */
function calculate_destination(from, brng, distance) {
    const R = 6371e3;

    const lat1 = deg_to_rad(from.lat);
    const lng1 = deg_to_rad(from.lng);

    // https://www.movable-type.co.uk/scripts/latlong.html
    const new_lat = Math.asin(Math.sin(lat1) * Math.cos(distance / R) +
        Math.cos(lat1) * Math.sin(distance / R) * Math.cos(brng));
    let new_lng = lng1 + Math.atan2(Math.sin(brng) * Math.sin(distance / R) * Math.cos(lat1),
        Math.cos(distance / R) - Math.sin(lat1) * Math.sin(new_lat));
    new_lng = (new_lng + 3 * Math.PI) % (2 * Math.PI) - Math.PI;

    return [new_lng, new_lat].map(rad_to_deg);
}

/** Fill in the points with fixed distance between them.
 *
 * @param {Array<[number, number]>} points The points to interpolate.
 * @param {number} distance The distance between the points.
 * @returns {Array<[number, number]>} An array with interpolated points.
 * */
export function interpolate_points(points, distance) {
    logging.info("Interpolating Points");
    const array = Array.from(pairwise(points)).flatMap(interpolate.bind(null, distance));
    array.unshift(points[0]);
    return array;
}

/** Input Number Element for Path Interpolation.
 * @type{HTMLInputElement | null}
 * */
const number_input = document.getElementById("interpolate-number");

if (number_input === null) {
    logging.error("Unable to Find Interpolate Number Input");
} else {
    number_input.addEventListener("click", (event) => {
        const value = event.target.value;
        current_distance = value;
        recalculate_points();
        path_vars.source.setData(path_vars.path_data);
    });
}

/** Recalculate all the collection points.
 *
 * This function will mutate the point_coords variable.
 * */
export function recalculate_points() {
    const new_values = interpolate_points(path_vars.line_coords, current_distance);
    path_vars.point_coords.length = new_values.length;
    for (const i in new_values) {
        path_vars.point_coords[i] = new_values[i];
    }
}

export default interpolate_points;
