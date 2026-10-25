import { useEffect } from 'react';
import Scene from './components/Scene';
import Panel from './components/Panel';
import { useStore } from './store';

export default function App() {
  // 快捷键：F 切换「只看当前层」
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'f' || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      // 正在改名/输入时不抢按键
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      useStore.getState().toggleFocusMode();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app">
      <div className="canvas-area">
        <Scene />
      </div>
      <Panel />
    </div>
  );
}
