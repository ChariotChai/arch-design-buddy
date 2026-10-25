import { useRef, useState, useMemo, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';
import { GRID_SIZE, CELL, LAYER_GAP, NODE_PRESETS } from '../types';
import { gridToWorld, worldToGrid, layerIndexToY, nodeWorldPos } from '../geometry';
import LayerPlane from './LayerPlane';
import Node3D from './Node3D';
import Connection3D from './Connection3D';
import Scene2D from './Scene2D';

// 检测 WebGL 支持
function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

// 放置预览：当工具为 node 时，在鼠标位置显示半透明节点
function PlacePreview() {
  const { tool, nodeType, activeLayerId, diagram } = useStore();
  const [hover, setHover] = useState<{ x: number; z: number; layerId: string } | null>(null);
  const planeRef = useRef<THREE.Mesh>(null);

  const activeLayer = activeLayerId ? diagram.layers.find(l => l.id === activeLayerId) : null;
  const layerIdx = activeLayer ? diagram.layers.findIndex(l => l.id === activeLayer.id) : -1;

  if (tool !== 'node' || !activeLayer || layerIdx < 0) return null;

  const y = layerIndexToY(layerIdx);
  const size = GRID_SIZE * CELL;

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    const point = e.point;
    const { gx, gz } = worldToGrid(point.x, point.z);
    if (gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE) {
      setHover({ x: gx, z: gz, layerId: activeLayer.id });
    } else {
      setHover(null);
    }
  };

  // 检查格子是否被占用
  const occupied = hover
    ? activeLayer.nodes.some(n => n.gx === hover.x && n.gz === hover.z)
    : false;

  const preset = NODE_PRESETS[nodeType];

  return (
    <group>
      {/* 不可见的拾取平面，用于获取鼠标位置 */}
      <mesh
        ref={planeRef}
        position={[0, y + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handleMove}
        onPointerOut={() => setHover(null)}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {hover && (
        <group position={[
          gridToWorld(hover.x, hover.z).x,
          y + preset.height / 2,
          gridToWorld(hover.x, hover.z).y,
        ]}>
          <mesh>
            <boxGeometry args={[CELL * 0.85, preset.height, CELL * 0.85]} />
            <meshStandardMaterial
              color={occupied ? '#ef4444' : preset.color}
              transparent
              opacity={occupied ? 0.3 : 0.5}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

// 连线预览：从 connectFrom 节点到鼠标位置
function ConnectPreview() {
  const { tool, connectFromNodeId, diagram, activeLayerId } = useStore();
  const [target, setTarget] = useState<THREE.Vector3 | null>(null);
  const planeRef = useRef<THREE.Mesh>(null);

  if (tool !== 'connect' || !connectFromNodeId) return null;

  const fromNode = (() => {
    for (const l of diagram.layers) {
      const n = l.nodes.find(n => n.id === connectFromNodeId);
      if (n) return { node: n, layer: l };
    }
    return null;
  })();

  if (!fromNode) return null;

  const activeLayer = activeLayerId ? diagram.layers.find(l => l.id === activeLayerId) : fromNode.layer;
  const activeIdx = diagram.layers.findIndex(l => l.id === activeLayer!.id);
  const y = layerIndexToY(activeIdx);
  const size = GRID_SIZE * CELL;

  const fromPos = nodeWorldPos(diagram, fromNode.node);
  const fromTopY = fromPos.y + NODE_PRESETS[fromNode.node.type].height / 2;

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    setTarget(new THREE.Vector3(e.point.x, y, e.point.z));
  };

  // 构建预览折线
  const points = useMemo(() => {
    if (!target) return null;
    const pts = [
      new THREE.Vector3(fromPos.x, fromTopY, fromPos.z),
    ];
    if (fromNode.layer.id === activeLayer!.id) {
      pts.push(new THREE.Vector3(target.x, fromTopY, fromPos.z));
      pts.push(new THREE.Vector3(target.x, fromTopY, target.z));
    } else {
      const routeY = Math.max(fromTopY, y) + LAYER_GAP * 0.3;
      pts.push(new THREE.Vector3(fromPos.x, routeY, fromPos.z));
      pts.push(new THREE.Vector3(target.x, routeY, fromPos.z));
      pts.push(new THREE.Vector3(target.x, routeY, target.z));
      pts.push(new THREE.Vector3(target.x, y + 0.3, target.z));
    }
    return pts;
  }, [target, fromPos, fromTopY, fromNode, activeLayer, y]);

  const lineObj = useMemo(() => {
    if (!points) return null;
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.8 });
    return new THREE.Line(geo, mat);
  }, [points]);

  return (
    <group>
      <mesh
        ref={planeRef}
        position={[0, y + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={handleMove}
        onPointerOut={() => setTarget(null)}
      >
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {lineObj && <primitive object={lineObj} />}
    </group>
  );
}

// 场景内容（在 Canvas 内部）
function SceneContent({ focusedLayerId }: { focusedLayerId: string | null }) {
  const { diagram, activeLayerId } = useStore();

  // 选中某层且不在聚焦模式时，其余层压暗成背景
  const hasActiveLayer = !!activeLayerId && diagram.layers.some(l => l.id === activeLayerId);
  const dimOthers = !focusedLayerId && hasActiveLayer;

  // 聚焦时只渲染激活层，否则渲染全部层
  const layersToRender = useMemo(
    () => (focusedLayerId ? diagram.layers.filter(l => l.id === focusedLayerId) : diagram.layers),
    [diagram.layers, focusedLayerId]
  );

  // 节点 id -> 所属层 id
  const nodeLayerId = useMemo(() => {
    const m = new Map<string, string>();
    diagram.layers.forEach(l => l.nodes.forEach(n => m.set(n.id, l.id)));
    return m;
  }, [diagram.layers]);

  // 聚焦时只保留层内连线；跨层连线在单层视角下没有可解释的走向，隐藏
  const visibleConnections = useMemo(() => {
    if (!focusedLayerId) return diagram.connections;
    return diagram.connections.filter(
      c => nodeLayerId.get(c.fromNodeId) === focusedLayerId &&
           nodeLayerId.get(c.toNodeId) === focusedLayerId
    );
  }, [diagram.connections, focusedLayerId, nodeLayerId]);

  return (
    <group>
      {/* 灯光 */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-10, 10, -10]} intensity={0.3} />

      {/* 地面参考：聚焦时由层自身的网格取代 */}
      {!focusedLayerId && (
        <gridHelper args={[GRID_SIZE * CELL * 1.5, GRID_SIZE, '#475569', '#334155']} position={[0, -0.5, 0]} />
      )}

      {/* 各层 */}
      {layersToRender.map((layer) => {
        const index = diagram.layers.findIndex(l => l.id === layer.id);
        return (
          <LayerPlane
            key={layer.id}
            layer={layer}
            index={index}
            active={activeLayerId === layer.id}
            focused={focusedLayerId === layer.id}
            dimmed={dimOthers && activeLayerId !== layer.id}
            y={layerIndexToY(index)}
          />
        );
      })}

      {/* 节点 */}
      {layersToRender.map((layer) => {
        const index = diagram.layers.findIndex(l => l.id === layer.id);
        const dimmed = dimOthers && activeLayerId !== layer.id;
        return layer.nodes.map(node => (
          <Node3D key={node.id} node={node} diagram={diagram} layerIndex={index} dimmed={dimmed} />
        ));
      })}

      {/* 连线 */}
      {visibleConnections.map(conn => (
        <Connection3D key={conn.id} connection={conn} diagram={diagram} />
      ))}

      {/* 放置预览 */}
      <PlacePreview />
      {/* 连线预览 */}
      <ConnectPreview />
    </group>
  );
}

// 聚焦模式切换时把相机摆到该层正上方，退出时回到等轴测视角
function CameraRig({
  focused,
  focusY,
  controlsRef,
}: {
  focused: boolean;
  focusY: number;
  controlsRef: MutableRefObject<any>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    const controls = controlsRef.current;
    if (focused) {
      // z 留一点微小偏移，避免正上方时方位角退化
      camera.position.set(0, focusY + 30, 0.001);
      controls?.target.set(0, focusY, 0);
    } else {
      camera.position.set(25, 25, 25);
      controls?.target.set(0, 0, 0);
    }
    controls?.update();
  }, [focused, focusY, camera, controlsRef]);

  return null;
}

export default function Scene() {
  const [webgl] = useState(supportsWebGL);
  const focusMode = useStore(s => s.focusMode);
  const activeLayerId = useStore(s => s.activeLayerId);
  const layers = useStore(s => s.diagram.layers);
  const controlsRef = useRef<any>(null);

  // 聚焦层：开启聚焦 + 有激活层 + 该层确实存在
  const focusedLayerId =
    focusMode && activeLayerId && layers.some(l => l.id === activeLayerId)
      ? activeLayerId
      : null;

  const focusIndex = focusedLayerId ? layers.findIndex(l => l.id === focusedLayerId) : -1;
  const focusY = focusIndex >= 0 ? layerIndexToY(focusIndex) : 0;

  if (!webgl) {
    return <Scene2D />;
  }

  return (
    <Canvas
      shadows
      style={{ background: '#0f172a' }}
      gl={{ antialias: true, failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: true }}
      onPointerMissed={() => {
        const { tool, cancelConnect, selectNode } = useStore.getState();
        if (tool === 'connect') cancelConnect();
        if (tool === 'select') selectNode(null);
      }}
    >
      <OrthographicCamera
        makeDefault
        position={[25, 25, 25]}
        zoom={focusedLayerId ? 36 : 25}
        near={-100}
        far={100}
      />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.1}
        minZoom={10}
        maxZoom={80}
        maxPolarAngle={Math.PI / 2.1}
        // 单层聚焦时锁定俯视：只保留平移与缩放，不允许旋转
        enableRotate={!focusedLayerId}
      />
      <CameraRig focused={!!focusedLayerId} focusY={focusY} controlsRef={controlsRef} />
      <SceneContent focusedLayerId={focusedLayerId} />
    </Canvas>
  );
}
