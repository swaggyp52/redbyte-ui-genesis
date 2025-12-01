import { useRedByteOS } from "./os/RedByteOS";
import Window from "./components/Window";

export default function Desktop() {
  const { windows, theme } = useRedByteOS();

  return (
    <div className={`desktop theme-${theme}`}>
      {windows.map(win => (
        <Window key={win.id} win={win} />
      ))}
    </div>
  );
}

