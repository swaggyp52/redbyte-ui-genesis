import React from "react";
import { motion } from "framer-motion";
import { Rocket, Cpu, BarChart3, Bell, MessageCircle } from "lucide-react";
import { useAppState } from "../../state/AppState";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user, notifications } = useAppState();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="px-4 sm:px-8 pb-16 space-y-10 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4"
      >
        <p className="text-xs uppercase tracking-[0.25em] text-red-500 mb-2">
          RedByte Genesis
        </p>
        <h1 className="text-3xl sm:text-4xl font-black">
          Hey {user ?? "Operator"},
          <span className="text-red-500"> your UI system is live.</span>
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-3 max-w-xl">
          This is your all-in-one RedByte control deck: dashboards, AI,
          marketplace and demo auth in a single lightweight React + Vite app.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card icon={<Rocket size={16} />} title="Launch status" value="ONLINE">
          Deployed on GitHub Pages.
        </Card>
        <Card icon={<Cpu size={16} />} title="Runtime" value="Vite • React 18">
          Tailwind + Framer Motion.
        </Card>
        <Card
          icon={<BarChart3 size={16} />}
          title="Notifications"
          value={unread > 0 ? `${unread} unread` : "All clear"}
        >
          Open the bell in the top bar.
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Quick actions</h2>
            <span className="text-[10px] text-neutral-500 uppercase">
              Live demo
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Link
              to="/assistant"
              className="px-3 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 flex items-center gap-2"
            >
              <MessageCircle size={14} />
              Open AI console
            </Link>
            <Link
              to="/pricing"
              className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700/80 hover:bg-neutral-800 flex items-center gap-2"
            >
              <BarChart3 size={14} />
              View pricing
            </Link>
            <Link
              to="/marketplace"
              className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700/80 hover:bg-neutral-800 flex items-center gap-2"
            >
              <Bell size={14} />
              Explore marketplace
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 space-y-2 text-xs text-neutral-300"
        >
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-sm font-semibold">System meta</h2>
            <span className="text-[10px] text-red-500">v2.0 • All Ultra</span>
          </div>
          <p>
            • Frontend: React 18, Vite 5, Tailwind, Framer Motion, React Router.
          </p>
          <p>• Demo auth: fake JWT, localStorage user session.</p>
          <p>• AI: Assistant UI wired for a simple Node API.</p>
          <p>• Hosting: GitHub Pages (static build).</p>
        </motion.div>
      </div>
    </div>
  );
}

function Card(props: {
  icon: React.ReactNode;
  title: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, translateY: -2 }}
      className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="text-red-500">{props.icon}</span>
          <span>{props.title}</span>
        </div>
        <span className="text-xs font-semibold text-neutral-200">
          {props.value}
        </span>
      </div>
      {props.children && (
        <p className="text-[11px] text-neutral-400">{props.children}</p>
      )}
    </motion.div>
  );
}
