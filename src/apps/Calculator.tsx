import React, { useState } from "react";

export default function Calculator() {
  const [value, setValue] = useState("");

  const press = (v) => setValue(value + v);
  const solve = () => {
    try { setValue(String(eval(value))); }
    catch { setValue("ERR"); }
  };

  return (
    <div style={{ padding: 20, color: "white", fontFamily: "monospace" }}>
      <h2>Calculator</h2>
      <input value={value} readOnly style={{
        width: "100%", padding: 10, marginBottom: 10,
        background: "black", color: "lime", fontSize: 18
      }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
        {"7894561230.+-*/".split("").map(c => (
          <button key={c} onClick={() => press(c)} style={{ padding: 10 }}>
            {c}
          </button>
        ))}
        <button onClick={solve} style={{ gridColumn: "span 4", padding: 10 }}> = </button>
      </div>
    </div>
  );
}
