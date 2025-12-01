import React from "react";
import { motion } from "framer-motion";
import ShaderPlane from "../../components/shader/ShaderPlane";
import "./manifesto.css";

export default function Manifesto() {
  const chapters = [
    {
      title: "THE SIGNAL",
      body:
        "The world drowns in noise — interfaces that steal attention instead of empowering it. RedByte rejects that future.",
    },
    {
      title: "THE SHIFT",
      body:
        "The age of passive software is ending. Systems must think. Interfaces must adapt. Data must work for you, not against you.",
    },
    {
      title: "THE ENGINE",
      body:
        "RedByte Labs builds cyber-grade UX. Modular. Reactive. Intelligent. Capable of powering the tools of the next decade.",
    },
    {
      title: "THE MISSION",
      body:
        "To create a unified digital environment: part OS, part design system, part living intelligence.",
    },
  ];

  return (
    <div className="manifesto-root">
      <ShaderPlane />

      <div className="manifesto-container">
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="manifesto-title"
        >
          REDBYTE MANIFESTO
        </motion.h1>

        {chapters.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.2 }}
            className="chapter"
          >
            <h2>{c.title}</h2>
            <p>{c.body}</p>
          </motion.div>
        ))}

        <motion.a
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          href="/login"
          className="manifesto-enter"
        >
          ENTER REDBYTE OS
        </motion.a>
      </div>
    </div>
  );
}

