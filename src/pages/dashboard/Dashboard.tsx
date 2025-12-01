import React from "react";
import { motion } from "framer-motion";
import { Rocket, Cpu, BarChart3 } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="px-6 text-white space-y-10">
      <motion.h1 initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="text-4xl font-black">
        Welcome to RedByte Dashboard
      </motion.h1>

      <div className="grid sm:grid-cols-3 gap-6">
        <Card icon={<Rocket />} title="Speed" value="0.9s build" />
        <Card icon={<Cpu />} title="System Load" value="32%" />
        <Card icon={<BarChart3 />} title="Analytics" value="+120%" />
      </div>
    </div>
  );
}

function Card({ icon, title, value }) {
  return (
    <motion.div whileHover={{scale:1.03}} className="p-6 rounded-2xl bg-neutral-900 border border-neutral-700">
      <div className="text-red-500 mb-2">{icon}</div>
      <h2 className="font-bold">{title}</h2>
      <p className="text-2xl font-black mt-2">{value}</p>
    </motion.div>
  );
}
