import { useEffect, useRef } from 'react';
import { useStore, findNode } from '../store';
import { GRID_SIZE, CELL, LAYER_GAP, NODE_PRESETS } from '../types';
import { gridToWorld, layerIndexToY, computeConnectionPath } from '../geometry';
import type { Diagram, Node, Connection } from '../types';

// 等距投影参数
const ISO_ANGLE = Math.PI / 6; // 30°
const COS = Math.cos(ISO_ANGLE);
const SIN = Math.sin(ISO_ANGLE);

// 世界坐标 -> 屏幕坐标（等距投影）
function project(x: number, y: number, z: number, scale: number, offsetX: number, offsetY: number) {
  return {
    sx: (x - z) * COS * scale + offsetX,
    sy: (x + z) * SIN * scale - y * scale + offsetY,
  };
}

export default function Scene2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    diagram, tool, activeLayerId, connectFromNodeId, nodeType,
    setActiveLayer, addNode, startConnect, completeConnect, deleteNode,
    selectNode, deleteConnection, cancelConnect,
  } = useStore();

  const viewState = useRef({
    scale: 18,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 每次状态变化重绘
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram, tool, activeLayerId, connectFromNodeId, nodeType]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const vs = viewState.current;
    const offsetX = W / 2 + vs.offsetX;
    const offsetY = H / 2 + vs.offsetY + 80;
    const scale = vs.scale;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // 按层从下到上绘制（painter's algorithm）
    for (let i = 0; i < diagram.layers.length; i++) {
      const layer = diagram.layers[i];
      const y = layerIndexToY(i);
      const isActive = activeLayerId === layer.id;
      drawLayer(ctx, layer, y, scale, offsetX, offsetY, isActive);
    }

    // 绘制连线
    for (const conn of diagram.connections) {
      drawConnection(ctx, diagram, conn, scale, offsetX, offsetY);
    }

    // 绘制节点（需要按深度排序以正确遮挡）
    const allNodes: { node: Node; layerIdx: number; depth: number }[] = [];
    diagram.layers.forEach((layer, idx) => {
      layer.nodes.forEach(node => {
        const wp = gridToWorld(node.gx, node.gz);
        allNodes.push({ node, layerIdx: idx, depth: wp.x + wp.y });
      });
    });
    allNodes.sort((a, b) => a.depth - b.depth);
    for (const { node, layerIdx } of allNodes) {
      drawNode(ctx, diagram, node, layerIdx, scale, offsetX, offsetY);
    }
  }

  function drawLayer(
    ctx: CanvasRenderingContext2D, layer: any, y: number,
    scale: number, offsetX: number, offsetY: number, active: boolean
  ) {
    const size = GRID_SIZE * CELL;
    const half = size / 2;
    const corners = [
      project(-half, y, -half, scale, offsetX, offsetY),
      project(half, y, -half, scale, offsetX, offsetY),
      project(half, y, half, scale, offsetX, offsetY),
      project(-half, y, half, scale, offsetX, offsetY),
    ];

    // 填充
    ctx.beginPath();
    ctx.moveTo(corners[0].sx, corners[0].sy);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].sx, corners[i].sy);
    ctx.closePath();
    ctx.fillStyle = layer.color + (active ? '18' : '08');
    ctx.fill();
    ctx.strokeStyle = layer.color + (active ? '88' : '44');
    ctx.lineWidth = active ? 1.5 : 0.8;
    ctx.stroke();

    // 稀疏主网格线（每 5 格一条）
    ctx.strokeStyle = layer.color + (active ? '22' : '10');
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i += 5) {
      const p = -half + i * CELL;
      const a = project(-half, y, p, scale, offsetX, offsetY);
      const b = project(half, y, p, scale, offsetX, offsetY);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();

      const c = project(p, y, -half, scale, offsetX, offsetY);
      const d = project(p, y, half, scale, offsetX, offsetY);
      ctx.beginPath();
      ctx.moveTo(c.sx, c.sy);
      ctx.lineTo(d.sx, d.sy);
      ctx.stroke();
    }
  }

  function drawNode(
    ctx: CanvasRenderingContext2D, diagram: Diagram, node: Node,
    layerIdx: number, scale: number, offsetX: number, offsetY: number
  ) {
    const preset = NODE_PRESETS[node.type];
    const wp = gridToWorld(node.gx, node.gz);
    const ly = layerIndexToY(layerIdx);
    const h = preset.height;
    const half = CELL * 0.425;

    const isSelected = useStore.getState().selectedNodeId === node.id;
    const isConnectFrom = useStore.getState().connectFromNodeId === node.id;

    const color = isSelected || isConnectFrom ? '#ffffff' : preset.color;

    // 盒子的 8 个顶点
    const top = [
      project(wp.x - half, ly + h, wp.y - half, scale, offsetX, offsetY),
      project(wp.x + half, ly + h, wp.y - half, scale, offsetX, offsetY),
      project(wp.x + half, ly + h, wp.y + half, scale, offsetX, offsetY),
      project(wp.x - half, ly + h, wp.y + half, scale, offsetX, offsetY),
    ];
    const bot = [
      project(wp.x - half, ly, wp.y - half, scale, offsetX, offsetY),
      project(wp.x + half, ly, wp.y - half, scale, offsetX, offsetY),
      project(wp.x + half, ly, wp.y + half, scale, offsetX, offsetY),
      project(wp.x - half, ly, wp.y + half, scale, offsetX, offsetY),
    ];

    // 右侧面
    ctx.beginPath();
    ctx.moveTo(top[1].sx, top[1].sy);
    ctx.lineTo(top[2].sx, top[2].sy);
    ctx.lineTo(bot[2].sx, bot[2].sy);
    ctx.lineTo(bot[1].sx, bot[1].sy);
    ctx.closePath();
    ctx.fillStyle = shade(color, -25);
    ctx.fill();
    ctx.strokeStyle = shade(color, -40);
    ctx.lineWidth = 1;
    ctx.stroke();

    // 前面
    ctx.beginPath();
    ctx.moveTo(top[2].sx, top[2].sy);
    ctx.lineTo(top[3].sx, top[3].sy);
    ctx.lineTo(bot[3].sx, bot[3].sy);
    ctx.lineTo(bot[2].sx, bot[2].sy);
    ctx.closePath();
    ctx.fillStyle = shade(color, -10);
    ctx.fill();
    ctx.stroke();

    // 顶面
    ctx.beginPath();
    ctx.moveTo(top[0].sx, top[0].sy);
    for (let i = 1; i < 4; i++) ctx.lineTo(top[i].sx, top[i].sy);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = shade(color, -30);
    ctx.stroke();

    // 标签
    ctx.font = `${Math.max(10, scale * 0.14)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    const labelPos = project(wp.x, ly + h + 0.2, wp.y, scale, offsetX, offsetY);
    ctx.strokeText(node.label, labelPos.sx, labelPos.sy);
    ctx.fillText(node.label, labelPos.sx, labelPos.sy);

    // 选中高亮
    if (isSelected || isConnectFrom) {
      ctx.strokeStyle = isConnectFrom ? '#fde047' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(top[0].sx, top[0].sy);
      for (let i = 1; i < 4; i++) ctx.lineTo(top[i].sx, top[i].sy);
      ctx.closePath();
      ctx.stroke();
    }
  }

  function drawConnection(
    ctx: CanvasRenderingContext2D, diagram: Diagram, conn: Connection,
    scale: number, offsetX: number, offsetY: number
  ) {
    const from = findNode(diagram, conn.fromNodeId);
    const to = findNode(diagram, conn.toNodeId);
    if (!from || !to) return;
    const h = Math.max(NODE_PRESETS[from.node.type].height, NODE_PRESETS[to.node.type].height);
    const points = computeConnectionPath(diagram, conn, h);

    const crossLayer = from.node.layerId !== to.node.layerId;
    ctx.strokeStyle = crossLayer ? from.layer.color : '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = project(points[i].x, points[i].y, points[i].z, scale, offsetX, offsetY);
      if (i === 0) ctx.moveTo(p.sx, p.sy);
      else ctx.lineTo(p.sx, p.sy);
    }
    ctx.stroke();
  }

  // 颜色变暗
  function shade(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const r = Math.max(0, Math.min(255, (num >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (num & 0xff) + amt));
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
  }

  // 屏幕坐标 -> 世界坐标（近似，用于点击检测）
  function screenToWorldGrid(sx: number, sy: number): { gx: number; gz: number; layerIdx: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const vs = viewState.current;
    const offsetX = W / 2 + vs.offsetX;
    const offsetY = H / 2 + vs.offsetY + 80;
    const scale = vs.scale;

    // 对每个层，反投影找到最近的格子
    let best: { gx: number; gz: number; layerIdx: number; dist: number } | null = null;
    for (let i = 0; i < diagram.layers.length; i++) {
      const y = layerIndexToY(i);
      // 反投影：给定屏幕坐标和 y，求 x, z
      // sx = (x - z) * COS * scale + offsetX
      // sy = (x + z) * SIN * scale - y * scale + offsetY
      const dx = (sx - offsetX) / (COS * scale);
      const dy = (sy - offsetY + y * scale) / (SIN * scale);
      const x = (dx + dy) / 2;
      const z = (dy - dx) / 2;
      const gx = Math.floor(x / CELL + GRID_SIZE / 2);
      const gz = Math.floor(z / CELL + GRID_SIZE / 2);
      if (gx >= 0 && gx < GRID_SIZE && gz >= 0 && gz < GRID_SIZE) {
        // 计算该层对应世界坐标投影到屏幕的距离
        const wp = gridToWorld(gx, gz);
        const proj = project(wp.x, y, wp.y, scale, offsetX, offsetY);
        const dist = Math.hypot(proj.sx - sx, proj.sy - sy);
        if (!best || dist < best.dist) {
          best = { gx, gz, layerIdx: i, dist };
        }
      }
    }
    return best;
  }

  function findNodeAtScreen(sx: number, sy: number): Node | null {
    let hit: { node: Node; dist: number } | null = null;
    for (const layer of diagram.layers) {
      for (const node of layer.nodes) {
        const idx = diagram.layers.findIndex(l => l.id === layer.id);
        const wp = gridToWorld(node.gx, node.gz);
        const ly = layerIndexToY(idx);
        const vs = viewState.current;
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const p = project(wp.x, ly + NODE_PRESETS[node.type].height / 2, wp.y, vs.scale,
          rect.width / 2 + vs.offsetX, rect.height / 2 + vs.offsetY + 80);
        const d = Math.hypot(p.sx - sx, p.sy - sy);
        if (d < vs.scale * 0.5 && (!hit || d < hit.dist)) {
          hit = { node, dist: d };
        }
      }
    }
    return hit?.node ?? null;
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const vs = viewState.current;

    if (e.button === 2 || e.button === 1 || e.shiftKey) {
      vs.dragging = true;
      vs.lastX = e.clientX;
      vs.lastY = e.clientY;
      return;
    }

    const node = findNodeAtScreen(sx, sy);
    if (node) {
      if (tool === 'delete') {
        deleteNode(node.id);
      } else if (tool === 'connect') {
        if (!connectFromNodeId) startConnect(node.id);
        else completeConnect(node.id);
      } else if (tool === 'select') {
        selectNode(node.id);
      }
      return;
    }

    if (tool === 'node') {
      const hit = screenToWorldGrid(sx, sy);
      if (hit) {
        const layer = diagram.layers[hit.layerIdx];
        setActiveLayer(layer.id);
        addNode(layer.id, hit.gx, hit.gz);
      }
    } else if (tool === 'connect') {
      cancelConnect();
    } else if (tool === 'select') {
      selectNode(null);
    } else {
      // 点击空白层：激活该层
      const hit = screenToWorldGrid(sx, sy);
      if (hit) setActiveLayer(diagram.layers[hit.layerIdx].id);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const vs = viewState.current;
    if (vs.dragging) {
      vs.offsetX += e.clientX - vs.lastX;
      vs.offsetY += e.clientY - vs.lastY;
      vs.lastX = e.clientX;
      vs.lastY = e.clientY;
      draw();
    }
  };

  const handlePointerUp = () => {
    viewState.current.dragging = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const vs = viewState.current;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    vs.scale = Math.max(6, Math.min(50, vs.scale * factor));
    draw();
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: tool === 'node' ? 'crosshair' : 'default' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
