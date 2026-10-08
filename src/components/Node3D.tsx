import { useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Node, NODE_PRESETS, CELL } from '../types';
import { useStore } from '../store';
import { gridToWorld, layerIndexToY } from '../geometry';
import type { Diagram } from '../types';

interface Props {
  node: Node;
  diagram: Diagram;
  layerIndex: number;
}

export default function Node3D({ node, diagram, layerIndex }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const {
    tool, selectedNodeId, connectFromNodeId,
    selectNode, startConnect, completeConnect, deleteNode, setTool,
  } = useStore();

  const preset = NODE_PRESETS[node.type];
  const pos = gridToWorld(node.gx, node.gz);
  const y = layerIndexToY(layerIndex);
  const halfH = preset.height / 2;

  const isSelected = selectedNodeId === node.id;
  const isConnectFrom = connectFromNodeId === node.id;
  const isConnectTarget = tool === 'connect' && connectFromNodeId !== null && connectFromNodeId !== node.id;

  // 高亮颜色
  let color = preset.color;
  if (isSelected || isConnectFrom) color = '#ffffff';
  else if (isConnectTarget) color = '#fde68a';

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (tool === 'delete') {
      deleteNode(node.id);
    } else if (tool === 'connect') {
      if (!connectFromNodeId) {
        startConnect(node.id);
      } else {
        completeConnect(node.id);
      }
    } else if (tool === 'select') {
      selectNode(isSelected ? null : node.id);
    }
  };

  // 节点尺寸：占一个格子，略小于格子
  const boxSize = CELL * 0.85;

  return (
    <group position={[pos.x, y + halfH, pos.y]}>
      {/* 节点主体 */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        castShadow
      >
        <boxGeometry args={[boxSize, preset.height, boxSize]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* 选中高亮框 */}
      {(isSelected || isConnectFrom) && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(boxSize * 1.05, preset.height * 1.05, boxSize * 1.05)]} />
          <lineBasicMaterial color={isConnectFrom ? '#fde047' : '#ffffff'} />
        </lineSegments>
      )}

      {/* 标签 */}
      <Text
        position={[0, preset.height * 0.5 + 0.25, 0]}
        fontSize={0.28}
        color="#1e293b"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#ffffff"
      >
        {node.label}
      </Text>
    </group>
  );
}
