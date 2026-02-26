import React, { createContext, useContext, useState } from "react";

export interface FSNode {
  name: string;
  type: "file" | "folder";
  children?: FSNode[];
}

const defaultFS: FSNode = {
  name: "root",
  type: "folder",
  children: [
    { name: "projects", type: "folder", children: [] },
    { name: "notes.txt", type: "file" }
  ]
};

interface FileSystemContextType {
  root: FSNode;
  createFile: (path: string, name: string) => void;
}

const FSContext = createContext<FileSystemContextType | null>(null);

export const useFS = () => {
  const ctx = useContext(FSContext);
  if (!ctx) throw new Error("useFS must be inside FSProvider");
  return ctx;
};

export const FSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [root, setRoot] = useState<FSNode>(defaultFS);

  const createFile = (path: string, name: string) => {
    const parts = path.split("/").filter(Boolean);
    const newRoot = structuredClone(root);
    let cursor: FSNode = newRoot;

    for (const p of parts) {
      const next = cursor.children?.find(c => c.name === p && c.type === "folder");
      if (!next) return;
      cursor = next;
    }

    cursor.children = cursor.children || [];
    cursor.children.push({ name, type: "file" });
    setRoot(newRoot);
  };

  return (
    <FSContext.Provider value={{ root, createFile }}>
      {children}
    </FSContext.Provider>
  );
};
