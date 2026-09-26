import * as THREE from 'three'
import type mapboxgl from 'mapbox-gl'
import { useMapStore } from '@/lib/map-store'
import { useStore } from '@/lib/store'
import { useDebugStore } from '@/lib/debug-store'
import { pinPixelHeight } from '@/lib/nearby'

export type MarkerInput = {
  id: string
  lat: number
  lng: number
  status: 'live' | 'coming_soon'
}

// ── Pin geometry, ported verbatim from sample-map/marker-3d.html ──────────
const R = 1.0 // head radius
const TIP = 2.05 // head centre → tip
const HOLE = 0.63 // hole radius
const DEPTH = 0.34
const BEVEL_THICKNESS = 0.15
const BEVEL_SIZE = 0.13
const BEVEL_SEGMENTS = 16
const CURVE_SEGMENTS = 128

// Derived, after geo.center(): bbox min [-1.13, -1.682, -0.32] max [1.13, 1.682, 0.32]
const PIN_UNITS_H = 3.364 // full pin height in pin units
const TIP_OFFSET = 1.682 // tip sits this far below the mesh origin

const RISE_DURATION_MS = 400
const SPIN_DURATION_MS = 2200
const SPARKLE_DURATION_MS = 1000
const SPARKLE_STAGGER_MS = 200
const ACTIVE_ENV_MAP_INTENSITY = 2.0
const FORCED_ACTIVE_KEY = '__forced-active__'

// Sparkle anchor, in pin-local units — off the front face, top-right of the head band.
const SPARK_X = 0.54
const SPARK_BASE_Y = 0.92

type TintKey = 'unvisited' | 'visited' | 'coming_soon'

const TINTS: Record<
  TintKey,
  { color: number; metalness: number; roughness: number; envMapIntensity: number }
> = {
  unvisited: { color: 0xdda15e, metalness: 0.96, roughness: 0.11, envMapIntensity: 1.4 },
  visited: { color: 0x588157, metalness: 0.96, roughness: 0.11, envMapIntensity: 1.4 },
  coming_soon: { color: 0x9e7548, metalness: 0.9, roughness: 0.35, envMapIntensity: 0.7 },
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

/** The pin silhouette: a circle with a concentric hole, tangent lines down to a tip. */
function buildPinGeometry(): THREE.ExtrudeGeometry {
  const tx = (R * Math.sqrt(TIP * TIP - R * R)) / TIP
  const ty = -(R * R) / TIP
  const aRight = Math.atan2(ty, tx)
  const aLeft = Math.PI - aRight

  const shape = new THREE.Shape()
  shape.moveTo(0, -TIP)
  shape.lineTo(tx, ty)
  shape.absarc(0, 0, R, aRight, aLeft, false)
  shape.lineTo(0, -TIP)

  const hole = new THREE.Path()
  hole.absarc(0, 0, HOLE, 0, Math.PI * 2, true)
  shape.holes.push(hole)

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: BEVEL_THICKNESS,
    bevelSize: BEVEL_SIZE,
    bevelOffset: 0,
    bevelSegments: BEVEL_SEGMENTS,
    curveSegments: CURVE_SEGMENTS,
  })
  geo.center()
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  return geo
}

/**
 * Studio lightbox environment, ported verbatim from sample-map/marker-3d.html.
 * A polished metal is almost pure reflection, so its look is decided by this
 * environment map, not by scene lights. Panel colours are pushed above 1.0 so
 * they read as HDR light sources. Panels behind the camera are load-bearing —
 * without them the mirror-like front face has nothing to reflect and goes black.
 */
