import {DeckLayer} from '@deck.gl/arcgis';
import ArcGISMap from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import { GeoArrowScatterplotLayer } from "@geoarrow/deck.gl-layers";
import * as arrow from "./node_modules/apache-arrow/Arrow.dom";

fetch("http://127.0.0.1:8080/2019-01-01_performance_mobile_tiles.feather").then(
    (response) => {return response.arrayBuffer()}
).then((buffer) => {
    return arrow.tableFromIPC(buffer)
}).then((table) => {
    const layer = new DeckLayer({
    'deck.layers': [
        new GeoArrowScatterplotLayer({
        id: 'custom_scatterplot',
        data: table,
        getFillColor: table.getChild("colors"),
        getRadius: ({ index, data }) => {
            const recordBatch = data.data;
            const row = recordBatch.get(index);
            return row['avg_d_kbps'] / 50;
        },
        radiusMinPixels: 0.1,
        pickable: true
        })
    ]
    });

    map.add(layer)

})

const map = new ArcGISMap({
    basemap: 'dark-gray-vector',
  })

const mapView = new MapView({
  container: 'viewDiv',
  map: map,
  center: [0.119167, 52.205276],
  zoom: 5
});