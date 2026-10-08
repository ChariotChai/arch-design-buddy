import * as THREE from 'three';
import { CELL, LAYER_GAP, GRID_SIZE } from './types';
import { Diagram, Node, Layer } from './types';
import { findNode } from './store';

// 网格坐标 -> 世界坐标 (XZ 平面中心)
export function gridToWorld(gx: number, gz: number): THREE.Vector2 {
  return new THREE.Vector2(
    (gx - GRID_SIZE / 2 + 0.5) * CELL,
    (gz - GRID_SIZE / 2 + 0.5) * CELL
  );
}

// 世界坐标 -> 网格坐标
export function worldToGrid(x: number, z: number): { gx: number; gz: number } {
  return {
    gx: Math.floor(x / CELL + GRID_SIZE / 2),
    gz: Math.floor(z / CELL + GRID_SIZE / 2),
  };
}

// 层索引 -> 世界 Y
export function layerIndexToY(index: number): number {
  return index * LAYER_GAP;
}

// 获取层索引
export function getLayerIndex(diagram: Diagram, layerId: string): number {
  return diagram.layers.findIndex(l => l.id === layerId);
}

// 节点中心点世界坐标
export function nodeWorldPos(diagram: Diagram, node: Node): THREE.Vector3 {
  const p = gridToWorld(node.gx, node.gz);
  const layerIdx = getLayerIndex(diagram, node.layerId);
  const y = layerIndexToY(layerIdx);
  return new THREE.Vector3(p.x, y, p.y);
}

/**
 * 计算连线的折线路径点（正交路由）
 * - 同层：L 形（先 X 后 Z）
 * - 跨层：从源节点顶部垂直上升到中间高度 -> 水平 L 形 -> 垂直下降到目标节点顶部
 */
export function computeConnectionPath(
  diagram: Diagram,
  conn: { fromNodeId: string; toNodeId: string },
  nodeHeight = 0.6
): THREE.Vector3[] {
  const from = findNode(diagram, conn.fromNodeId);
  const to = findNode(diagram, conn.toNodeId);
  if (!from || !to) return [];

  const fromPos = nodeWorldPos(diagram, from.node);
  const toPos = nodeWorldPos(diagram, to.node);
  const halfH = nodeHeight / 2;

  // 节点顶部的 Y 坐标
  const fromTopY = fromPos.y + halfH;
  const toTopY = toPos.y + halfH;

  const points: THREE.Vector3[] = [];

  if (from.node.layerId === to.node.layerId) {
    // 同层连线：从顶部出发，L 形
    points.push(new THREE.Vector3(fromPos.x, fromTopY, fromPos.z));
    // 中间转折点：X 对齐目标，Z 保持源
    points.push(new THREE.Vector3(toPos.x, fromTopY, fromPos.z));
    points.push(new THREE.Vector3(toPos.x, toTopY, toPos.z));
  } else {
    // 跨层连线
    // 取两层之间的中间 Y 作为路由高度
    const midY = (fromTopY + toTopY) / 2 + LAYER_GAP * 0.15;
    const routeY = Math.max(fromTopY, toTopY) + LAYER_GAP * 0.3;

    // 从源节点顶部垂直上升
    points.push(new THREE.Vector3(fromPos.x, fromTopY, fromPos.z));
    points.push(new THREE.Vector3(fromPos.x, routeY, fromPos.z));
    // 水平 L 形：先 X 后 Z
    points.push(new THREE.Vector3(toPos.x, routeY, fromPos.z));
    points.push(new THREE.Vector3(toPos.x, routeY, toPos.z));
    // 垂直下降到目标节点顶部
    points.push(new THREE.Vector3(toPos.x, toTopY, toPos.z));
  }

  return points;
}

// 生成连接管道的几何体（沿路径点的线框管）
export function pathToTubePoints(points: THREE.Vector3[]): THREE.Vector3[] {
  // 直接返回点，用 Line 或 TubeGeometry 渲染
  return points;
}
