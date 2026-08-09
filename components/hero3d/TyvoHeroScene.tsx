'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { heroObjects } from '@/lib/hero3d/heroObjects.config.js';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * INTEGRATION NOTE — what's K-Spline's vs. what was added here:
 *
 * K-Spline owns and this file preserves UNCHANGED: monolith geometry
 * (buildMonolithGeometry), the two shared materials + edge material,
 * scene/fog/floor setup, all lighting (key/fill/ambient/rim/orange),
 * camera starting position/FOV, and the FPS HUD.
 *
 * Added at the integration layer (Tyvo application's responsibility
 * per the brief's ownership split — routing/navigation/interaction
 * state, not visual design):
 *   - horizontal drag/swipe/wheel panning across the row
 *   - click/tap raycasting to detect the selected monolith
 *   - "active object" emphasis via transform only (scale + forward
 *     offset) — no new materials or geometry invented
 *   - prefers-reduced-motion handling (idle rotation + drag inertia)
 *   - the onSelect(sectionId) callback the app layer consumes to
 *     decide navigation, keeping the 3D scene decoupled from content
 */

function buildMonolithGeometry(bevel: number) {
  const shape = new THREE.Shape();
  const w = 1.1;
  const h = 4.4;

  shape.moveTo(-w / 2, -h / 2 + bevel);
  shape.lineTo(-w / 2 + bevel * 0.6, -h / 2);
  shape.lineTo(w / 2 - bevel * 0.6, -h / 2);
  shape.lineTo(w / 2, -h / 2 + bevel);
  shape.lineTo(w / 2, h / 2 - bevel);
  shape.lineTo(w / 2 - bevel * 0.6, h / 2);
  shape.lineTo(-w / 2 + bevel * 0.6, h / 2);
  shape.lineTo(-w / 2, h / 2 - bevel);
  shape.lineTo(-w / 2, -h / 2 + bevel);

  return new THREE.ExtrudeGeometry(shape, {
    depth: 0.55,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 3,
    curveSegments: 2,
  });
}

type MonolithGroup = THREE.Group & {
  userData: { sectionId: string; id: string; baseX: number };
};

