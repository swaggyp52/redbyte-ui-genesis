import React, { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");

  return (
    <div className="flex items-center justify-center h-[80vh]">
      <div className="p-10 bg-neutral-900 border border-neutral-700 rounded-2xl w-80 text-white">
        <h1 className="text-2xl font-bold mb-6">Login</h1>
        <input
          className="w-full px-3 py-2 mb-4 bg-neutral-800 rounded"
          placeholder="Email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
        />
        <button className="w-full py-2 bg-red-600 rounded-lg">Sign In</button>
      </div>
    </div>
  );
}
