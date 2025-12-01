import React from "react";

export default function AppLoader({ component: Component }) {
  if (!Component) {
    return (
      <div style={{ padding: 20, color: "white" }}>
        <h2>⚠ App Not Registered</h2>
        <p>This window has no component assigned.</p>
      </div>
    );
  }
  try {
    return <Component />;
  } catch (err) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        <h2>⚠ App Error</h2>
        <pre>{String(err)}</pre>
      </div>
    );
  }
}

