import { ReactNode } from "react";

export default function RBFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rb-frame">
      <div className="grain" />
      {children}
    </div>
  );
}

