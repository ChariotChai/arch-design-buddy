// 数据模型类型定义

export type NodeType = 'box' | 'service' | 'database' | 'cache' | 'lb' | 'client';

export interface Node {
  id: string;
  layerId: string;
  gx: number; // 网格 X 坐标
  gz: number; // 网格 Z 坐标
  label: string;
  type: NodeType;
}

export interface Layer {
  id: string;
  name: string;
  color: string;
  nodes: Node[];
}

export interface Connection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface Diagram {
  layers: Layer[];
  connections: Connection[];
}

export type Tool = 'select' | 'node' | 'connect' | 'delete';

// 网格配置
export const GRID_SIZE = 20; // 每层网格的边长（格子数）
export const CELL = 1; // 每个格子的世界单位大小
export const LAYER_GAP = 3; // 层与层之间的垂直间距

// 节点类型的视觉配置
export const NODE_PRESETS: Record<NodeType, { color: string; label: string; height: number }> = {
  box: { color: '#60a5fa', label: '通用', height: 0.6 },
  service: { color: '#34d399', label: '服务', height: 0.6 },
  database: { color: '#fbbf24', label: '数据库', height: 0.7 },
  cache: { color: '#f472b6', label: '缓存', height: 0.5 },
  lb: { color: '#a78bfa', label: '负载均衡', height: 0.5 },
  client: { color: '#f87171', label: '客户端', height: 0.5 },
};

export const LAYER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];
