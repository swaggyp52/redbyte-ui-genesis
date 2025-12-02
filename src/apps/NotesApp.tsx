import React, { useState } from "react";

export function NotesApp() {
  const [value, setValue] = useState(
    "Welcome to RedByte Notes.\n\nThis window is a real app.\n- Type here\n- Open multiple windows\n- Move them around\n"
  );

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center justify-between text-[0.7rem] text-slate-400">
        <span>NOTES://LOCAL</span>
        <span>Unsynced</span>
      </div>
      <textarea
        className="flex-1 w-full resize-none rounded-xl bg-slate-900/80 border border-slate-800/80 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-pink-500/70"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}









