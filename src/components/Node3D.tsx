import { useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { Node, NODE_PRESETS, CELL } from '../types';
import { useStore } from '../store';
import { gridToWorld, layerIndexToY } from '../geometry';
import type { Diagram } from '../types';

interface Props {
  node: Node;
  diagram: Diagram;
  layerIndex: number;
  /** 所属层未被选中时压暗，作为背景参考 */
  dimmed?: boolean;
}

// troika 默认字体不含中文字形，节点名会渲染成空白。
// 这里用 public/fonts 下的 Noto Sans SC 子集（ASCII + 中文标点 + GB2312 全部汉字）。
// 走 BASE_URL 拼路径，部署到子路径时也不会 404。
const LABEL_FONT = `${import.meta.env.BASE_URL}fonts/NotoSansSC-subset.woff`;

export default function Node3D({ node, diagram, layerIndex, dimmed = false }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const {
    tool, selectedNodeId, connectFromNodeId,
    selectNode, startConnect, completeConnect, deleteNode, setTool,
  } = useStore();
  const focusMode = useStore(s => s.focusMode);

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
        <meshStandardMaterial
          color={color}
          transparent={dimmed}
          opacity={dimmed ? 0.28 : 1}
          depthWrite={!dimmed}
        />
      </mesh>

      {/* 选中高亮框 */}
      {(isSelected || isConnectFrom) && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(boxSize * 1.05, preset.height * 1.05, boxSize * 1.05)]} />
          <lineBasicMaterial color={isConnectFrom ? '#fde047' : '#ffffff'} />
        </lineSegments>
      )}

      {/* 标签：Billboard 让文字始终朝向相机，俯视聚焦时同样可读。
          聚焦俯视时 Y 方向的抬高在屏幕上不作偏移，所以额外用 +Z 错开，
          避免文字压在节点本体上；等轴测视角下只轻微前移，保持原有观感 */}
      <Billboard position={[0, preset.height * 0.5 + 0.3, focusMode ? 0.7 : 0.15]}>
        <Text
          font={LABEL_FONT}
          fontSize={0.4}
          color="#0f172a"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.035}
          outlineColor="#f8fafc"
          fillOpacity={dimmed ? 0.3 : 1}
          outlineOpacity={dimmed ? 0.15 : 1}
        >
          {node.label}
        </Text>
      </Billboard>
    </group>
  );
}
