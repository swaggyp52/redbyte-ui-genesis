import React from 'react';

export const ClassroomModeBanner: React.FC = () => {
  return (
    <div
      className="bg-blue-900 text-blue-50 px-4 py-2 text-sm flex items-center justify-between"
      data-testid="classroom-mode-banner"
    >
      <span>
        <strong>🎓 Classroom Mode:</strong> XOR Lab (Beginner)
      </span>
    </div>
  );
};
