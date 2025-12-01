import { ReactNode } from "react";

export default function RBCard({ children }: { children: ReactNode }) {
  return <div className="rb-card">{children}</div>;
}