function buildStudioEnv(): THREE.Scene {
  const env = new THREE.Scene()
  env.background = new THREE.Color(0x1a1a1a)

  const quad = new THREE.PlaneGeometry(1, 1)
  const panel = (
    w: number,
    h: number,
    pos: [number, number, number],
    rot: [number, number, number],
    intensity: number
  ) => {
    const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    m.color.setRGB(intensity, intensity * 0.97, intensity * 0.93)
    const mesh = new THREE.Mesh(quad, m)
    mesh.scale.set(w, h, 1)
    mesh.position.set(...pos)
    mesh.rotation.set(...rot)
    env.add(mesh)
  }

  // Large overhead softbox — the dominant highlight across the top
  panel(14, 14, [0, 7, 0], [Math.PI / 2, 0, 0], 11)
  // Tall front-left and front-right strips — long vertical streaks
  panel(3.5, 13, [-6, 1, 3.5], [0, Math.PI / 2.6, 0], 9)
  panel(3.5, 13, [6, 1, 3.5], [0, -Math.PI / 2.6, 0], 9)
  // Low front kicker — lifts the cone so it doesn't go black
  panel(11, 3, [0, -5, 5], [-Math.PI / 6, 0, 0], 5.5)

  // Panels BEHIND the camera, kept as separate bars (not one wash) so they read
  // as distinct specular streaks rather than a flat uniform face.
  panel(9, 2.4, [-3.2, 5.5, 10], [0, 0, 0], 5.0) // upper bar
  panel(2.4, 9, [-6.5, 0.5, 10], [0, 0, 0], 3.4) // left vertical bar
  panel(7, 1.8, [4.5, -4.0, 10], [0, 0, 0], 2.2) // lower-right kicker

  // Backdrop behind the camera, carrying a bright-to-dark vertical ramp — the
  // large flat faces are mirrors far from camera, so a uniform backdrop would
  // render as a flat slab; the ramp gives them a top-to-bottom gradient.
  const ramp = document.createElement('canvas')
  ramp.width = 4
  ramp.height = 256
  const rctx = ramp.getContext('2d')!
  const grad = rctx.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0.0, '#ffffff')
  grad.addColorStop(0.45, '#8f8f8f')
  grad.addColorStop(1.0, '#101010')
  rctx.fillStyle = grad
  rctx.fillRect(0, 0, 4, 256)
  const rampTex = new THREE.CanvasTexture(ramp)
  rampTex.colorSpace = THREE.SRGBColorSpace

  const rampMat = new THREE.MeshBasicMaterial({ map: rampTex, side: THREE.DoubleSide })
  rampMat.color.setScalar(1.5) // lift into HDR so it reads as a light source
  const rampMesh = new THREE.Mesh(quad, rampMat)
  rampMesh.scale.set(26, 20, 1)
  rampMesh.position.set(0, 0, 15)
  env.add(rampMesh)

  // Dim back wall for falloff on the rear edges
  panel(14, 14, [0, 0, -9], [0, 0, 0], 1.6)

  return env
}

/** Specular glint texture, ported verbatim: a blown-out core, needle spikes, warm gold falloff. */
function makeSparkleTexture(): THREE.CanvasTexture {
  const s = 256
  const c = s / 2
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const x = cv.getContext('2d')!
  x.globalCompositeOperation = 'lighter' // accumulate like real light

  const core = x.createRadialGradient(c, c, 0, c, c, s * 0.13)
  core.addColorStop(0.0, 'rgba(255,255,255,1)')
  core.addColorStop(0.35, 'rgba(255,248,232,0.95)')
  core.addColorStop(1.0, 'rgba(255,214,150,0)')
  x.fillStyle = core
  x.fillRect(0, 0, s, s)

  const halo = x.createRadialGradient(c, c, 0, c, c, s * 0.34)
  halo.addColorStop(0.0, 'rgba(255,229,182,0.5)')
  halo.addColorStop(1.0, 'rgba(255,200,130,0)')
  x.fillStyle = halo
  x.fillRect(0, 0, s, s)

  const spike = (angle: number, len: number, halfw: number) => {
    x.save()
    x.translate(c, c)
    x.rotate(angle)
    const g = x.createLinearGradient(0, 0, len, 0)
    g.addColorStop(0.0, 'rgba(255,255,255,1)')
    g.addColorStop(0.2, 'rgba(255,248,233,0.85)')
    g.addColorStop(0.6, 'rgba(255,224,172,0.4)')
    g.addColorStop(1.0, 'rgba(255,209,146,0)')
    x.fillStyle = g
    x.beginPath()
    x.moveTo(0, -halfw)
    x.lineTo(len, 0)
    x.lineTo(0, halfw)
    x.closePath()
    x.fill()
    x.restore()
  }

  const L = c * 0.97
  for (let i = 0; i < 4; i++) spike((i * Math.PI) / 2, L, s * 0.038)
  for (let i = 0; i < 4; i++) spike(Math.PI / 4 + (i * Math.PI) / 2, L * 0.32, s * 0.024)

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
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

function makeStandardMaterial(
  tint: {
    color: number
    metalness: number
    roughness: number
    envMapIntensity: number
  },
  selfDepthSorted = false
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: tint.color,
    metalness: tint.metalness,
    roughness: tint.roughness,
    envMapIntensity: tint.envMapIntensity,
    // Static pins never rotate, so their front/hole/back faces never overlap on screen and
    // depthTest:false (required so we don't touch Mapbox's own depth buffer) is harmless. The
    // active pin spins, and a depthless solid extrusion with a through-hole self-intersects at
    // most yaw angles — its own faces draw in submission order instead of front-to-back. So the
    // active variant opts into real depth testing; render() clears the depth buffer every frame
    // first, and no other material in this layer writes depth, so this can't leak into Mapbox's own
    // buffer or affect inter-marker draw order (still governed by the screen-y renderOrder sort).
    depthTest: selfDepthSorted,
    depthWrite: selfDepthSorted,
  })
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

