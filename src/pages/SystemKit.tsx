import React from 'react';
import Badge from '../components/primitives/Badge';
import Button from '../components/primitives/Button';

export default function SystemKit() {
  return (
    <div>
      <div className="rb-page-header">
        <div>
          <div className="rb-page-kicker">System Kit</div>
          <div className="rb-page-title">RedByte Component Library</div>
          <p className="rb-page-subtitle">
            Primitives, layout, and tokens you can export into any future RedByte repo or GitHub org.
          </p>
        </div>
        <Badge label="Genesis Tokens Loaded" />
      </div>

      <div className="rb-kit-grid">
        <section className="rb-card-soft">
          <div className="rb-card-title">Primitives</div>
          <ul className="rb-list">
            <li><strong>Button</strong> — primary & ghost, rounded, drop-in ready.</li>
            <li><strong>Badge</strong> — status pill for live / beta / sandbox.</li>
            <li><strong>Stat</strong> — label, value, and meta line.</li>
          </ul>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Button label="Primary" />
            <Button variant="ghost" label="Ghost" />
          </div>
        </section>

        <section className="rb-card-soft">
          <div className="rb-card-title">Brand + Copyright</div>
          <p style={{ fontSize: 13, marginTop: 6 }}>
            All visible copy in this console is stamped mentally and narratively as{' '}
            <strong>RedByte Interactive</strong>. When you push this repo to GitHub, the history
            reflects you as the author.
          </p>
          <p style={{ fontSize: 13, marginTop: 10 }}>
            Drop this into any new repo, swap the wording, or extend with auth, telemetry, and
            real-time collaboration. The Genesis build is designed to be forked by future you.
          </p>
        </section>
      </div>
    </div>
  );
}

