# RedByte

<div class="hero">
  <div class="hero-content">
    <h1 class="hero-title">
      <span class="gradient-text">RedByte</span>
    </h1>
    <p class="hero-tagline">Build • Simulate • Understand</p>
    <p class="hero-description">
      Visual logic circuit simulator. Build digital circuits, simulate behavior in real-time,
      and understand how logic gates work — all in your browser.
    </p>
    <div class="hero-actions">
      <a href="/playground" class="btn btn-primary">Try the Playground</a>
      <a href="/docs/getting-started" class="btn btn-secondary">Get Started</a>
    </div>
  </div>
  <div class="hero-visual">
    <div class="circuit-animation">
      <!-- Animated circuit preview -->
    </div>
  </div>
</div>

## Features

### 🎨 Visual Circuit Building
Drag and drop logic gates, connect them with wires, and see your circuit come to life. No code required.

### ⚡ Real-Time Simulation
Watch signals propagate through your circuit as you build. Instant feedback for every connection.

### 🎓 Learn by Doing
Interactive tutorials guide you from basic gates to complex circuits. Understand digital logic through experimentation.

### 🌐 Zero Setup
No installation, no configuration, no dependencies. Just open your browser and start building.

### 🎮 Multiple Views
Switch between schematic, circuit board, and 3D isometric views to understand your design from every angle.

### 📚 Built-in Examples
Start from pre-built circuits: half adders, full adders, flip-flops, counters, and more.

## Quick Start

```typescript
// Open the Logic Playground app
// 1. Click the Logic icon in the dock
// 2. Drag gates from the toolbar
// 3. Connect inputs to outputs
// 4. Toggle input switches to simulate
```

## Use Cases

**Education**
Perfect for students learning digital logic, Boolean algebra, and computer architecture fundamentals.

**Prototyping**
Quickly sketch out circuit ideas before committing to hardware or HDL implementation.

**Experimentation**
Test hypotheses, debug logic, and explore circuit behavior without risk or cost.

**Teaching**
Create interactive demonstrations for classroom instruction or online courses.

## Architecture

RedByte is built as a modern monorepo with:

- **@redbyte/rb-logic-core** — Pure logic simulation engine
- **@redbyte/rb-logic-view** — 2D schematic rendering
- **@redbyte/rb-logic-3d** — 3D isometric visualization
- **@redbyte/rb-logic-adapter** — View transformation layer
- **@redbyte/rb-shell** — Desktop shell environment
- **@redbyte/rb-apps** — Built-in applications

## Documentation

- [Getting Started](./getting-started.md)
- [Logic Gates Reference](./logic-gates.md)
- [API Documentation](./api/README.md)
- [Architecture Overview](./architecture.md)
- [Contributing Guide](./contributing.md)

## Community

- [GitHub Repository](https://github.com/swaggyp52/redbyte-ui-genesis)
- [Issue Tracker](https://github.com/swaggyp52/redbyte-ui-genesis/issues)
- [Discussions](https://github.com/swaggyp52/redbyte-ui-genesis/discussions)

## License

MIT License — feel free to use, modify, and distribute.

---

<div class="footer-cta">
  <h2>Ready to start building?</h2>
  <a href="/playground" class="btn btn-large btn-primary">Launch Playground</a>
</div>

<style>
.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
  padding: 4rem 0;
  margin-bottom: 4rem;
}

.hero-title {
  font-size: 4rem;
  font-weight: 700;
  margin: 0;
  line-height: 1.1;
}

.gradient-text {
  background: linear-gradient(135deg, #ff0000, #0087ff, #8000ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-tagline {
  font-size: 2rem;
  font-weight: 500;
  margin: 1rem 0;
  color: #6c757d;
}

.hero-description {
  font-size: 1.25rem;
  line-height: 1.6;
  margin: 1.5rem 0;
  color: #495057;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 500;
  border-radius: 0.5rem;
  text-decoration: none;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #ff0000, #0087ff);
  color: white;
  box-shadow: 0 4px 12px rgba(255, 0, 0, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 0, 0, 0.4);
}

.btn-secondary {
  background: #e9ecef;
  color: #212529;
}

.btn-secondary:hover {
  background: #dee2e6;
}

.btn-large {
  padding: 1rem 3rem;
  font-size: 1.25rem;
}

.circuit-animation {
  width: 100%;
  height: 400px;
  background: linear-gradient(135deg, #0a0c0e, #212529);
  border-radius: 1rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
}

.footer-cta {
  text-align: center;
  padding: 4rem 0;
  margin-top: 4rem;
  border-top: 2px solid #dee2e6;
}

.footer-cta h2 {
  font-size: 2.5rem;
  margin-bottom: 2rem;
}

@media (max-width: 768px) {
  .hero {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .hero-title {
    font-size: 2.5rem;
  }

  .hero-tagline {
    font-size: 1.5rem;
  }

  .hero-actions {
    flex-direction: column;
  }
}
</style>
