import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import HoloOrb from "../../components/3d/HoloOrb";
import ParticleField from "../../components/3d/ParticleField";
import "./landing3d.css";

export default function Landing() {
  return (
    <div className="landing3d-root">
      <ParticleField />

      <div className="orb-wrap">
        <HoloOrb />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        className="landing3d-content"
      >
        <h1 className="landing3d-title">RedByte Labs</h1>
        <p className="landing3d-subtitle">
          Building the next era of cyber interfaces & intelligent systems.
        </p>

        <Link to="/login" className="landing3d-enter">
          Enter RedByte OS <ArrowRight size={22} />
        </Link>
      </motion.div>
    </div>
  );
}

