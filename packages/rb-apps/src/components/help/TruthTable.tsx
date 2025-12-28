// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';

export interface TruthTableProps {
  headers: string[];
  rows: (string | number)[][];
  highlightedCells?: Set<string>; // Format: "row-col" e.g. "0-2"
  className?: string;
}

/**
 * TruthTable - Standardized truth table component
 * Provides consistent styling for truth tables across lessons
 */
export const TruthTable: React.FC<TruthTableProps> = ({ headers, rows, highlightedCells, className = '' }) => {
  return (
    <table className={`border-collapse my-2 w-full max-w-sm ${className}`}>
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th key={index} className="border border-slate-600 px-2 py-2 bg-slate-800 text-gray-200">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => {
              const cellKey = `${rowIndex}-${cellIndex}`;
              const isHighlighted = highlightedCells?.has(cellKey);

              return (
                <td
                  key={cellIndex}
                  className={`border border-slate-600 px-2 py-2 text-center ${
                    isHighlighted ? 'bg-blue-950' : rowIndex % 2 === 0 ? 'bg-slate-900/50' : 'bg-slate-900'
                  }`}
                >
                  {cell}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
