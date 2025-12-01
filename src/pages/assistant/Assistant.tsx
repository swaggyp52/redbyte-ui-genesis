import React, { useState } from "react";
import { motion } from "framer-motion";

export default function Assistant() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");

  function send() {
    if (!input) return;
    setMsgs([...msgs, { from: "user", text: input }]);
    setTimeout(()=>setMsgs(m=>[...m, { from:"ai", text:"(AI demo response)" }]), 500);
    setInput("");
  }

  return (
    <div className="px-6 py-10 text-white flex flex-col h-[80vh]">
      <h1 className="text-3xl font-bold mb-6">RedByte Assistant</h1>

      <div className="flex-1 overflow-y-auto space-y-3">
        {msgs.map((m,i)=>(
          <motion.div key={i} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
            className={"p-3 rounded-xl max-w-[70%] " + (m.from=="user"?"bg-red-600 ml-auto":"bg-neutral-800")}>
            {m.text}
          </motion.div>
        ))}
      </div>

      <div className="flex mt-4 gap-2">
        <input
          className="flex-1 px-3 py-2 bg-neutral-800 rounded"
          value={input}
          onChange={e=>setInput(e.target.value)}
          placeholder="Say something…"
        />
        <button className="px-4 bg-red-600 rounded-lg" onClick={send}>Send</button>
      </div>
    </div>
  );
}
