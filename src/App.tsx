import Scene from './components/Scene';
import Panel from './components/Panel';

export default function App() {
  return (
    <div className="app">
      <div className="canvas-area">
        <Scene />
      </div>
      <Panel />
    </div>
  );
}
