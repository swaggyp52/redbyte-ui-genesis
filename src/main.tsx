import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import BootScreen from "./os/boot/BootScreen";

const container = document.getElementById("root")!;
const root = ReactDOM.createRoot(container);

function RootController() {
  const [bootDone, setBootDone] = React.useState(false);

  if (!bootDone) {
    return (
      <BootScreen
        durationMs={15000}
        onDone={() => setBootDone(true)}
      />
    );
  }

  return <App />;
}

root.render(<RootController />);




