type MarkerEntry = {
  pivot: THREE.Group
  pin: THREE.Mesh
  shadow: THREE.Mesh
  sparkle: THREE.Sprite
}

export function createMarkerLayer(opts: {
  map: mapboxgl.Map
  getExhibits: () => MarkerInput[]
}): mapboxgl.CustomLayerInterface {
  const { map, getExhibits } = opts

  let renderer: THREE.WebGLRenderer
  let scene: THREE.Scene
  let camera: THREE.OrthographicCamera
  let pmremRenderTarget: THREE.WebGLRenderTarget | null = null

  let pinGeometry: THREE.ExtrudeGeometry
  let shadowGeometry: THREE.PlaneGeometry
  let shadowTexture: THREE.CanvasTexture
  let sparkleTexture: THREE.CanvasTexture
  let faceZ = 0

  let baseMaterials: Record<TintKey, THREE.MeshStandardMaterial>
  let activeMaterials: Record<TintKey, THREE.MeshStandardMaterial>
  let baseShadowMaterial: THREE.MeshBasicMaterial
  let activeShadowMaterial: THREE.MeshBasicMaterial

  const markers = new Map<string, MarkerEntry>()
  let activeId: string | null = null
  let activeSince = 0

  function createMarkerEntry(): MarkerEntry {
    const pivot = new THREE.Group()

    const shadow = new THREE.Mesh(shadowGeometry, baseShadowMaterial)

    const pin = new THREE.Mesh(pinGeometry, baseMaterials.unvisited)

    const sparkleMaterial = new THREE.SpriteMaterial({
      map: sparkleTexture,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })
    const sparkle = new THREE.Sprite(sparkleMaterial)
    sparkle.visible = false
    pin.add(sparkle)

    pivot.add(shadow)
    pivot.add(pin)
    scene.add(pivot)

    return { pivot, pin, shadow, sparkle }
  }

  function removeMarkerEntry(entry: MarkerEntry): void {
    scene.remove(entry.pivot)
    entry.sparkle.material.dispose()
  }

  const layer: mapboxgl.CustomLayerInterface = {
    id: 'exhibit-pins-3d',
    type: 'custom',
    renderingMode: '2d',

    onAdd(_map, gl) {
      renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl })
      renderer.autoClear = false
      // Ported from marker-3d.html: HDR studio panels need the roll-off, or highlights clip to flat white.
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.0

      scene = new THREE.Scene()
      camera = new THREE.OrthographicCamera(0, 1, 0, -1, 0.1, 1000)
      camera.position.z = 10

      pinGeometry = buildPinGeometry()
      faceZ = pinGeometry.boundingBox!.max.z

      shadowGeometry = new THREE.PlaneGeometry(1, 1)
      shadowTexture = makeShadowTexture()
      sparkleTexture = makeSparkleTexture()

      baseMaterials = {
        unvisited: makeStandardMaterial(TINTS.unvisited),
        visited: makeStandardMaterial(TINTS.visited),
        coming_soon: makeStandardMaterial(TINTS.coming_soon),
      }
      activeMaterials = {
        unvisited: makeStandardMaterial(
          { ...TINTS.unvisited, envMapIntensity: ACTIVE_ENV_MAP_INTENSITY },
          true
        ),
        visited: makeStandardMaterial(
          { ...TINTS.visited, envMapIntensity: ACTIVE_ENV_MAP_INTENSITY },
          true
        ),
        coming_soon: makeStandardMaterial(
          { ...TINTS.coming_soon, envMapIntensity: ACTIVE_ENV_MAP_INTENSITY },
          true
        ),
      }

      baseShadowMaterial = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        color: 0x000000,
        transparent: true,
        opacity: 0.55,
        depthTest: false,
        depthWrite: false,
      })
      activeShadowMaterial = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        color: 0x000000,
        transparent: true,
        opacity: 0.55,
        depthTest: false,
        depthWrite: false,
      })

      const pmrem = new THREE.PMREMGenerator(renderer)
      pmrem.compileEquirectangularShader()
      const studioEnv = buildStudioEnv()
      pmremRenderTarget = pmrem.fromScene(studioEnv, 0.02)
      scene.environment = pmremRenderTarget.texture
      pmrem.dispose()
      disposeObject3D(studioEnv)

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

      pinGeometry.dispose()
      shadowGeometry.dispose()
      shadowTexture.dispose()
      sparkleTexture.dispose()

      for (const key of Object.keys(baseMaterials) as TintKey[]) {
        baseMaterials[key].dispose()
        activeMaterials[key].dispose()
      }
      baseShadowMaterial.dispose()
      activeShadowMaterial.dispose()

      pmremRenderTarget?.dispose()
      pmremRenderTarget = null

      renderer.dispose()
    },
  }

  return layer
}
