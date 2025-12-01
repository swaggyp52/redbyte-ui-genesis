import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ ok: true, name: "RedByte Ultra API", status: "online" });
});

app.post("/chat", (req, res) => {
  const message = (req.body && req.body.message) || "";
  const reply = message
    ? `RedByte AI demo: I received -> "${message}". This is a Node server responding.`
    : "RedByte AI demo: say something and I\`ll echo it back.";

  res.json({ reply });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`?? RedByte demo API running on http://localhost:${port}`);
});

