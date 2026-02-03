/**
 * Local Ops Server
 *
 * Provides REST API for Lab Examiner UI to call the autonomous agent pipeline
 * Binds to 127.0.0.1 only (local development only)
 */
import express from 'express';
import cors from 'cors';
import labsRouter from './routes/labs';
const app = express();
const PORT = process.env.OPS_PORT || 3001;
// Middleware
app.use(express.json());
// CORS: Allow only localhost origins
app.use(cors({
    origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
    credentials: true,
}));
// Routes
app.use(labsRouter);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Error handler
app.use((err, req, res, next) => {
    console.error(`Error: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
});
// Start server
app.listen(PORT, '127.0.0.1', () => {
    console.log(`Ops Server running at http://127.0.0.1:${PORT}`);
    console.log(`Local dev only. CORS restricted to localhost origins.`);
});
