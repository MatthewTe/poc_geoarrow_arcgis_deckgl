import {DeckLayer} from '@deck.gl/arcgis';
import ArcGISMap from '@arcgis/core/Map';
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import MapView from '@arcgis/core/views/MapView';
import initWasm from "@geoarrow/geoarrow-wasm/esm/index.js";
import wasmUrl from "@geoarrow/geoarrow-wasm/esm/index_bg.wasm?url"
import { WebMercatorToLatLon, DegreeToXYTile, GetListZoom14Tiles} from './spatial_utils';
import { GeoArrowScatterplotLayer } from "@geoarrow/deck.gl-layers";
import * as arrow from "./node_modules/apache-arrow/Arrow.dom";
import { writeGeoJSON, readGeoParquet } from '@geoarrow/geoarrow-wasm';
import wasmInit, {readParquet} from "parquet-wasm";

initWasm(wasmUrl)
const parquetWasmUrl = "https://cdn.jsdelivr.net/npm/parquet-wasm@0.6.1/esm/parquet_wasm_bg.wasm"
await wasmInit(parquetWasmUrl)

const map = new ArcGISMap({
    basemap: 'topo',
  })

const mapView = new MapView({
  container: 'viewDiv',
  map: map,
  center: [-110.588455, 44.427963],
  zoom: 15
});

const loadBtn = document.getElementById("renderButton")
loadBtn.addEventListener("click", async (e) => {
    // Getting lat/lng bbox of map extent:
    let selectedRederMethod = document.getElementById("renderMode").value
    let maxLatLon = WebMercatorToLatLon(mapView.extent.xmax, mapView.extent.ymax);
    let minLatLon = WebMercatorToLatLon(mapView.extent.xmin, mapView.extent.ymin);

    let maxXYTile = DegreeToXYTile(maxLatLon.lat, maxLatLon.lon)
    let minXYTile = DegreeToXYTile(minLatLon.lat, minLatLon.lon)

    let allTiles = GetListZoom14Tiles(minXYTile, maxXYTile)

    if (selectedRederMethod === "wasmparquet") {
    }
    else if (selectedRederMethod === "geojson") {
        
        const decoder = new TextDecoder('utf-8')
        let uniqueGeoJsonTiles = allTiles.filter((tile) => !(map.findLayerById(`geojson-${tile.x}-${tile.y}`)))

        async function fetchNextChunk() {
            let tile = uniqueGeoJsonTiles.pop()
            try {
                if ( tile !== null && tile !== undefined ) {
                    let response = await fetch("http://127.0.0.1:8000/api/vNext/insar/comprehensive/parquet", {
                        method: "POST",
                        body: JSON.stringify({
                            return_type: "parquet",
                            layer_id: "1dc69ece-8ab1-3819-b3a1-8de5c2e92575",
                            tile_row: tile.x,
                            tile_column: tile.y
                        }),
                        headers: {
                            "Content-Type":"application/json"
                        }
                    })
                    if (response.ok) {

                        let fileContent = await response.arrayBuffer();
                        let chunkTable = readGeoParquet(new Uint8Array(fileContent))
                        return { tile:tile, arrowTable: chunkTable };
                    } else {
                        return null
                    }
                }
                return null
            } catch (err) {
                console.log(err.message)
                return null
            }
       }

       async function* getGeoJsonData() {
            while (uniqueGeoJsonTiles.length > 0) {
                let tile = await fetchNextChunk()
                if (tile) {
                    yield tile
                }
            }
        }

        (async () => {
            for await (const tile of getGeoJsonData()) {
                let blob = new Blob([decoder.decode(writeGeoJSON(tile.arrowTable))], {
                    type: 'application/json'
                })
                let url = URL.createObjectURL(blob)
                const layer = new GeoJSONLayer({
                    id: `geojson-${tile.tile.x}-${tile.tile.y}`,
                    url: url,
                    renderer: {
                    type: "simple", // SimpleRenderer applies the same symbol for all features
                    symbol: {
                        type: "simple-marker", // Marker symbol for point data
                        style: "circle",
                        color: "blue", // Default color
                        size: 6, // Default size
                        outline: {
                            color: "black",
                            width: 0.5
                        }
                    },
                    visualVariables: [
                        {
                            type: "color",
                            field: "velocity_mm_yr",
                            stops: [
                                { value: -30, color: "green" }, // Green for the minimum value
                                { value: -20, color: "yellow" },  // Yellow for the midpoint
                                { value: -15, color: "red" }     // Red for the maximum value
                            ]
                        }
                    ]
                },
                popupEnabled: true,
                    popupTemplate: {
                    title: "Feature Details",
                    content: `
                        <b>Velocity (mm/year):</b> {velocity_mm_yr}<br>
                    `
                }
            }
        )
            map.add(layer)
            }
        })();


    } else if (selectedRederMethod === "rest_api_parquet") {

        let uniqueGeoArrowTiles = allTiles.filter((tile) => !(map.findLayerById(`geoarrow-buffers-${tile.x}-${tile.y}`)))
        async function fetchNextChunk() {
            let tile = uniqueGeoArrowTiles.pop()
            
            try {
                if ( tile !== null && tile !== undefined ) {
                    let response = await fetch("http://127.0.0.1:8000/api/vNext/insar/comprehensive/parquet", {
                        method: "POST",
                        body: JSON.stringify({
                            return_type: "geoarrow_parquet",
                            layer_id: "1dc69ece-8ab1-3819-b3a1-8de5c2e92575",
                            tile_row: tile.x,
                            tile_column: tile.y
                        }),
                        headers: {
                            "Content-Type":"application/json"
                        }
                    })
                    if (!response.ok) {
                        return null
                    }
                    let arrayBuffer = await response.arrayBuffer()
                    let wasmTable = readParquet(new Uint8Array(arrayBuffer))
                    let jsTable = arrow.tableFromIPC(wasmTable.intoIPCStream())
                    return {tile: tile, table:jsTable }
                }
                return null
            } catch (err) {
                console.log(err.stack)
                return null
            }
       }

        async function* getData() {
            while (uniqueGeoArrowTiles.length > 0 ) {
                let chunkedData =  await fetchNextChunk()
                if (chunkedData) { 
                    yield chunkedData
                }
            }
        }

        const layer = new DeckLayer({'deck.layers': []});
        map.add(layer);
        (async () => {
            for await (const tile of getData()) {
                layer.deck.layers = [
                    ...layer.deck.layers,
                    new GeoArrowScatterplotLayer({
                        id: `geoarrow-buffers-${tile.tile.x}-${tile.tile.y}`,
                        data: tile.table,
                        radiusMinPixels: 3,
                        pickable: true
                    })
                ]
            }
        })();

    }
})


