import { useMemo } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { GRID_SIZE, CELL, Layer } from '../types';
import { useStore } from '../store';
import { worldToGrid } from '../geometry';

interface Props {
  layer: Layer;
  index: number;
  active: boolean;
  y: number;
  /** 单层聚焦模式：该层是唯一可见层，用更密的网格便于层内对位 */
  focused?: boolean;
  /** 有层被选中时，其余层压暗作为背景，突出选中层 */
  dimmed?: boolean;
}

export default function LayerPlane({ layer, index, active, y, focused = false, dimmed = false }: Props) {
  const { tool, addNode, setActiveLayer, setTool, nodeType } = useStore();
  const size = GRID_SIZE * CELL;

  // 聚焦时画出每一条格子线（20x20），否则每 5 格一条主网格线
  const gridLines = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const half = size / 2;
    const step = focused ? 1 : 5;
    for (let i = 0; i <= GRID_SIZE; i += step) {
      const p = -half + i * CELL;
      positions.push(-half, 0, p, half, 0, p);
      positions.push(p, 0, -half, p, 0, half);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [size, focused]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (!active) {
      setActiveLayer(layer.id);
      return;
    }
    if (tool === 'node') {
      // 将点击点转换为网格坐标
      const point = e.point;
      const { gx, gz } = worldToGrid(point.x, point.z);
      if (gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE) {
        addNode(layer.id, gx, gz);
      }
    } else if (tool === 'select' || tool === 'connect' || tool === 'delete') {
      setActiveLayer(layer.id);
    }
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setActiveLayer(layer.id);
  };

  // 透明度分层：选中层最实，未选中的层压到很淡只留轮廓，
  // 这样多层叠在一起时能一眼看出当前在操作哪一层
  const baseColor = layer.color;
  const planeColor = baseColor;
  const planeOpacity = focused ? 0.2 : active ? 0.18 : dimmed ? 0.03 : 0.08;
  const gridOpacity = focused ? 0.3 : active ? 0.28 : dimmed ? 0.05 : 0.12;

  return (
    <group position={[0, y, 0]}>
      {/* 层平面背景 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerOver={handlePointerOver}
      >
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          color={planeColor}
          transparent
          opacity={planeOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 网格线 */}
      <lineSegments geometry={gridLines}>
        <lineBasicMaterial
          color={baseColor}
          transparent
          opacity={gridOpacity}
        />
      </lineSegments>
    </group>
  );
}
