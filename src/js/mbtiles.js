/** Maplibre JS support for MBTiles protocol. */
import { invoke, path } from "@tauri-apps/api";
import * as logging from "tauri-plugin-log-api";

/** MBTiles Protocol for Maplibre JS.
 *
 * @param {import("maplibre-gl").RequestParameters} params - Paramters for the protocol.
 * @returns {import("maplibre-gl").GetResourceResponse} The response to the request.
 */
export default async function mbtiles_protocol(params) {
    const url = new URL(params.url);
    const db_file = await path.resolveResource(url.host);

    if (params.type === "json") {
        const tiles = [`${url.href}/{z}/{x}/{y}`];
        try {
            const tiles_json = await invoke("mbtiles_metadata", { db: db_file });
            tiles_json.tiles = tiles;
            return {
                data: tiles_json
            }
        } catch (e) {
            logging.error(e);
            return {
                data: {
                    tiles: tiles,
                    minzoom: 0,
                    maxzoom: 14,
                    scheme: "tms",
                    attribution: "<a href=\"https://www.maptiler.com/copyright/\" target=\"_blank\">&copy; MapTiler</a> <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\">&copy; OpenStreetMap contributors</a>",
                }
            };
        }
    }

    const paths = url.pathname.split("/").map(Number);
    paths.shift();
    const [z, x, y] = paths;

    try {
        return {
            data: await invoke("fetch_mbtiles", {
                db: db_file,
                zoom: z,
                column: x,
                row: y,
            }),
        };
    } catch (e) {
        logging.error(e.toString());
        return { data: [] };
    }
}
