import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'

// Same park extent + basemap as components/admin/AdminMap.tsx (mirrored: that module is all exhibit/section logic).
const ORTHO_BOUNDS: [number, number, number, number] = [78.187123, 17.378546, 78.196134, 17.383978]
const MAX_BOUNDS: [number, number, number, number] = [
  ORTHO_BOUNDS[0] - 0.001,
  ORTHO_BOUNDS[1] - 0.001,
  ORTHO_BOUNDS[2] + 0.001,
  ORTHO_BOUNDS[3] + 0.001,
]

/** Park orthophoto map shared by the tour tool's modes. Pair with `destroyParkMap`. */
export function createParkMap(container: HTMLElement): maplibregl.Map {
  const protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol))
  return new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: {
        park: {
          type: 'raster',
          url: 'pmtiles:///park.pmtiles',
          tileSize: 256,
          minzoom: 15,
          maxzoom: 21,
        },
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#0f172a' } },
        { id: 'park', type: 'raster', source: 'park' },
      ],
    },
    center: [(ORTHO_BOUNDS[0] + ORTHO_BOUNDS[2]) / 2, (ORTHO_BOUNDS[1] + ORTHO_BOUNDS[3]) / 2],
    zoom: 18,
    maxBounds: MAX_BOUNDS,
    minZoom: 15,
  })
}

export function destroyParkMap(map: maplibregl.Map) {
  map.remove()
  maplibregl.removeProtocol('pmtiles')
}
