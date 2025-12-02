import React from "react";
import { motion } from "framer-motion";
import "./index.css";

export default function App() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "black",
        overflow: "hidden",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Floating Glow Orb */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{
          width: 180,
          height: 180,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 30%, #00eaff, #0066ff, #000)",
          filter: "blur(20px)",
          position: "absolute",
          top: "10%",
        }}
      />

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        style={{
          fontSize: "3rem",
          fontWeight: "700",
          textShadow: "0 0 20px #00eaff",
        }}
      >
        RedByte OS
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.7 }}
        style={{
          fontSize: "1.2rem",
          opacity: 0.8,
          marginTop: 8,
        }}
      >
        Hyper-Reactive Interface System ⚡
      </motion.p>

      {/* Button -> Launch OS */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        onClick={() => {
          window.location.href = "/desktop";
        }}
        style={{
          marginTop: 40,
          padding: "14px 32px",
          fontSize: "1.1rem",
          background: "linear-gradient(90deg,#00eaff,#0066ff)",
          border: "none",
          borderRadius: 12,
          cursor: "pointer",
          color: "white",
          fontWeight: "600",
          boxShadow: "0 0 20px #00aaff99",
        }}
      >
        Enter OS
      </motion.button>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 1.8 }}
        style={{ position: "absolute", bottom: 20, fontSize: "0.9rem" }}
      >
        © 2025 RedByte Systems — All Systems Online  
      </motion.div>
    </div>
  );
}
