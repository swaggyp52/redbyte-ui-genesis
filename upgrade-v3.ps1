Write-Host "=== REDBYTE OS UPGRADE v3 — APP LOADER ===" -ForegroundColor Cyan

# --------- 1. Ensure apps folder exists ---------
$appsFolder = "src/apps"
if (!(Test-Path $appsFolder)) {
    New-Item -ItemType Directory $appsFolder -Force | Out-Null
    Write-Host "✔ Created apps folder"
}

# --------- 2. AppLoader component ---------
@'
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
'@ | Set-Content "src/components/AppLoader.tsx" -Encoding UTF8

Write-Host "✔ AppLoader.tsx installed"


# --------- 3. Calculator App ---------
@'
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
'@ | Set-Content "src/apps/Calculator.tsx" -Encoding UTF8

Write-Host "✔ Calculator installed"


# --------- 4. apps.ts registry ---------
@'
import Calculator from "../apps/Calculator";

export const apps = {
  calculator: {
    id: "calculator",
    name: "Calculator",
    component: Calculator,
  }
};
'@ | Set-Content "src/os/apps.ts" -Encoding UTF8

Write-Host "✔ apps.ts updated"


# --------- 5. Patch RedByteOS.ts safely ---------
$osFile = "src/os/RedByteOS.ts"
if (Test-Path $osFile) {
    $content = Get-Content $osFile -Raw

    # Add import only if missing
    if ($content -notmatch "AppLoader") {
        $content = $content -replace "from react;" , "from react;`nimport AppLoader from '../components/AppLoader';"
    }

    # Replace raw component render
    $content = $content -replace "app.component\(\)" , "<AppLoader component={app.component} />"

    $content | Set-Content $osFile -Encoding UTF8

    Write-Host "✔ RedByteOS patched"
} else {
    Write-Host "⚠ RedByteOS.ts not found — skipping" -ForegroundColor Yellow
}


Write-Host "=== UPGRADE COMPLETE ===" -ForegroundColor Green

