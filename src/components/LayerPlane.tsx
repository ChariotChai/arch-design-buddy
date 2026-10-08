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
}

export default function LayerPlane({ layer, index, active, y }: Props) {
  const { tool, addNode, setActiveLayer, setTool, nodeType } = useStore();
  const size = GRID_SIZE * CELL;

  // 稀疏主网格线（每 5 格一条）
  const gridLines = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const half = size / 2;
    for (let i = 0; i <= GRID_SIZE; i += 5) {
      const p = -half + i * CELL;
      positions.push(-half, 0, p, half, 0, p);
      positions.push(p, 0, -half, p, 0, half);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [size]);

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

  // 颜色：激活层更亮
  const baseColor = layer.color;
  const planeColor = active ? baseColor : baseColor;
  const opacity = active ? 0.12 : 0.06;

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
          opacity={opacity}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 稀疏主网格线 */}
      <lineSegments geometry={gridLines}>
        <lineBasicMaterial color={baseColor} transparent opacity={active ? 0.2 : 0.1} />
      </lineSegments>

      {/* 层边框 */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(size, size)]} />
        <lineBasicMaterial color={baseColor} transparent opacity={active ? 0.9 : 0.5} />
      </lineSegments>
    </group>
  );
}
