import React from "react";

export interface AppDefinition {
  id: string;
  name: string;
  icon?: React.ReactNode;
  description?: string;
  group?: "system" | "dev" | "experiments" | "agents";
  entry: React.ComponentType<any>;
}

