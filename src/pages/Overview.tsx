import React from 'react';
import Badge from '../components/primitives/Badge';
import Stat from '../components/primitives/Stat';

export default function Overview() {
  return (
    <div>
      <div className="rb-page-header">
        <div>
          <div className="rb-page-kicker">RedByte UI • Genesis Surface</div>
          <div className="rb-page-title">Welcome to RedByte UI</div>
          <p className="rb-page-subtitle">
            Your cyber-crafted design system is live. Routes, primitives, and playground are wired in.
          </p>
        </div>
        <Badge label="Live Sandbox" />
      </div>

      <div className="rb-grid-2">
        <section className="rb-card">
          <div className="rb-card-header">
            <div>
              <div className="rb-card-title">Live Copy Playground</div>
              <div className="rb-card-subtitle">
                Tune the language your crew sees in the console.
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13 }}>
            Use the navigation on the left to explore Playground and System Kit. This overview stays
            as your gentle landing slice — a tiny universe for kids, creators, and engineers.
          </p>
          <div className="rb-stats-row">
            <Stat label="Slices wired" value="3" meta="+Playground, +Kit, +Overview" />
            <Stat label="Primitives" value="4" meta="Button, Badge, Stat, Card" />
            <Stat label="Brand lock-in" value="100%" meta="RedByte Interactive" />
          </div>
        </section>

        <aside className="rb-card-soft">
          <div className="rb-card-title">Release Notes · v2.0 Genesis</div>
          <ul className="rb-list">
            <li>Shell layout with sidebar + topbar.</li>
            <li>Route-aware navigation: Overview, Playground, System Kit.</li>
            <li>Neon grid background and cyber-soft surfaces.</li>
            <li>RedByte copyright baked into the experience text.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
