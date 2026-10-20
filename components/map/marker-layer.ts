import * as THREE from 'three'
import type maplibregl from 'maplibre-gl'
import { useMapStore } from '@/lib/map-store'
import { useStore } from '@/lib/store'
import { useDebugStore } from '@/lib/debug-store'
import { pinPixelHeight } from '@/lib/nearby'

export type MarkerInput = {
  id: string
  lat: number
  lng: number
  status: 'live' | 'coming_soon'
  number: number | null
}

const RISE_DURATION_MS = 400
const AURA_PERIOD_MS = 2600
const RIPPLE_DURATION_MS = 480

type TintKey = 'unvisited' | 'visited' | 'coming_soon'

const TINTS: Record<TintKey, { color: string; dimmed: boolean }> = {
  unvisited: { color: '#dda15e', dimmed: false },
  visited: { color: '#588157', dimmed: false },
  coming_soon: { color: '#8f8f8f', dimmed: true },
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** Shared radial-gradient contact-shadow texture. No lights, no shadow map. */
function makeShadowTexture(): THREE.CanvasTexture {
  const s = 128
  const c = s / 2
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const ctx = cv.getContext('2d')!
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c)
  grad.addColorStop(0, 'rgba(0,0,0,0.9)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function lightenHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.round(((n >> 16) & 0xff) + 255 * amount))
  const g = Math.min(255, Math.round(((n >> 8) & 0xff) + 255 * amount))
  const b = Math.min(255, Math.round((n & 0xff) + 255 * amount))
  return `rgb(${r},${g},${b})`
}

function darkenHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)))
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)))
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)))
  return `rgb(${r},${g},${b})`
}

