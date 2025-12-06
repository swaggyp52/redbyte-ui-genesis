export class WindowEngine {
  constructor(manager, id) {
    this.manager = manager;
    this.id = id;

    this.el = null;
    this.dragging = false;
    this.resizing = false;
    this.offsetX = 0;
    this.offsetY = 0;
    this.startW = 0;
    this.startH = 0;

    // live position
    this.x = 180 + Math.random() * 40;
    this.y = 120 + Math.random() * 40;
    this.w = 560;
    this.h = 360;
  }

  attach(el) {
    this.el = el;
    this.apply();
  }

  apply() {
    if (!this.el) return;
    this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    this.el.style.width = this.w + "px";
    this.el.style.height = this.h + "px";
  }

  startDrag(e) {
    if (!this.el) return;
    this.dragging = true;
    this.offsetX = e.clientX - this.x;
    this.offsetY = e.clientY - this.y;
  }

  startResize(e) {
    this.resizing = true;
    this.startW = this.w;
    this.startH = this.h;
    this.offsetX = e.clientX;
    this.offsetY = e.clientY;
  }

  move(e) {
    if (this.dragging) {
      this.x = e.clientX - this.offsetX;
      this.y = e.clientY - this.offsetY;
      this.apply();
    }
    if (this.resizing) {
      this.w = Math.max(280, this.startW + (e.clientX - this.offsetX));
      this.h = Math.max(180, this.startH + (e.clientY - this.offsetY));
      this.apply();
    }
  }

  stop() {
    this.dragging = false;
    this.resizing = false;
  }
}