export function TyvoHeroScene({ onSelect }: { onSelect: (sectionId: string) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [fps, setFps] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 900;
    const height = mount.clientHeight || 560;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.FogExp2(0x0a0a0a, 0.045);

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 13);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // Material families — exactly 2, shared across all 7 objects
    const polishedMat = new THREE.MeshStandardMaterial({
      color: 0x2b2a29,
      metalness: 0.9,
      roughness: 0.12,
      emissive: 0xb52524,
      emissiveIntensity: 0.06,
    });

    const matteMat = new THREE.MeshStandardMaterial({
      color: 0x2b2a29,
      metalness: 0.15,
      roughness: 0.85,
      emissive: 0x1a0605,
      emissiveIntensity: 0.15,
    });

    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xb52524,
      emissive: 0xb52524,
      emissiveIntensity: 1.4,
      metalness: 0.2,
      roughness: 0.3,
    });

    const spacing = 1.75;
    const sorted = [...heroObjects].sort((a, b) => a.order - b.order);
    const totalWidth = (sorted.length - 1) * spacing;
    const groups: MonolithGroup[] = [];

    sorted.forEach((obj, i) => {
      const geometry = buildMonolithGeometry(obj.bevelVariant);
      const material = obj.material === 'polished' ? polishedMat : matteMat;

      const group = new THREE.Group() as MonolithGroup;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      const edgeGeo = new THREE.BoxGeometry(0.03, 3.9, 0.6);
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.position.set(0.56, 0, 0.02);
      group.add(edge);

      const baseX = i * spacing - totalWidth / 2;
      group.position.x = baseX;
      group.userData = { sectionId: obj.sectionId, id: obj.id, baseX };
      scene.add(group);
      groups.push(group);
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x0a0d12, metalness: 0.3, roughness: 0.6 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.4;
    floor.receiveShadow = true;
    scene.add(floor);

    const keyLight = new THREE.DirectionalLight(0xfff2ea, 3.4);
    keyLight.position.set(6, 6, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 24;
    keyLight.shadow.camera.left = -8;
    keyLight.shadow.camera.right = 8;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0xb52524, 5, 16, 2);
    fillLight.position.set(-3, -1, 4);
    scene.add(fillLight);

    const ambient = new THREE.AmbientLight(0x273449, 0.22);
    scene.add(ambient);

    const rimLight = new THREE.DirectionalLight(0xffecd3, 0.3);
    rimLight.position.set(-5, 2, -6);
    scene.add(rimLight);

    const orangeAccent = new THREE.PointLight(0xc45e23, 1.0, 8, 2);
    orangeAccent.position.set(-4, 1.5, 1);
    scene.add(orangeAccent);

    // --- Added: horizontal pan state (drag / swipe / wheel) ---
    // Pans the whole row via a rig offset rather than moving the
    // camera directly, so the K-Spline-authored camera position/FOV
    // stays exactly as delivered.
    let rigOffset = 0;
    let targetRigOffset = 0;
    const maxOffset = totalWidth / 2 + spacing * 0.5;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartOffset = 0;
    let activeIndex = Math.max(0, Math.round(sorted.length / 2) - 1);

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartOffset = targetRigOffset;
      renderer.domElement.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      // Drag right -> reveal objects to the left, i.e. offset decreases.
      targetRigOffset = clamp(dragStartOffset - dx * 0.012, -maxOffset, maxOffset);
    };

    const endDrag = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      // Trackpad horizontal scroll only — vertical wheel is left alone
      // so the page itself never becomes wheel-scrollable horizontally.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        targetRigOffset = clamp(targetRigOffset + e.deltaX * 0.01, -maxOffset, maxOffset);
      }
    };

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let pointerMoved = false;

    const handleClickCandidateDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      pointerMoved = false;
    };
    const handleClickCandidateMove = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 6) pointerMoved = true;
    };
    const handleClickCandidateUp = (e: PointerEvent) => {
      endDrag();
      if (pointerMoved) return; // was a drag, not a tap/click

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      const meshes = groups.map((g) => g.children[0]);
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length === 0) return;

      const hitMesh = hits[0].object;
      const hitGroup = groups.find((g) => g.children[0] === hitMesh);
      if (hitGroup) onSelect(hitGroup.userData.sectionId);
    };

    renderer.domElement.style.touchAction = 'pan-y';
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerdown', handleClickCandidateDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointermove', handleClickCandidateMove);
    renderer.domElement.addEventListener('pointerup', handleClickCandidateUp);
    renderer.domElement.addEventListener('pointerleave', endDrag);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });

    let frameId: number;
    let t = 0;
    let frameCount = 0;
    let lastFpsUpdate = performance.now();

    const animate = () => {
      t += reducedMotionRef.current ? 0 : 0.003;

      rigOffset = reducedMotionRef.current
        ? targetRigOffset
        : THREE.MathUtils.lerp(rigOffset, targetRigOffset, 0.12);

      // Determine the active (nearest-to-center) monolith from the
      // current rig offset, then emphasize it via transform only.
      let nearest = 0;
      let nearestDist = Infinity;
      groups.forEach((g, i) => {
        const screenX = g.userData.baseX + rigOffset;
        const dist = Math.abs(screenX);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = i;
        }
      });
      activeIndex = nearest;

      groups.forEach((g, i) => {
        g.position.x = g.userData.baseX + rigOffset;
        const isActive = i === activeIndex;
        const targetScale = isActive ? 1.12 : 0.92;
        const targetZ = isActive ? 0.6 : 0;
        const lerpFactor = reducedMotionRef.current ? 1 : 0.1;
        g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, targetScale, lerpFactor));
        g.position.z = THREE.MathUtils.lerp(g.position.z, targetZ, lerpFactor);

        const idleAmplitude = reducedMotionRef.current ? 0 : 0.1;
        g.rotation.y = Math.sin(t + i * 0.4) * idleAmplitude;
      });

      renderer.render(scene, camera);

      frameCount++;
      const now = performance.now();
      if (now - lastFpsUpdate >= 500) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsUpdate)));
        frameCount = 0;
        lastFpsUpdate = now;
      }

      frameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerdown', handleClickCandidateDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointermove', handleClickCandidateMove);
      renderer.domElement.removeEventListener('pointerup', handleClickCandidateUp);
      renderer.domElement.removeEventListener('pointerleave', endDrag);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSelect]);

  return (
    <div className="relative h-[100vh] w-full bg-ink">
      <div ref={mountRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-8 top-8">
        <div className="font-en text-2xl font-heading-black tracking-wideish text-paper">
          Tyvo <span className="font-en font-body text-paper/80">Media</span>
        </div>
      </div>

      <div className="pointer-events-none absolute right-8 top-8 rounded-sm bg-ink/60 px-3 py-1 font-mono text-xs text-paper backdrop-blur-sm">
        {fps === null ? 'measuring…' : `${fps} fps`}
      </div>

      <p className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 text-xs uppercase tracking-wideish text-paper-dim">
        drag or swipe to explore — tap an object to enter
      </p>
    </div>
  );
}
