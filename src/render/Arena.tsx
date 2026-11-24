import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GameEngine } from '../core/engine'
import { TABLE, PUCK_R, PADDLE_R, PUCK_MAX_SPEED } from '../core/constants'
import { clamp } from '../core/util'

/** Table units -> three.js: x -> x, table y -> -z, so the player (y < 0) is nearest the camera. */
export interface ArenaApi { toTable: ((cx: number, cy: number) => { x: number; y: number } | null) | null }
export interface ArenaProps { engine: GameEngine; api: ArenaApi; oppColor: string; shake: boolean; quality: 'high' | 'low'; playerColor?: string; puckColor?: string; light?: boolean }

export const PLAYER_COLOR = '#3df5ff'
const TRAIL_N = 22
const PART_N = 220

// ------------------------------------------------------------------ assets
function makeTableTexture(opp: string, pc: string, light: boolean) {
  const S = 1024 // pixels per table unit (both axes)
  const c = document.createElement('canvas')
  c.width = S * TABLE.W
  c.height = S * TABLE.L
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, c.height)
  if (light) { grd.addColorStop(0, '#c3d6fa'); grd.addColorStop(0.5, '#dbe7ff'); grd.addColorStop(1, '#c3d6fa') } else { grd.addColorStop(0, '#0d2a52'); grd.addColorStop(0.5, '#0a1d3d'); grd.addColorStop(1, '#0d2a52') }
  g.fillStyle = grd
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = light ? 'rgba(30,70,150,0.16)' : 'rgba(130,200,255,0.10)' // air holes
  for (let y = 16; y < c.height; y += 32) for (let x = 16 + ((y / 32) % 2) * 16; x < c.width; x += 32) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill() }
  const X = (x: number) => (x + TABLE.W / 2) * S
  const Y = (y: number) => (TABLE.L / 2 - y) * S // table +y (AI end) is the top of the texture
  const line = light ? '#1a8fbf' : '#3df5ff'
  const glow = (col: string, w: number, f: () => void) => {
    g.save(); g.strokeStyle = col; g.lineWidth = w; g.shadowColor = col; g.shadowBlur = light ? 8 : 18; g.lineCap = 'round'; f(); g.restore()
  }
  glow(line, 6, () => { g.beginPath(); g.moveTo(X(-TABLE.W / 2), Y(0)); g.lineTo(X(TABLE.W / 2), Y(0)); g.stroke() })
  glow(line, 5, () => { g.beginPath(); g.arc(X(0), Y(0), 0.2 * S, 0, Math.PI * 2); g.stroke() })
  glow(light ? '#5b78b5' : '#ffffff', 3, () => { g.beginPath(); g.arc(X(0), Y(0), 0.02 * S, 0, Math.PI * 2); g.stroke() })
  glow(line, 5, () => { g.beginPath(); g.arc(X(0), Y(-TABLE.L / 2), 0.3 * S, Math.PI, 2 * Math.PI); g.stroke() })
  glow(opp, 5, () => { g.beginPath(); g.arc(X(0), Y(TABLE.L / 2), 0.3 * S, 0, Math.PI); g.stroke() })
  for (const [yy, col] of [[-1, pc], [1, opp]] as const) {
    glow(col, 7, () => { g.beginPath(); g.moveTo(X(-TABLE.goalW / 2), Y(yy)); g.lineTo(X(TABLE.goalW / 2), Y(yy)); g.stroke() })
  }
  for (const [yy, col] of [[-0.75, pc], [0.75, opp]] as const) { // home spots
    glow(col, 3, () => { g.beginPath(); g.arc(X(0), Y(yy), PADDLE_R * S * 1.15, 0, Math.PI * 2); g.stroke() })
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function makeAssets(opp: string, quality: 'high' | 'low', pc: string, uc: string, light: boolean) {
  const table = makeTableTexture(opp, pc, light)
  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []
  const G = <T extends THREE.BufferGeometry>(g: T) => { geos.push(g); return g }
  const M = <T extends THREE.Material>(m: T) => { mats.push(m); return m }
  const oppC = new THREE.Color(opp)
  const pcC = new THREE.Color(pc)
  const padBody = pcC.clone().multiplyScalar(0.32)
  const handleC = pcC.clone().lerp(new THREE.Color('#ffffff'), 0.72)
  const a = {
    table,
    tableMat: M(new THREE.MeshPhysicalMaterial({ map: table, roughness: 0.2, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06, transparent: quality === 'high', opacity: quality === 'high' ? 0.86 : 1 })),
    baseMat: M(new THREE.MeshStandardMaterial({ color: light ? '#8ea4d2' : '#050912', roughness: 0.9 })),
    wallMat: M(new THREE.MeshStandardMaterial({ color: light ? '#7f98cc' : '#17254a', roughness: 0.35, metalness: 0.65 })),
    pocketMat: M(new THREE.MeshStandardMaterial({ color: '#02040a', roughness: 1 })),
    neonP: M(new THREE.MeshBasicMaterial({ color: pcC, toneMapped: false })),
    neonO: M(new THREE.MeshBasicMaterial({ color: oppC, toneMapped: false })),
    puckMat: M(new THREE.MeshStandardMaterial({ color: uc, emissive: new THREE.Color(uc), emissiveIntensity: 0.32, roughness: 0.25, metalness: 0.3 })),
    puckTop: M(new THREE.MeshStandardMaterial({ color: '#0b1226', roughness: 0.5 })),
    padP: M(new THREE.MeshStandardMaterial({ color: padBody, roughness: 0.3, metalness: 0.7, emissive: pcC, emissiveIntensity: 0.3 })),
    padO: M(new THREE.MeshStandardMaterial({ color: '#1a0d1c', roughness: 0.3, metalness: 0.7, emissive: oppC, emissiveIntensity: 0.18 })),
    handleP: M(new THREE.MeshStandardMaterial({ color: handleC, roughness: 0.25, metalness: 0.8 })),
    handleO: M(new THREE.MeshStandardMaterial({ color: '#ffe0ea', roughness: 0.25, metalness: 0.8 })),
    trailMat: M(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
    partMat: M(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
    puckGeo: G(new THREE.CylinderGeometry(PUCK_R, PUCK_R, 0.03, 32)),
    puckTopGeo: G(new THREE.CylinderGeometry(PUCK_R * 0.68, PUCK_R * 0.68, 0.034, 32)),
    padGeo: G(new THREE.CylinderGeometry(PADDLE_R, PADDLE_R * 1.02, 0.026, 40)),
    ringGeo: G(new THREE.TorusGeometry(PADDLE_R * 0.9, 0.0055, 8, 40)),
    handleGeo: G(new THREE.CylinderGeometry(0.026, 0.034, 0.05, 24)),
    knobGeo: G(new THREE.SphereGeometry(0.03, 20, 14)),
    trailGeo: G(new THREE.CircleGeometry(PUCK_R * 0.92, 18).rotateX(-Math.PI / 2)),
    partGeo: G(new THREE.IcosahedronGeometry(0.011, 0)),
  }
  return { ...a, dispose() { table.dispose(); geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()) } }
}
type Assets = ReturnType<typeof makeAssets>

// ------------------------------------------------------------------ static table + walls
function Walls({ a }: { a: Assets }) {
  const { W, L, goalW, wallT, wallH, pocket } = TABLE
  const hw = (W / 2 + wallT - goalW / 2) / 2
  const segs: JSX.Element[] = []
  let k = 0
  for (const s of [-1, 1]) {
    segs.push(<mesh key={k++} position={[s * (W / 2 + wallT / 2), wallH / 2, 0]} material={a.wallMat} castShadow receiveShadow><boxGeometry args={[wallT, wallH, L + 2 * wallT]} /></mesh>)
    segs.push(<mesh key={k++} position={[s * (W / 2 + 0.004), wallH + 0.002, 0]} material={a.neonP}><boxGeometry args={[0.008, 0.004, L]} /></mesh>)
    for (const e of [-1, 1]) {
      const neon = e < 0 ? a.neonP : a.neonO
      segs.push(<mesh key={k++} position={[s * (goalW / 2 + hw), wallH / 2, -e * (L / 2 + wallT / 2)]} material={a.wallMat} castShadow receiveShadow><boxGeometry args={[2 * hw, wallH, wallT]} /></mesh>)
      segs.push(<mesh key={k++} position={[s * (goalW / 2 + hw), wallH + 0.002, -e * (L / 2 + 0.004)]} material={neon}><boxGeometry args={[2 * hw, 0.004, 0.008]} /></mesh>)
      segs.push(<mesh key={k++} position={[s * (goalW / 2 + 0.01), wallH / 2, -e * (L / 2 + wallT + pocket / 2)]} material={a.wallMat}><boxGeometry args={[0.02, wallH, pocket]} /></mesh>)
    }
  }
  for (const e of [-1, 1]) {
    segs.push(<mesh key={k++} position={[0, -0.004, -e * (L / 2 + wallT + pocket / 2)]} material={a.pocketMat}><boxGeometry args={[goalW, 0.008, pocket]} /></mesh>)
    segs.push(<mesh key={k++} position={[0, wallH / 2, -e * (L / 2 + wallT + pocket + 0.01)]} material={a.pocketMat}><boxGeometry args={[goalW + 0.04, wallH, 0.02]} /></mesh>)
  }
  return <group>{segs}</group>
}

function PuckParts({ a, shadow }: { a: Assets; shadow: boolean }) {
  return (
    <>
      <mesh geometry={a.puckGeo} material={a.puckMat} position={[0, 0.016, 0]} castShadow={shadow} />
      <mesh geometry={a.puckTopGeo} material={a.puckTop} position={[0, 0.016, 0]} />
    </>
  )
}
function PaddleParts({ a, mine, shadow }: { a: Assets; mine: boolean; shadow: boolean }) {
  return (
    <>
      <mesh geometry={a.padGeo} material={mine ? a.padP : a.padO} position={[0, 0.014, 0]} castShadow={shadow} />
      <mesh geometry={a.ringGeo} material={mine ? a.neonP : a.neonO} position={[0, 0.028, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={a.handleGeo} material={mine ? a.handleP : a.handleO} position={[0, 0.05, 0]} castShadow={shadow} />
      <mesh geometry={a.knobGeo} material={mine ? a.handleP : a.handleO} position={[0, 0.082, 0]} scale={[1, 0.7, 1]} castShadow={shadow} />
    </>
  )
}

// ------------------------------------------------------------------ dynamic scene
function Scene({ engine, api, oppColor, shake, quality, playerColor = PLAYER_COLOR, puckColor = '#e8f0ff', light = false }: ArenaProps) {
  const { camera, size, gl } = useThree()
  const assets = useMemo(() => makeAssets(oppColor, quality, playerColor, puckColor, light), [oppColor, quality, playerColor, puckColor, light])
  useEffect(() => () => assets.dispose(), [assets])

  const puck = useRef<THREE.Group>(null)
  const puckM = useRef<THREE.Group>(null)
  const pads = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const padsM = [useRef<THREE.Group>(null), useRef<THREE.Group>(null)]
  const puckLight = useRef<THREE.PointLight>(null)
  const flashLight = useRef<THREE.PointLight>(null)
  const trail = useRef<THREE.InstancedMesh>(null)
  const parts = useRef<THREE.InstancedMesh>(null)
  const base = useRef(new THREE.Vector3())
  const fx = useRef({ shake: 0, flash: 0 })
  const hist = useRef<{ x: number; z: number }[]>([])
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), c: new THREE.Color(), tc: new THREE.Color(), player: new THREE.Color(playerColor), puck: new THREE.Color(puckColor), opp: new THREE.Color(oppColor), hot: new THREE.Color('#ffffff') }), [oppColor, playerColor, puckColor])
  const P = useMemo(() => ({
    x: new Float32Array(PART_N), y: new Float32Array(PART_N), z: new Float32Array(PART_N),
    vx: new Float32Array(PART_N), vy: new Float32Array(PART_N), vz: new Float32Array(PART_N),
    life: new Float32Array(PART_N), max: new Float32Array(PART_N),
    r: new Float32Array(PART_N), g: new Float32Array(PART_N), b: new Float32Array(PART_N), head: 0,
  }), [])

  // ---- camera: fit the whole table + goals for any aspect ratio, leaving room for the HUD
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = 38
    cam.aspect = size.width / Math.max(1, size.height)
    cam.near = 0.1; cam.far = 40
    const el = THREE.MathUtils.degToRad(size.width > size.height * 1.1 ? 58 : 64)
    const corners = [[-0.62, -1.3], [0.62, -1.3], [-0.62, 1.3], [0.62, 1.3]].map(([x, z]) => new THREE.Vector3(x, 0, z))
    let d = 2
    for (; d < 14; d += 0.04) {
      cam.position.set(0, Math.sin(el) * d, Math.cos(el) * d)
      cam.lookAt(0, 0, 0)
      cam.updateProjectionMatrix()
      cam.updateMatrixWorld(true)
      let ok = true
      for (const c of corners) { const p = c.clone().project(cam); if (Math.abs(p.x) > 0.95 || p.y > 0.8 || p.y < -0.95) { ok = false; break } }
      if (ok) break
    }
    base.current.copy(cam.position)
  }, [camera, size.width, size.height])

  // ---- pointer -> table coordinates (used by GameView for mouse / touch)
  useEffect(() => {
    const ray = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.02)
    const ndc = new THREE.Vector2()
    const hit = new THREE.Vector3()
    api.toTable = (cx, cy) => {
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, y: -hit.z } : null
    }
    return () => { api.toTable = null }
  }, [api, camera, gl])

  const emit = (x: number, y: number, z: number, n: number, speed: number, col: THREE.Color, up = 1) => {
    for (let k = 0; k < n; k++) {
      const i = P.head; P.head = (P.head + 1) % PART_N
      const ang = Math.random() * Math.PI * 2
      const sp = speed * (0.35 + Math.random() * 0.9)
      P.x[i] = x; P.y[i] = y; P.z[i] = z
      P.vx[i] = Math.cos(ang) * sp; P.vz[i] = Math.sin(ang) * sp; P.vy[i] = Math.random() * speed * 0.9 * up
      P.life[i] = P.max[i] = 0.3 + Math.random() * 0.55
      P.r[i] = col.r; P.g[i] = col.g; P.b[i] = col.b
    }
  }

  // ---- engine events -> visual effects
  useEffect(() => {
    const offs = [
      engine.on('impact', (im) => {
        const sn = clamp(im.intensity / 5, 0, 1)
        const col = im.kind === 'paddle0' ? tmp.player : im.kind === 'paddle1' ? tmp.opp : tmp.tc.set('#ffd166')
        emit(im.x, 0.03, -im.y, 4 + Math.round(sn * 16), 0.5 + sn * 1.6, col.clone())
        fx.current.flash = Math.max(fx.current.flash, 0.6 + sn * 2.4)
        if (flashLight.current) flashLight.current.position.set(im.x, 0.1, -im.y)
        if (shake && im.intensity > 1.8) fx.current.shake = Math.max(fx.current.shake, sn)
      }),
      engine.on('goal', (e) => {
        const z = e.scorer === 0 ? -TABLE.L / 2 : TABLE.L / 2
        emit(0, 0.05, z, 140, 1.9, e.scorer === 0 ? new THREE.Color('#ffd166') : tmp.opp.clone(), 1.6)
        emit(0, 0.05, z, 60, 1.2, tmp.player.clone(), 1.4)
        if (shake) fx.current.shake = Math.max(fx.current.shake, 0.9)
      }),
      engine.on('serve', () => { hist.current.length = 0 }),
    ]
    return () => offs.forEach((f) => f())
  }, [engine, shake, tmp])

  useFrame((_, dt) => {
    engine.update(dt)
    const r = engine.render
    const sp = Math.hypot(r.puck.vx, r.puck.vy)
    const sn = clamp(sp / PUCK_MAX_SPEED, 0, 1)

    puck.current?.position.set(r.puck.x, 0, -r.puck.y)
    puckM.current?.position.set(r.puck.x, 0, -r.puck.y)
    for (let i = 0; i < 2; i++) {
      pads[i].current?.position.set(r.pad[i].x, 0, -r.pad[i].y)
      padsM[i].current?.position.set(r.pad[i].x, 0, -r.pad[i].y)
    }
    // speed-dependent puck glow
    assets.puckMat.emissiveIntensity = 0.3 + sn * 1.8
    assets.puckMat.emissive.copy(tmp.player).lerp(tmp.hot, sn * 0.6)
    if (puckLight.current) {
      puckLight.current.position.set(r.puck.x, 0.18, -r.puck.y)
      puckLight.current.intensity = 0.15 + sn * 1.1
    }
    // impact flash
    fx.current.flash *= Math.exp(-dt * 14)
    if (flashLight.current) flashLight.current.intensity = fx.current.flash

    // motion trail: longer + brighter the faster the puck moves
    const h = hist.current
    h.unshift({ x: r.puck.x, z: -r.puck.y })
    if (h.length > TRAIL_N) h.length = TRAIL_N
    const tm = trail.current
    if (tm) {
      for (let i = 0; i < TRAIL_N; i++) {
        const p = h[i] ?? h[h.length - 1] ?? { x: 0, z: 0 }
        const f = i / TRAIL_N
        const vis = clamp((sn * 1.25 - f * 0.9) * 2.2, 0, 1) * (1 - f)
        tmp.o.position.set(p.x, 0.004, p.z)
        tmp.o.scale.setScalar(Math.max(0.0001, (1 - f * 0.55) * (vis > 0.01 ? 1 : 0)))
        tmp.o.updateMatrix()
        tm.setMatrixAt(i, tmp.o.matrix)
        tmp.c.copy(tmp.puck).lerp(tmp.hot, 0.35).multiplyScalar(vis * 0.9)
        tm.setColorAt(i, tmp.c)
      }
      tm.instanceMatrix.needsUpdate = true
      if (tm.instanceColor) tm.instanceColor.needsUpdate = true
    }

    // pooled particles
    const pm = parts.current
    if (pm) {
      for (let i = 0; i < PART_N; i++) {
        if (P.life[i] > 0) {
          P.life[i] -= dt
          P.vy[i] -= 2.6 * dt
          P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt
          if (P.y[i] < 0.006) { P.y[i] = 0.006; P.vy[i] *= -0.35; P.vx[i] *= 0.85; P.vz[i] *= 0.85 }
        }
        const k = P.life[i] > 0 ? P.life[i] / P.max[i] : 0
        tmp.o.position.set(P.x[i], P.y[i], P.z[i])
        tmp.o.scale.setScalar(Math.max(0.0001, k))
        tmp.o.updateMatrix()
        pm.setMatrixAt(i, tmp.o.matrix)
        tmp.c.setRGB(P.r[i] * k, P.g[i] * k, P.b[i] * k)
        pm.setColorAt(i, tmp.c)
      }
      pm.instanceMatrix.needsUpdate = true
      if (pm.instanceColor) pm.instanceColor.needsUpdate = true
    }

    // camera shake on hard hits and goals
    const fxs = fx.current
    if (fxs.shake > 0.002) {
      camera.position.set(base.current.x + (Math.random() - 0.5) * fxs.shake * 0.05, base.current.y + (Math.random() - 0.5) * fxs.shake * 0.03, base.current.z + (Math.random() - 0.5) * fxs.shake * 0.05)
      fxs.shake *= Math.exp(-dt * 9)
    } else if (fxs.shake !== 0) { camera.position.copy(base.current); fxs.shake = 0 }
  })

  const hi = quality === 'high'
  const { W, L } = TABLE
  return (
    <>
      <color attach="background" args={[light ? '#e3ecff' : '#070b1a']} />
      <fog attach="fog" args={[light ? '#e3ecff' : '#070b1a', 6, 14]} />
      <ambientLight intensity={light ? 0.75 : 0.45} />
      <hemisphereLight args={[light ? '#ffffff' : '#6ea8ff', light ? '#b9c9ee' : '#101830', 0.55]} />
      <directionalLight position={[0.6, 4, 1.4]} intensity={1.5} castShadow={hi} shadow-mapSize={[1024, 1024]} shadow-camera-left={-1.5} shadow-camera-right={1.5} shadow-camera-top={1.8} shadow-camera-bottom={-1.8} shadow-camera-near={0.5} shadow-camera-far={9} />
      <pointLight position={[0, 0.7, L / 2 + 0.2]} color={playerColor} intensity={1.2} distance={3.5} />
      <pointLight position={[0, 0.7, -L / 2 - 0.2]} color={oppColor} intensity={1.2} distance={3.5} />
      <pointLight ref={puckLight} color={puckColor} distance={1.1} intensity={0.2} />
      <pointLight ref={flashLight} color="#ffffff" distance={1.2} intensity={0} />

      {/* surface + base + floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={assets.tableMat}><planeGeometry args={[W, L]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} material={assets.baseMat}><planeGeometry args={[W + 0.2, L + 0.2]} /></mesh>
      <gridHelper args={[14, 56, light ? '#aebfe6' : '#14305e', light ? '#c4d2f0' : '#0d1b3a']} position={[0, -0.25, 0]} />
      <Walls a={assets} />

      {/* reflections (mirror copies under the semi-transparent surface) */}
      {hi && (
        <>
          <group ref={puckM} scale={[1, -1, 1]}><PuckParts a={assets} shadow={false} /></group>
          <group ref={padsM[0]} scale={[1, -1, 1]}><PaddleParts a={assets} mine shadow={false} /></group>
          <group ref={padsM[1]} scale={[1, -1, 1]}><PaddleParts a={assets} mine={false} shadow={false} /></group>
        </>
      )}
      <group ref={puck}><PuckParts a={assets} shadow={hi} /></group>
      <group ref={pads[0]}><PaddleParts a={assets} mine shadow={hi} /></group>
      <group ref={pads[1]}><PaddleParts a={assets} mine={false} shadow={hi} /></group>

      <instancedMesh ref={trail} args={[assets.trailGeo, assets.trailMat, TRAIL_N]} frustumCulled={false} />
      <instancedMesh ref={parts} args={[assets.partGeo, assets.partMat, PART_N]} frustumCulled={false} />
    </>
  )
}

export function Arena(props: ArenaProps) {
  const hi = props.quality === 'high'
  return (
    <Canvas shadows={hi} dpr={[1, hi ? 2 : 1]} camera={{ fov: 38, position: [0, 4, 2] }} gl={{ antialias: hi, powerPreference: 'high-performance' }} style={{ touchAction: 'none' }}>
      <Scene {...props} />
    </Canvas>
  )
}
