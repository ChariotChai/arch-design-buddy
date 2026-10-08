import { create } from 'zustand';
import {
  Diagram, Layer, Node, Connection, Tool, NodeType,
  LAYER_COLORS, NODE_PRESETS,
} from './types';

let idCounter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

function makeInitialDiagram(): Diagram {
  const l1: Layer = {
    id: uid('layer'),
    name: '前端层',
    color: LAYER_COLORS[0],
    nodes: [
      { id: uid('node'), layerId: '', gx: 4, gz: 4, label: 'Web App', type: 'client' },
      { id: uid('node'), layerId: '', gx: 8, gz: 4, label: 'Mobile', type: 'client' },
    ],
  };
  l1.nodes.forEach(n => (n.layerId = l1.id));

  const l2: Layer = {
    id: uid('layer'),
    name: '服务层',
    color: LAYER_COLORS[1],
    nodes: [
      { id: uid('node'), layerId: '', gx: 5, gz: 8, label: 'API Gateway', type: 'lb' },
      { id: uid('node'), layerId: '', gx: 3, gz: 11, label: 'Auth Svc', type: 'service' },
      { id: uid('node'), layerId: '', gx: 7, gz: 11, label: 'Order Svc', type: 'service' },
    ],
  };
  l2.nodes.forEach(n => (n.layerId = l2.id));

  const l3: Layer = {
    id: uid('layer'),
    name: '数据层',
    color: LAYER_COLORS[2],
    nodes: [
      { id: uid('node'), layerId: '', gx: 3, gz: 14, label: 'PostgreSQL', type: 'database' },
      { id: uid('node'), layerId: '', gx: 7, gz: 14, label: 'Redis', type: 'cache' },
    ],
  };
  l3.nodes.forEach(n => (n.layerId = l3.id));

  const connections: Connection[] = [
    { id: uid('conn'), fromNodeId: l1.nodes[0].id, toNodeId: l2.nodes[0].id },
    { id: uid('conn'), fromNodeId: l1.nodes[1].id, toNodeId: l2.nodes[0].id },
    { id: uid('conn'), fromNodeId: l2.nodes[0].id, toNodeId: l2.nodes[1].id },
    { id: uid('conn'), fromNodeId: l2.nodes[0].id, toNodeId: l2.nodes[2].id },
    { id: uid('conn'), fromNodeId: l2.nodes[1].id, toNodeId: l3.nodes[0].id },
    { id: uid('conn'), fromNodeId: l2.nodes[2].id, toNodeId: l3.nodes[0].id },
    { id: uid('conn'), fromNodeId: l2.nodes[2].id, toNodeId: l3.nodes[1].id },
  ];

  return { layers: [l1, l2, l3], connections };
}

interface State {
  diagram: Diagram;
  tool: Tool;
  activeLayerId: string | null;
  selectedNodeId: string | null;
  connectFromNodeId: string | null;
  nodeType: NodeType;
  // actions
  setTool: (t: Tool) => void;
  setActiveLayer: (id: string | null) => void;
  setNodeType: (t: NodeType) => void;
  selectNode: (id: string | null) => void;
  addNode: (layerId: string, gx: number, gz: number) => void;
  deleteNode: (nodeId: string) => void;
  startConnect: (nodeId: string) => void;
  completeConnect: (nodeId: string) => void;
  cancelConnect: () => void;
  deleteConnection: (connId: string) => void;
  addLayer: () => void;
  removeLayer: (layerId: string) => void;
  renameLayer: (layerId: string, name: string) => void;
  setLayerColor: (layerId: string, color: string) => void;
  moveLayer: (layerId: string, direction: 'up' | 'down') => void;
  loadDiagram: (d: Diagram) => void;
  clearDiagram: () => void;
}

