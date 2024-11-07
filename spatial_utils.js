export function WebMercatorToLatLon(x, y) {
    let lon = (x / 20037508.34) * 180
    let lat = (y / 20037508.34) * 180
    lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2)
    return {lat: lat, lon: lon}
}

export function DegreeToXYTile(latDegrees, lonDegrees, Zoom=14) {
    let latRad = latDegrees * (Math.PI / 180)
    let n = 2.0 ** Zoom
    let xTile = Math.floor((lonDegrees + 180.0) / 360.0 * n)
    let yTile = Math.floor((1.0 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2.0 * n)
    return {x: xTile, y: yTile}
}

export function GetListZoom14Tiles(minXYTile, maxXYTile) {
    let tiles = [];
    for (let x = minXYTile.x; x <= maxXYTile.x; x++) {
        for (let y = maxXYTile.y; y <= minXYTile.y; y++) {
            tiles.push({ x: x, y: y });
        }
    }

    return tiles
}