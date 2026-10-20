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
  number: number
}

const RISE_DURATION_MS = 400
const MARKER_DESIGN_PX = 56

type TintKey = 'unvisited' | 'visited' | 'coming_soon'

const TINTS: Record<TintKey, { color: string; dimmed: boolean }> = {
  unvisited: { color: '#dda15e', dimmed: false },
  visited: { color: '#588157', dimmed: false },
  coming_soon: { color: '#8f8f8f', dimmed: true },
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function smoothstep(v: number): number {
  return v * v * (3 - 2 * v)
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

/** Disposes every geometry/material/map found under `root`. For the throwaway studio env scene. */
function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const material = child.material as THREE.MeshBasicMaterial
      material.map?.dispose()
      material.dispose()
    }
  })
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
function buildDiscTexture(num: number, tintKey: TintKey): THREE.CanvasTexture {
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

  // 4. Number
  ctx.fillStyle = isDimmed ? '#aaaaaa' : '#1c1c1c'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(num), c, c)

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
  let faceZ = 0
  let discGeometry: THREE.PlaneGeometry
  let auraGeometry: THREE.PlaneGeometry
  let auraTexture: THREE.CanvasTexture
  let rippleTexture: THREE.CanvasTexture
  let shadowMaterial: THREE.MeshBasicMaterial

  const markers = new Map<string, MarkerEntry>()
  let activeId: string | null = null
  let activeSince = 0

  function createMarkerEntry(number: number): MarkerEntry {
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

    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial)

    pivot.add(shadow)
    pivot.add(aura)
    pivot.add(ripple)
    pivot.add(disc)
    scene.add(pivot)

    return { pivot, disc, aura, ripple, shadow, discTextures, rippleStartMs: -1 }
  }

  function removeMarkerEntry(entry: MarkerEntry): void {
    scene.remove(entry.pivot)
    ;(entry.disc.material as THREE.MeshBasicMaterial).dispose()
    ;(entry.aura.material as THREE.MeshBasicMaterial).dispose()
    ;(entry.ripple.material as THREE.MeshBasicMaterial).dispose()
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
      auraGeometry = new THREE.PlaneGeometry(1, 1)
      auraTexture = makeAuraTexture()
      rippleTexture = makeRippleTexture()
      shadowMaterial = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        color: 0x000000,
        transparent: true,
        opacity: 0.55,
        depthTest: false,
        depthWrite: false,
      })

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
      // The debug override bypasses activeExhibitId entirely, so track it as its own key —
      // otherwise toggling the "active" debug button mid-session drops the rise-and-spin into
      // whatever phase performance.now() happens to be at, instead of starting fresh.
      const activeKey = forcedMarkerState === 'active' ? FORCED_ACTIVE_KEY : activeExhibitId
      if (activeKey !== activeId) {
        activeId = activeKey
        activeSince = now
      }

      const zoom = map.getZoom()
      const lat = map.getCenter().lat
      const pinPx = pinPixelHeight(zoom, lat)
      const scaleFactor = pinPx / PIN_UNITS_H

      const exhibits = getExhibits()
      const seen = new Set<string>()
      const placed: Array<{ entry: MarkerEntry; screenY: number; isActive: boolean }> = []
      let forcedNearbyIndex = 0

      for (const exhibit of exhibits) {
        seen.add(exhibit.id)
        let entry = markers.get(exhibit.id)
        if (!entry) {
          entry = createMarkerEntry()
          markers.set(exhibit.id, entry)
        }

        const projected = map.project([exhibit.lng, exhibit.lat])
        const worldX = projected.x
        const worldY = -projected.y

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

        entry.pivot.position.set(worldX, worldY, 0)
        entry.pin.scale.setScalar(scaleFactor)
        entry.pin.material = isActive ? activeMaterials[tintKey] : baseMaterials[tintKey]

        let riseOffsetPx = 0
        let shadowDiameterPx = 0.44 * pinPx
        let shadowOpacity = 0.55

        if (isActive) {
          const elapsed = now - activeSince
          const riseT = easeOutCubic(Math.min(elapsed / RISE_DURATION_MS, 1))
          riseOffsetPx = 0.32 * pinPx * riseT
          shadowDiameterPx = lerp(0.44 * pinPx, 0.26 * pinPx, riseT)
          shadowOpacity = lerp(0.55, 0.25, riseT)

          const spinElapsed = Math.max(elapsed - RISE_DURATION_MS, 0)
          entry.pin.rotation.y = ((spinElapsed / SPIN_DURATION_MS) % 1) * Math.PI * 2
          entry.shadow.material = activeShadowMaterial
          activeShadowMaterial.opacity = shadowOpacity
        } else {
          entry.pin.rotation.y = 0
          entry.shadow.material = baseShadowMaterial
        }

        entry.pin.position.set(0, TIP_OFFSET * scaleFactor + riseOffsetPx, 0)
        entry.shadow.scale.set(shadowDiameterPx, shadowDiameterPx * 0.32, 1)

        entry.sparkle.visible = isNearby
        if (isNearby) {
          const phaseMs = nearbyIndex * SPARKLE_STAGGER_MS
          const t = ((now + phaseMs) % SPARKLE_DURATION_MS) / SPARKLE_DURATION_MS
          const grow = smoothstep(Math.min(t / 0.55, 1))
          const fade = t < 0.7 ? smoothstep(Math.min(t / 0.18, 1)) : smoothstep((1 - t) / 0.3)

          const sparklePx = Math.max(0.28 * pinPx, 16) * grow
          const sizeLocal = sparklePx / scaleFactor
          entry.sparkle.scale.set(sizeLocal, sizeLocal, 1)
          entry.sparkle.position.set(SPARK_X, SPARK_BASE_Y + sizeLocal / 2, faceZ + 0.02)
          const sparkleMaterial = entry.sparkle.material as THREE.SpriteMaterial
          sparkleMaterial.opacity = fade
          sparkleMaterial.rotation = grow * 0.3
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
        p.entry.pin.renderOrder = order++
        p.entry.sparkle.renderOrder = order++
      }
      for (const p of placed) {
        if (!p.isActive) continue
        p.entry.shadow.renderOrder = order++
        p.entry.pin.renderOrder = order++
        p.entry.sparkle.renderOrder = order++
      }

      // Fresh depth buffer for the active pin's self-depth-tested material (see makeStandardMaterial);
      // every other material here has depthWrite:false, so nothing else is affected and nothing
      // leaks into Mapbox's own depth buffer on the next frame.
      renderer.clearDepth()
      renderer.render(scene, camera)

      const shouldRepaint = forcedMarkerState
        ? forcedMarkerState === 'active' || forcedMarkerState === 'nearby'
        : activeExhibitId !== null || nearbyExhibitIds.length > 0
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
      discGeometry.dispose()
      auraGeometry.dispose()
      auraTexture.dispose()
      rippleTexture.dispose()
      shadowMaterial.dispose()

      renderer.dispose()
    },
  }

  return layer
}