export const useStore = create<State>((set, get) => ({
  diagram: makeInitialDiagram(),
  tool: 'select',
  activeLayerId: null,
  selectedNodeId: null,
  connectFromNodeId: null,
  nodeType: 'service',

  setTool: (t) => set({ tool: t, connectFromNodeId: null, selectedNodeId: null }),
  setActiveLayer: (id) => set({ activeLayerId: id }),
  setNodeType: (t) => set({ nodeType: t }),
  selectNode: (id) => set({ selectedNodeId: id }),

  addNode: (layerId, gx, gz) => {
    const { diagram } = get();
    // 检查该格子是否已被占用
    const layer = diagram.layers.find(l => l.id === layerId);
    if (!layer) return;
    const occupied = layer.nodes.some(n => n.gx === gx && n.gz === gz);
    if (occupied) return;
    const node: Node = {
      id: uid('node'),
      layerId,
      gx, gz,
      label: NODE_PRESETS[get().nodeType].label,
      type: get().nodeType,
    };
    set({
      diagram: {
        ...diagram,
        layers: diagram.layers.map(l =>
          l.id === layerId ? { ...l, nodes: [...l.nodes, node] } : l
        ),
      },
    });
  },

  deleteNode: (nodeId) => {
    const { diagram } = get();
    set({
      diagram: {
        layers: diagram.layers.map(l => ({
          ...l,
          nodes: l.nodes.filter(n => n.id !== nodeId),
        })),
        connections: diagram.connections.filter(
          c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId
        ),
      },
      selectedNodeId: null,
    });
  },

  startConnect: (nodeId) => {
    set({ connectFromNodeId: nodeId });
  },

  completeConnect: (nodeId) => {
    const { connectFromNodeId, diagram } = get();
    if (!connectFromNodeId || connectFromNodeId === nodeId) {
      set({ connectFromNodeId: null });
      return;
    }
    // 防止重复连线
    const exists = diagram.connections.some(
      c => (c.fromNodeId === connectFromNodeId && c.toNodeId === nodeId) ||
           (c.fromNodeId === nodeId && c.toNodeId === connectFromNodeId)
    );
    if (!exists) {
      set({
        diagram: {
          ...diagram,
          connections: [...diagram.connections, {
            id: uid('conn'),
            fromNodeId: connectFromNodeId,
            toNodeId: nodeId,
          }],
        },
      });
    }
    set({ connectFromNodeId: null });
  },

  cancelConnect: () => set({ connectFromNodeId: null }),

  deleteConnection: (connId) => {
    const { diagram } = get();
    set({
      diagram: {
        ...diagram,
        connections: diagram.connections.filter(c => c.id !== connId),
      },
    });
  },

  addLayer: () => {
    const { diagram } = get();
    const colorIdx = diagram.layers.length % LAYER_COLORS.length;
    const layer: Layer = {
      id: uid('layer'),
      name: `层 ${diagram.layers.length + 1}`,
      color: LAYER_COLORS[colorIdx],
      nodes: [],
    };
    set({
      diagram: { ...diagram, layers: [...diagram.layers, layer] },
      activeLayerId: layer.id,
    });
  },

  removeLayer: (layerId) => {
    const { diagram } = get();
    const layer = diagram.layers.find(l => l.id === layerId);
    if (!layer) return;
    const nodeIds = new Set(layer.nodes.map(n => n.id));
    set({
      diagram: {
        layers: diagram.layers.filter(l => l.id !== layerId),
        connections: diagram.connections.filter(
          c => !nodeIds.has(c.fromNodeId) && !nodeIds.has(c.toNodeId)
        ),
      },
    });
  },

  renameLayer: (layerId, name) => {
    const { diagram } = get();
    set({
      diagram: {
        ...diagram,
        layers: diagram.layers.map(l => l.id === layerId ? { ...l, name } : l),
      },
    });
  },

  setLayerColor: (layerId, color) => {
    const { diagram } = get();
    set({
      diagram: {
        ...diagram,
        layers: diagram.layers.map(l => l.id === layerId ? { ...l, color } : l),
      },
    });
  },

  moveLayer: (layerId, direction) => {
    const { diagram } = get();
    const idx = diagram.layers.findIndex(l => l.id === layerId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= diagram.layers.length) return;
    const layers = [...diagram.layers];
    [layers[idx], layers[newIdx]] = [layers[newIdx], layers[idx]];
    set({ diagram: { ...diagram, layers } });
  },

  loadDiagram: (d) => set({ diagram: d, activeLayerId: null, selectedNodeId: null, connectFromNodeId: null }),

  clearDiagram: () => set({
    diagram: { layers: [], connections: [] },
    activeLayerId: null, selectedNodeId: null, connectFromNodeId: null,
  }),
}));

// 辅助：根据节点 id 找到节点和所在层
export function findNode(diagram: Diagram, nodeId: string): { node: Node; layer: Layer } | null {
  for (const layer of diagram.layers) {
    const node = layer.nodes.find(n => n.id === nodeId);
    if (node) return { node, layer };
  }
  return null;
}

// 获取层在世界坐标中的 Y 值
export function layerY(layerIndex: number, gap: number): number {
  return layerIndex * gap;
}
