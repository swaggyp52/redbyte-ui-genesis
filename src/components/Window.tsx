import { useRedByteOS } from "../os/RedByteOS";

export default function Window({ win }) {
  const { closeWindow, focusWindow, minimizeWindow, toggleFullscreen } =
    useRedByteOS();

  if (win.minimized) return null;

  const style = {
    position: "absolute",
    left: win.x,
    top: win.y,
    width: win.fullscreen ? "100vw" : win.width,
    height: win.fullscreen ? "100vh" : win.height,
    zIndex: win.z,
    background: "rgba(20,20,20,0.9)",
    borderRadius: "10px",
    border: "1px solid #333",
    backdropFilter: "blur(20px)",
  };

  return (
    <div style={style} onMouseDown={() => focusWindow(win.id)}>
      <div className="titlebar">
        <span>{win.title}</span>
        <div className="buttons">
          <button onClick={() => minimizeWindow(win.id)}>—</button>
          <button onClick={() => toggleFullscreen(win.id)}>⬜</button>
          <button onClick={() => closeWindow(win.id)}>✕</button>
        </div>
      </div>
      <div className="window-content">
        {/* the app component */}
        <win.component />
      </div>
    </div>
  );
}
