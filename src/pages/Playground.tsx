import React from 'react';
import Badge from '../components/primitives/Badge';
import Button from '../components/primitives/Button';

export default function Playground() {
  return (
    <div>
      <div className="rb-page-header">
        <div>
          <div className="rb-page-kicker">Sandbox</div>
          <div className="rb-page-title">Live Copy Playground</div>
          <p className="rb-page-subtitle">
            A tiny universe where your words drive the interface kids and creators see.
          </p>
        </div>
        <Badge label="Imaginary Save Only" />
      </div>

      <div className="rb-playground-layout">
        <section className="rb-playground-preview">
          <div className="rb-playground-preview-orbit" />
          <div className="rb-playground-preview-core">
            My RedByte World · Snapshot-ready ✨
          </div>
        </section>

        <aside className="rb-playground-sidebar">
          <p>
            This is the narrative control surface. Imagine sliders, toggles, and prompt controls
            living here for real users.
          </p>
          <ul className="rb-list">
            <li>Title · “My RedByte World”</li>
            <li>Tagline · “A tiny universe for kids, creators, and engineers.”</li>
            <li>Session CTA · “Begin Session” and “Share with Crew”</li>
          </ul>
          <p style={{ marginTop: 10 }}>
            In this Genesis build, these are just visual anchors. When you wire your API and auth
            later, this panel turns into the real control room.
          </p>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <Button label="Begin Session" />
            <Button variant="ghost" label="Share with Crew" />
          </div>
        </aside>
      </div>
    </div>
  );
}
