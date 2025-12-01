import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function Boot() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDone(true), 2600);
    return () => clearTimeout(timer);
  }, []);

  if (done) {
    window.location.href = "/";
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-black text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
        className="text-center"
      >
        <h1 className="text-5xl font-extrabold tracking-widest neon-text">
          REDBYTE OS
        </h1>
        <p className="text-gray-400 mt-4 tracking-wider">
          Initializing system modules...
        </p>

        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.8, ease: "easeInOut", delay: 0.4 }}
          className="h-1 bg-red-500 rounded-full mt-8 shadow-lg"
        />
      </motion.div>
    </div>
  );
}