/** Baked 96×96 marker disc: tinted gradient ring, dark gap, white disc, exhibit number. One per marker × tint. */
function buildDiscTexture(num: number | null, tintKey: TintKey): THREE.CanvasTexture {
  const s = 96
  const c = s / 2
  const R_outer = 44
  const R_gap = 30
  const R_disc = 25
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const ctx = cv.getContext('2d')!

  const isDimmed = tintKey === 'coming_soon'
  const ringColor = TINTS[tintKey].color

  // 1. Outer ring: light at top-left → ring color → dark at edge
  ctx.globalAlpha = isDimmed ? 0.65 : 1.0
  const ringGrad = ctx.createRadialGradient(c - 8, c - 8, 0, c, c, R_outer)
  ringGrad.addColorStop(0, lightenHex(ringColor, 0.35))
  ringGrad.addColorStop(0.48, ringColor)
  ringGrad.addColorStop(1, darkenHex(ringColor, 0.25))
  ctx.fillStyle = ringGrad
  ctx.beginPath()
  ctx.arc(c, c, R_outer, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1.0

  // 2. Dark gap ring
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.arc(c, c, R_gap, 0, Math.PI * 2)
  ctx.fill()

  // 3. White disc
  const discGrad = ctx.createRadialGradient(c, c, 0, c, c, R_disc)
  if (isDimmed) {
    discGrad.addColorStop(0, '#f5f5f5')
    discGrad.addColorStop(1, '#e8e8e8')
  } else {
    discGrad.addColorStop(0, '#ffffff')
    discGrad.addColorStop(1, '#efefef')
  }
  ctx.fillStyle = discGrad
  ctx.beginPath()
  ctx.arc(c, c, R_disc, 0, Math.PI * 2)
  ctx.fill()

  // 4. Number (omitted when null — disc stays blank until park number is assigned)
  if (num !== null) {
    ctx.fillStyle = isDimmed ? '#aaaaaa' : '#1c1c1c'
    ctx.font = 'bold 22px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(num), c, c)
  }

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Shared white ring for the breathing aura; tinted via material color. */
function makeAuraTexture(): THREE.CanvasTexture {
  const s = 128
  const c = s / 2
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const ctx = cv.getContext('2d')!
  ctx.strokeStyle = 'rgba(255,255,255,1)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(c, c, c - 4, 0, Math.PI * 2)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Shared white ring for the one-shot tap ripple; tinted via material color. */
function makeRippleTexture(): THREE.CanvasTexture {
  const s = 128
  const c = s / 2
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const ctx = cv.getContext('2d')!
  ctx.strokeStyle = 'rgba(255,255,255,1)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(c, c, c - 3, 0, Math.PI * 2)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

type MarkerEntry = {
  pivot: THREE.Group
  disc: THREE.Mesh
  aura: THREE.Mesh
  ripple: THREE.Mesh
  shadow: THREE.Mesh
  discTextures: Record<TintKey, THREE.CanvasTexture>
  rippleStartMs: number
  prevTintKey: TintKey | null
}

export function createMarkerLayer(opts: {
  map: maplibregl.Map
  getExhibits: () => MarkerInput[]
}): maplibregl.CustomLayerInterface {
  const { map, getExhibits } = opts

  let renderer: THREE.WebGLRenderer
  let scene: THREE.Scene
  let camera: THREE.OrthographicCamera

  let shadowGeometry: THREE.PlaneGeometry
  let shadowTexture: THREE.CanvasTexture
  let discGeometry: THREE.PlaneGeometry
  let auraGeometry: THREE.PlaneGeometry
  let auraTexture: THREE.CanvasTexture
  let rippleTexture: THREE.CanvasTexture

  const markers = new Map<string, MarkerEntry>()
  let activeId: string | null = null
  let activeSince = 0

  function createMarkerEntry(number: number | null): MarkerEntry {
    const pivot = new THREE.Group()

    const discTextures: Record<TintKey, THREE.CanvasTexture> = {
      unvisited: buildDiscTexture(number, 'unvisited'),
      visited: buildDiscTexture(number, 'visited'),
      coming_soon: buildDiscTexture(number, 'coming_soon'),
    }

    const discMat = new THREE.MeshBasicMaterial({
      map: discTextures.unvisited,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    const disc = new THREE.Mesh(discGeometry, discMat)

    const auraMat = new THREE.MeshBasicMaterial({
      map: auraTexture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    })
    const aura = new THREE.Mesh(auraGeometry, auraMat)

    const rippleMat = new THREE.MeshBasicMaterial({
      map: rippleTexture,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    })
    const ripple = new THREE.Mesh(auraGeometry, rippleMat)

    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      color: 0x000000,
      transparent: true,
      opacity: 0.55,
      depthTest: false,
      depthWrite: false,
    })
    const shadow = new THREE.Mesh(shadowGeometry, shadowMat)

    pivot.add(shadow)
    pivot.add(aura)
    pivot.add(ripple)
    pivot.add(disc)
    scene.add(pivot)

    return { pivot, disc, aura, ripple, shadow, discTextures, rippleStartMs: -1, prevTintKey: null }
  }

  function removeMarkerEntry(entry: MarkerEntry): void {
    scene.remove(entry.pivot)
    ;(entry.disc.material as THREE.MeshBasicMaterial).dispose()
    ;(entry.aura.material as THREE.MeshBasicMaterial).dispose()
    ;(entry.ripple.material as THREE.MeshBasicMaterial).dispose()
    ;(entry.shadow.material as THREE.MeshBasicMaterial).dispose()
    for (const tex of Object.values(entry.discTextures)) tex.dispose()
  }

  const layer: maplibregl.CustomLayerInterface = {
    id: 'exhibit-pins-3d',
    type: 'custom',
    renderingMode: '2d',

    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl })
      renderer.autoClear = false

      scene = new THREE.Scene()
      camera = new THREE.OrthographicCamera(0, 1, 0, -1, 0.1, 1000)
      camera.position.z = 10

      shadowGeometry = new THREE.PlaneGeometry(1, 1)
      shadowTexture = makeShadowTexture()
      discGeometry = new THREE.PlaneGeometry(1, 1)
      auraGeometry = discGeometry
      auraTexture = makeAuraTexture()
      rippleTexture = makeRippleTexture()

      renderer.resetState()
    },

    render(_gl, _matrix) {
      renderer.resetState()

      const canvas = map.getCanvas()
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return

      if (camera.right !== width || camera.bottom !== -height) {
        camera.left = 0
        camera.right = width
        camera.top = 0
        camera.bottom = -height
        camera.updateProjectionMatrix()
      }

      const mapState = useMapStore.getState()
      const activeExhibitId = mapState.activeExhibitId
      const nearbyExhibitIds = mapState.nearbyExhibitIds
      const visitedIds = useStore.getState().visitedExhibits
      const forcedMarkerState = useDebugStore.getState().forcedMarkerState

      const now = performance.now()
      // '__forced-active__' is a sentinel that never matches a real exhibit id, so the rise animation
      // triggers whenever forcedMarkerState switches to 'active' regardless of which exhibit is active.
      const activeKey = forcedMarkerState === 'active' ? '__forced-active__' : activeExhibitId
      const prevActiveId = activeId
      if (activeKey !== activeId) {
        activeId = activeKey
        activeSince = now
      }

      const zoom = map.getZoom()
      const lat = map.getCenter().lat
      const pinPx = pinPixelHeight(zoom, lat)

      const exhibits = getExhibits()
      const seen = new Set<string>()
      const placed: Array<{ entry: MarkerEntry; screenY: number; isActive: boolean }> = []
      let forcedNearbyIndex = 0

      for (const exhibit of exhibits) {
        seen.add(exhibit.id)
        let entry = markers.get(exhibit.id)
        if (!entry) {
          entry = createMarkerEntry(exhibit.number)
          markers.set(exhibit.id, entry)
        }

        if (exhibit.id === activeId && exhibit.id !== prevActiveId) {
          entry.rippleStartMs = now
        }

        const projected = map.project([exhibit.lng, exhibit.lat])
        entry.pivot.position.set(projected.x, -projected.y, 0)

        const isComingSoon = exhibit.status === 'coming_soon'
        const isVisited = !isComingSoon && visitedIds.includes(exhibit.id)
        const realTintKey: TintKey = isComingSoon
          ? 'coming_soon'
          : isVisited
            ? 'visited'
            : 'unvisited'

        let tintKey = realTintKey
        let isActive = exhibit.id === activeExhibitId
        let nearbyIndex = nearbyExhibitIds.indexOf(exhibit.id)
        let isNearby = !isActive && !isComingSoon && !isVisited && nearbyIndex !== -1

        if (forcedMarkerState) {
          isActive = forcedMarkerState === 'active'
          isNearby = forcedMarkerState === 'nearby'
          nearbyIndex = isNearby ? forcedNearbyIndex++ : -1
          tintKey =
            forcedMarkerState === 'visited' || forcedMarkerState === 'coming_soon'
              ? forcedMarkerState
              : forcedMarkerState === 'unvisited' || forcedMarkerState === 'nearby'
                ? 'unvisited'
                : realTintKey
        }

        // Disc: size, position, state texture
        entry.disc.scale.set(pinPx, pinPx, 1)
        if (tintKey !== entry.prevTintKey) {
          ;(entry.disc.material as THREE.MeshBasicMaterial).map = entry.discTextures[tintKey]
          ;(entry.disc.material as THREE.MeshBasicMaterial).needsUpdate = true
          entry.prevTintKey = tintKey
        }

        // Rise + shadow shrink
        let riseOffsetPx = 0
        let shadowDiameterPx = 0.44 * pinPx
        let shadowOpacity = 0.55

        if (isActive) {
          const elapsed = now - activeSince
          const riseT = easeOutCubic(Math.min(elapsed / RISE_DURATION_MS, 1))
          riseOffsetPx = 0.32 * pinPx * riseT
          shadowDiameterPx = lerp(0.44 * pinPx, 0.26 * pinPx, riseT)
          shadowOpacity = lerp(0.55, 0.25, riseT)
        }

        entry.disc.position.set(0, riseOffsetPx, 0)
        entry.shadow.scale.set(shadowDiameterPx, shadowDiameterPx * 0.32, 1)
        ;(entry.shadow.material as THREE.MeshBasicMaterial).opacity = shadowOpacity

        // Breathe aura (nearby only)
        if (isNearby) {
          const auraFrac =
            (Math.sin(((now % AURA_PERIOD_MS) / AURA_PERIOD_MS) * Math.PI * 2) + 1) / 2
          const auraScale = lerp(1, 1.14, auraFrac) * pinPx
          entry.aura.scale.set(auraScale, auraScale, 1)
          entry.aura.position.set(0, riseOffsetPx, 0)
          ;(entry.aura.material as THREE.MeshBasicMaterial).opacity = lerp(0.12, 0.38, auraFrac)
        } else {
          ;(entry.aura.material as THREE.MeshBasicMaterial).opacity = 0
        }

        // One-shot ripple
        const rippleElapsed = now - entry.rippleStartMs
        if (entry.rippleStartMs >= 0 && rippleElapsed < RIPPLE_DURATION_MS) {
          const t = rippleElapsed / RIPPLE_DURATION_MS
          const rs = lerp(1, 1.9, t) * pinPx
          entry.ripple.scale.set(rs, rs, 1)
          entry.ripple.position.set(0, riseOffsetPx, 0)
          ;(entry.ripple.material as THREE.MeshBasicMaterial).opacity = lerp(0.6, 0, t)
        } else {
          ;(entry.ripple.material as THREE.MeshBasicMaterial).opacity = 0
        }

        placed.push({ entry, screenY: projected.y, isActive })
      }

      for (const [id, entry] of markers) {
        if (!seen.has(id)) {
          removeMarkerEntry(entry)
          markers.delete(id)
        }
      }

      // Back-to-front by projected screen y; the active marker always draws last.
      placed.sort((a, b) => a.screenY - b.screenY)
      let order = 0
      for (const p of placed) {
        if (p.isActive) continue
        p.entry.shadow.renderOrder = order++
        p.entry.aura.renderOrder = order++
        p.entry.ripple.renderOrder = order++
        p.entry.disc.renderOrder = order++
      }
      for (const p of placed) {
        if (!p.isActive) continue
        p.entry.shadow.renderOrder = order++
        p.entry.aura.renderOrder = order++
        p.entry.ripple.renderOrder = order++
        p.entry.disc.renderOrder = order++
      }

      renderer.render(scene, camera)

      let hasActiveRipple = false
      for (const e of markers.values()) {
        if (e.rippleStartMs >= 0 && now - e.rippleStartMs < RIPPLE_DURATION_MS) {
          hasActiveRipple = true
          break
        }
      }
      const shouldRepaint = forcedMarkerState
        ? forcedMarkerState === 'active' || forcedMarkerState === 'nearby'
        : activeExhibitId !== null || nearbyExhibitIds.length > 0 || hasActiveRipple
      if (shouldRepaint) {
        map.triggerRepaint()
      }
    },

    onRemove() {
      for (const [, entry] of markers) {
        removeMarkerEntry(entry)
      }
      markers.clear()

      shadowGeometry.dispose()
      shadowTexture.dispose()
      discGeometry.dispose() // auraGeometry shares this instance
      auraTexture.dispose()
      rippleTexture.dispose()

      renderer.dispose()
    },
  }

  return layer
}
