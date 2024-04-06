/** Communication Logic with the Boat. */
import { invoke } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";
import * as logging from "tauri-plugin-log-api";

import * as boat_vars from "./data";
import * as path_vars from "./map/add_point";

/** Run Element
 * @type{HTMLButtonElement | null}
 * */
const run_button = document.getElementById("run-button");

if (run_button === null) {
    logging.error("Unable to Find Run Button");
} else {
    run_button.disabled = true;
    run_button.addEventListener("click", async () => {
        if (port === null) {
            return;
        }

        try {
            logging.info(`Sending Path to Port ${port}`);
            await invoke("send_path", { port: port, data: path_vars.path_data });
        } catch (e) {
            logging.error(e);
        }
    });
}

/** The current connected port.
 * 
 * @type{string}
 */
let port = null;

async function search_port() {
    /** The available serial ports
     * 
     * @type{Array<string>}
     */
    try {
        const ports = await invoke("find_ports");
        if (ports.length > 0) {
            // Taking the first port
            // TODO: Handle multiple ports
            port = ports[0];
            run_button.disabled = false;
            return;
        }
    } catch (e) {
        logging.error(e);
    }

    // Keep searching every second if we didn't find any ports
    setTimeout(search_port, 1000);
}
// Bootstrapping port
search_port();

// Update data when new data is received
listen("received-data", async (event) => {
    if (event.payload.port === port) {
        logging.info("Received Data from Boat");
        boat_vars.update_data(event.payload.data);
        await invoke("save_data", { data: boat_vars.boat_data });
    }
});

// Handles diconnection
listen("disconnected", async (event) => {
    logging.info("Port Disconnected");
    if (event.payload === port) {
        port = null;
        run_button.disabled = true;
        search_port();
    }
});