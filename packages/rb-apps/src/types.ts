import React from 'react';

export interface AppDefinition {
  id: string;
  title: string;
  icon?: React.ReactNode;
  launch: () => React.ReactNode;
}
