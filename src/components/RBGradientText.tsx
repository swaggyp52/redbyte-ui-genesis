import { ReactNode } from "react";

export default function RBGradientText({ children }: { children: ReactNode }) {
  return <span className="rb-gradient-text">{children}</span>;
}

