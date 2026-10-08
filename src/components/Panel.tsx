import { useRef } from 'react';
import { useStore } from '../store';
import { Tool, NodeType, NODE_PRESETS, LAYER_COLORS } from '../types';

const TOOLS: { id: Tool; label: string; icon: string; hint: string }[] = [
  { id: 'select', label: '选择', icon: '↖', hint: '点击节点选中，拖拽旋转视角' },
  { id: 'node', label: '放置节点', icon: '▣', hint: '在激活层的网格上点击放置节点' },
  { id: 'connect', label: '连线', icon: '⇄', hint: '依次点击两个节点建立连接（可跨层）' },
  { id: 'delete', label: '删除', icon: '✕', hint: '点击节点或连线删除' },
];

const NODE_TYPES: NodeType[] = ['box', 'service', 'database', 'cache', 'lb', 'client'];

export default function Panel() {
  const {
    diagram, tool, setTool, nodeType, setNodeType,
    activeLayerId, setActiveLayer,
    addLayer, removeLayer, renameLayer, moveLayer,
    loadDiagram, clearDiagram,
  } = useStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = () => {
    const data = JSON.stringify(diagram, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ortho-arch-diagram.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = () => {
    const canvas = document.querySelector('.canvas-area canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ortho-arch-diagram.png';
    a.click();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        loadDiagram(data);
      } catch {
        alert('JSON 文件格式错误');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h1>OrthoArch</h1>
        <span className="subtitle">正交视角架构图编辑器</span>
      </div>

      {/* 工具栏 */}
      <section className="section">
        <h3>工具</h3>
        <div className="tool-grid">
          {TOOLS.map(t => (
            <button
              key={t.id}
              className={`tool-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => setTool(t.id)}
              title={t.hint}
            >
              <span className="tool-icon">{t.icon}</span>
              <span className="tool-label">{t.label}</span>
            </button>
          ))}
        </div>
        {tool === 'node' && (
          <div className="node-type-grid">
            {NODE_TYPES.map(nt => (
              <button
                key={nt}
                className={`node-type-btn ${nodeType === nt ? 'active' : ''}`}
                onClick={() => setNodeType(nt)}
                style={{ borderColor: NODE_PRESETS[nt].color }}
              >
                <span className="swatch" style={{ background: NODE_PRESETS[nt].color }} />
                {NODE_PRESETS[nt].label}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 层管理 */}
      <section className="section">
        <div className="section-head">
          <h3>图层</h3>
          <button className="btn-primary" onClick={addLayer}>+ 添加层</button>
        </div>
        <div className="layer-list">
          {diagram.layers.length === 0 && (
            <p className="empty">暂无图层，点击"添加层"开始</p>
          )}
          {diagram.layers.map((layer, idx) => (
            <div
              key={layer.id}
              className={`layer-item ${activeLayerId === layer.id ? 'active' : ''}`}
              onClick={() => setActiveLayer(layer.id)}
            >
              <span className="layer-color" style={{ background: layer.color }} />
              <input
                className="layer-name"
                value={layer.name}
                onChange={(e) => renameLayer(layer.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="layer-idx">{idx + 1}</span>
              <div className="layer-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="icon-btn"
                  onClick={() => moveLayer(layer.id, 'up')}
                  title="上移"
                  disabled={idx === 0}
                >↑</button>
                <button
                  className="icon-btn"
                  onClick={() => moveLayer(layer.id, 'down')}
                  title="下移"
                  disabled={idx === diagram.layers.length - 1}
                >↓</button>
                <button
                  className="icon-btn danger"
                  onClick={() => removeLayer(layer.id)}
                  title="删除层"
                >🗑</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 导入导出 */}
      <section className="section">
        <h3>导入 / 导出</h3>
        <div className="io-grid">
          <button className="btn" onClick={handleExportJSON}>导出 JSON</button>
          <button className="btn" onClick={() => fileInputRef.current?.click()}>导入 JSON</button>
          <button className="btn" onClick={handleExportPNG}>导出 PNG</button>
          <button className="btn danger" onClick={() => {
            if (confirm('确定清空所有内容？')) clearDiagram();
          }}>清空</button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={handleImportJSON}
        />
      </section>

      {/* 操作提示 */}
      <section className="section tips">
        <h3>操作提示</h3>
        <ul>
          <li>鼠标左键拖拽：旋转视角</li>
          <li>鼠标右键拖拽：平移</li>
          <li>滚轮：缩放</li>
          <li>先选中激活层，再在网格上放置节点</li>
          <li>连线工具支持跨层（同层 L 形、跨层垂直+水平）</li>
        </ul>
      </section>
    </div>
  );
}
