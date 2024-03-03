/** Even Listeners For Import and Export Path and Data. */
import * as logging from "tauri-plugin-log-api";
import { invoke } from "@tauri-apps/api";
import { open, save } from '@tauri-apps/api/dialog';
import * as path_vars from "./map/add_point";
import * as boat_vars from "./data";
import { fit_bounds } from "./map";

/** Import Export Callback
 * @callback IECallback
 * @param {String} file_path - The path to the selected file.
 */

/** Import Path Element
 * @type{HTMLInputElement | null}
 * */
const input_ip = document.getElementById("import-path");

if (input_ip === null) {
    logging.error("Unable to Find Import Path Input");
} else {
    const filter = input_ip.accept.split(",").map((v) => v.trim().replace(/^./i, "")).filter((v) => !v.includes("/"));
    input_ip.addEventListener("click", (event) => show_file_picker(event, import_path, filter));
}

/** Export Path Element
 * @type{HTMLButtonElement | null}
 * */
const button_ep = document.getElementById("export-path");

if (button_ep === null) {
    logging.error("Unable to Find Export Path Button");
} else {
    button_ep.addEventListener("click", (event) => show_file_saver(event, export_path, "path.geojson"));
}

/** Import Data Element
 * @type{HTMLInputElement | null}
 * */
const input_id = document.getElementById("import-data");

if (input_id === null) {
    logging.error("Unable to Find Import Data Input");
} else {
    const filter = input_id.accept.split(",").map((v) => v.trim().replace(/^./i, "")).filter((v) => !v.includes("/"));
    input_id.addEventListener("click", (event) => show_file_picker(event, import_data, filter));
}

/** Export Path Element
 * @type{HTMLButtonElement | null}
 * */
const button_ed = document.getElementById("export-data");

if (button_ed === null) {
    logging.error("Unable to Find Export Data Button");
} else {
    button_ed.addEventListener("click", (event) => show_file_saver(event, export_data, "data.csv"));
}

/** Find a feature from a GeoJSON feature collection.
 *
 * @param {String} type The feature type to find.
 * @param {Array<import("./map/add_point").PathDataFeature>} features The feature collection.
 * @returns {import("./map/add_point").PathDataFeature | undefined} The feature found.
 */
function find_feature(features, type) {
    return features.find((/** @type{import("./map/add_point").PathDataFeature} */ element) =>
        element.geometry.type === type
    )
}

/** Event listener for showing tauri file picker instead of browsers.
 * 
 * @param {PointerEvent} event The click event.
 * @param {IECallback} handler The handler function when a file is selected.
 * @param {Array<String>} filters The custom file filters for the dialog.
 */
async function show_file_picker(event, handler, filters) {
    logging.info("Preventing Default File Opener");
    event.preventDefault();
    // Open a selection dialog for image files
    logging.info("Opening File Opener Dialog");
    const selected = await open({
        multiple: false,
        filters: [{
            name: "Custom Files",
            extensions: filters
        }, {
            "name": "All Files",
            extensions: ["*"]
        }]
    });
    logging.info("Handling Opened File");
    if (selected !== null) {
        logging.debug("User Selected a File");
        handler(selected);
    } else {
        logging.debug("User Canceled the File Opener");
    }
}

/** Event listener for showing tauri file saver instead of browsers.
 * 
 * @param {PointerEvent} _event The click event.
 * @param {IECallback} handler The handler function when a file is selected.
 * @param {String} default_path The default file name to save to.
 */
async function show_file_saver(_event, handler, default_path) {
    // Open a selection dialog for image files
    logging.info("Opening File Saving Dialog");
    const selected = await save({
        defaultPath: default_path,
    });
    logging.info("Handling Saving File");
    if (selected !== null) {
        handler(selected);
    } else {
        logging.debug("User Canceled the File Saver");
    }
}

/** Function to import path into the application.
 *
 * TODO: Should we warn user about the deletion of the current progress?
 * 
 * @param {String} file_path The path to the path to import from.
 */
async function import_path(file_path) {
    logging.debug(`Importing: ${file_path}`);

    try {
        logging.info("Reading Path File");
        /** @type{import("./map/add_point").PathData} */
        const new_path = await invoke("import_path", { importPath: file_path });
        const new_lines = find_feature(new_path.features, "LineString");
        const new_points = find_feature(new_path.features, "MultiPoint");
        logging.debug("New Path: " + JSON.stringify(new_path));

        logging.info("Setting New Path");
        path_vars.line_coords.splice(0, path_vars.line_coords.length, ...new_lines.geometry.coordinates);
        path_vars.point_coords.splice(0, path_vars.point_coords.length, ...new_points.geometry.coordinates);

        logging.info("Redrawing Map");
        path_vars.redraw_path();
        path_vars.redraw_markers();

        logging.info("Saving New Path");
        path_vars.save_path();

        logging.info("Fitting to New Bounds");
        fit_bounds(path_vars.line_coords);
    } catch (e) {
        logging.error(String(e));
        return
    }
}

/** Function to export path into the application.
 * 
 * @param {String} file_path The path to the path to export to.
 */
async function export_path(file_path) {
    logging.debug(`Exporting to: ${file_path}`);

    try {
        logging.info("Exporting Path");
        await invoke("export_path", { path: path_vars.path_data, exportPath: file_path });
    } catch (e) {
        logging.error(String(e));
        return
    }
}

/** Function to import boat data into the application.
 *
 * TODO: Should we warn user about the deletion of the current progress?
 * 
 * @param {String} file_path The path to the data to import from.
 */
async function import_data(file_path) {
    logging.debug(`Importing: ${file_path}`);

    try {
        logging.info("Reading Boat Data File");
        /** @type{import("./data").BoatData} */
        const new_path = await invoke("import_data_csv", { importPath: file_path });
        logging.debug("New Data: " + JSON.stringify(new_path));

        logging.info("Updating Boat Data");
        boat_vars.update_data(new_path);
    } catch (e) {
        logging.error(String(e));
        return;
    }
}

/** Function to export boat data from the application.
 * 
 * @param {String} file_path The path to export to.
 */
async function export_data(file_path) {
    logging.debug(`Exporting to: ${file_path}`);

    try {
        logging.info("Exporting Boat Data");
        await invoke("export_data_csv", { data: boat_vars.boat_data, exportPath: file_path });
    } catch (e) {
        logging.error(String(e));
        return;
    }
}
