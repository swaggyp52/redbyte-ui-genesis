import React from "react";
import ReactDOM from "react-dom/client";
import BootScreen from "./os/boot/BootScreen";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root")!);

function RootController() {
  const [booted, setBooted] = React.useState(false);

  if (!booted) {
    return <BootScreen onDone={() => setBooted(true)} />;
  }

  return <App />;
}

root.render(<RootController />);
