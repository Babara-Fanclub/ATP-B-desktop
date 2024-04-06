/** Communication Logic with the Boat. */
import { invoke } from "@tauri-apps/api";
import { listen } from "@tauri-apps/api/event";
import * as logging from "tauri-plugin-log-api";

import * as boat_vars from "./data";
import * as path_vars from "./map/add_point";

const connected_status = `
            <div class="flex items-center justify-between bg-green-500 text-white p-2">
                <div class="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        class="h-4 w-4">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Connected</span>
                </div>
            </div>`

const disconnected_status = `
            <div class="flex items-center justify-between bg-red-500 text-white p-2">
                <div class="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        class="h-4 w-4">
                        <path
                            d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z">
                        </path>
                    </svg>
                    <span>Disconnected</span>
                </div>
            </div>`

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

/** Status Bar Element
 * @type{HTMLDivElement | null}
 * */
const status_bar = document.getElementById("status-bar");

if (status_bar === null) {
    logging.error("Unable to Find Status Bar Element");
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
            update_ui(true);
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
        update_ui(false);
        search_port();
    }
});

function update_ui(connection) {
    if (connection === true) {
        run_button.disabled = false;
        status_bar.innerHTML = connected_status;
    } else {
        port = null;
        status_bar.innerHTML = disconnected_status;
        run_button.disabled = true;
    }
}