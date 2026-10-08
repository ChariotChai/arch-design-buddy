import { useMemo } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { Connection, Diagram, NODE_PRESETS } from '../types';
import { useStore, findNode } from '../store';
import { computeConnectionPath } from '../geometry';

interface Props {
  connection: Connection;
  diagram: Diagram;
}

// 根据路径点构建一个沿路径的管几何体（正交折线）
function buildTubeGeometry(points: THREE.Vector3[], radius: number): THREE.BufferGeometry | null {
  if (points.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0);
  // tension=0 让曲线尽量贴合折线点
  const tubularSegments = Math.max(points.length * 8, 16);
  return new THREE.TubeGeometry(curve, tubularSegments, radius, 8, false);
}

export default function Connection3D({ connection, diagram }: Props) {
  const { tool, deleteConnection } = useStore();

  const { geo, color } = useMemo(() => {
    const from = findNode(diagram, connection.fromNodeId);
    const to = findNode(diagram, connection.toNodeId);
    if (!from || !to) return { geo: null as THREE.BufferGeometry | null, color: '#94a3b8' };

    // 使用源节点的高度作为参考
    const h = Math.max(NODE_PRESETS[from.node.type].height, NODE_PRESETS[to.node.type].height);
    const points = computeConnectionPath(diagram, connection, h);
    const g = buildTubeGeometry(points, 0.05);
    // 跨层连线用源层颜色，同层用灰色
    const c = from.node.layerId !== to.node.layerId
      ? from.layer.color
      : '#94a3b8';
    return { geo: g, color: c };
  }, [connection, diagram]);

  if (!geo) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (tool === 'delete') {
      deleteConnection(connection.id);
    }
  };

  return (
    <mesh geometry={geo} onClick={handleClick}>
      <meshStandardMaterial
        color={color}
        transparent
        opacity={tool === 'delete' ? 0.9 : 0.75}
        emissive={color}
        emissiveIntensity={0.1}
      />
    </mesh>
  );
}
