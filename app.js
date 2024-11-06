import {DeckLayer} from '@deck.gl/arcgis';
import ArcGISMap from '@arcgis/core/Map';
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer.js";
import MapView from '@arcgis/core/views/MapView';
import initWasm from "@geoarrow/geoarrow-wasm/esm/index.js";
import wasmUrl from "@geoarrow/geoarrow-wasm/esm/index_bg.wasm?url"
import { WebMercatorToLatLon, DegreeToXYTile, GetListZoom14Tiles} from './spatial_utils';
import { GeoArrowScatterplotLayer } from "@geoarrow/deck.gl-layers";
import * as arrow from "./node_modules/apache-arrow/Arrow.dom";
import { ParquetDataset, ParquetFile, set_panic_hook, writeGeoJSON } from '@geoarrow/geoarrow-wasm';
import { allYellowStoneTiles } from './all_layer_ids';
import { compareSchemas } from 'apache-arrow/visitor/typecomparator';
/* 
fetch("http://127.0.0.1:8000/api/vNext/insar/comprehensive/parquet", {
    method: 'POST',
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({"layer_id": '1dc69ece-8ab1-3819-b3a1-8de5c2e92575'})
})
.then(
    (response) => {return response.arrayBuffer()}
).then((buffer) => {
    return arrow.tableFromIPC(buffer)
}).then((table) => {
    const layer = new DeckLayer({
    'deck.layers': [
        new GeoArrowScatterplotLayer({
        id: 'custom_scatterplot',
        data: table,
        radiusMinPixels: 1,
        getFillColor: ({ index, data }) => {
            const recordBatch = data.data;
            const row = recordBatch.get(index);
            const velocity = row['velocity_mm_yr']
            let color;
            if (velocity < 0) {
                color = [255, 0, 0]; // Red for negative velocities
            } else if (velocity >= 0 && velocity <= 10) {
                color = [0, 255, 0]; // Green for velocities between 0 and 10
            } else {
                color = [0, 0, 255]; // Blue for velocities greater than 10
            }
            return color;
        },

        pickable: true,
        })
    ]
    });

    map.add(layer)

})
*/


await initWasm(wasmUrl);

// 

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
    let { maxx, maxy } = WebMercatorToLatLon(mapView.extent.xmax, mapView.extent.ymax);
    let { minx, miny } = WebMercatorToLatLon(mapView.extent.xmin, mapView.extent.ymin);

    let selectedRederMethod = document.getElementById("renderMode").value
    let maxLatLon = WebMercatorToLatLon(mapView.extent.xmax, mapView.extent.ymax);
    let minLatLon = WebMercatorToLatLon(mapView.extent.xmin, mapView.extent.ymin);

    let maxXYTile = DegreeToXYTile(maxLatLon.lat, maxLatLon.lon)
    let minXYTile = DegreeToXYTile(minLatLon.lat, minLatLon.lon)

    let allTiles = GetListZoom14Tiles(minXYTile, maxXYTile)

    if (selectedRederMethod === "wasm_parquet") {
    }
    else if (selectedRederMethod === "geojson") {
        
        async function fetchNextChunk() {
            let tile = allTiles.pop()
            try {
                if ( tile !== null && tile !== undefined ) {
                    let response = await fetch("http://127.0.0.1:8000/api/vNext/insar/comprehensive/parquet", {
                        method: "POST",
                        body: JSON.stringify({
                            return_type: "geojson",
                            layer_id: "1dc69ece-8ab1-3819-b3a1-8de5c2e92575",
                            tile_row: tile.x,
                            tile_column: tile.y
                        }),
                        headers: {
                            "Content-Type":"application/json"
                        }
                    })
                    if (response.ok) {
                        return await response.arrayBuffer();
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
            while (allTiles.length > 0) {
                let tile = await fetchNextChunk()
                if (tile) {
                    yield tile
                }
            }
        }

        (async () => {
            for await (const tile of getGeoJsonData()) {
                const decoder = new TextDecoder('utf-8')
                let blob = new Blob([decoder.decode(tile)], {
                    type: 'application/json'
                })
                let url = URL.createObjectURL(blob)
                const layer = new GeoJSONLayer({
                    url
                })
                map.add(layer)
            }
        })();


    } else if (selectedRederMethod === "rest_api_parquet") {

        async function fetchNextChunk() {
            let tile = allTiles.pop()

            if ( tile !== null && tile !== undefined ) {
                let response = await fetch("http://127.0.0.1:8000/api/vNext/insar/comprehensive/parquet", {
                    method: "POST",
                    body: JSON.stringify({
                        return_type: "arrow",
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
                    return arrow.tableFromIPC(arrayBuffer)
            }
            return null
       }

        async function* getData() {
            let chunk
            while (chunk = await fetchNextChunk()) {
                if (chunk) { 
                    yield chunk
                }
            }
        }

        const layers = new DeckLayer({
            'deck.layers': [
                new GeoArrowScatterplotLayer({
                    id: 'insar-datasets',
                    data: getData()
                })
            ]
        })


    }
})


/* 
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function onExtentChange(event) {
    let maxLatLon = WebMercatorToLatLon(event.extent.xmax, event.extent.ymax);
    let minLatLon = WebMercatorToLatLon(event.extent.xmin, event.extent.ymin);

    let maxXYTile = DegreeToXYTile(maxLatLon.lat, maxLatLon.lon)
    let minXYTile = DegreeToXYTile(minLatLon.lat, minLatLon.lon)

    let allTiles = GetListZoom14Tiles(minXYTile, maxXYTile)

    console.log(allTiles)

}

mapView.watch('extent', debounce(onExtentChange, 500))
*/