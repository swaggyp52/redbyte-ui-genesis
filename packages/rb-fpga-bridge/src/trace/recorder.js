import * as path from "path";

export class TraceRecorder {
  constructor({ outPath, fs }) {
    this.fs = fs;
    this.outPath = outPath;
    this.stream = null;
    this._open();
  }

  _open() {
    const dir = path.dirname(this.outPath);
    if (!this.fs.existsSync(dir)) {
      this.fs.mkdirSync(dir, { recursive: true });
    }
    this.stream = this.fs.createWriteStream(this.outPath, {
      flags: "w",
      encoding: "utf8",
    });
  }

  writeEvent(event) {
    if (!this.stream) return;
    const analog = Array.isArray(event.analog) ? event.analog : [];
    const line = `{"hw_tick":${event.hw_tick},"mono_seq":${event.mono_seq},"digital":${event.digital},"analog":${JSON.stringify(analog)},"ts_wall":${event.ts_wall}}\n`;
    this.stream.write(line);
  }

  flush() {
    if (!this.stream) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.stream.write("", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  close() {
    if (!this.stream) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.stream.end(() => resolve());
      this.stream.on("error", reject);
    });
  }
}
