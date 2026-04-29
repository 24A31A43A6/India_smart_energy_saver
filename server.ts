import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- ML LOGIC SIMULATION ---
// We simulate the logic provided in the prompt for a hackathon demo.

const REGIONS = {
  'Northern': { peak: 84.2, base_ratio: 0.50, peak_hour: 20 },
  'Western':  { peak: 78.6, base_ratio: 0.49, peak_hour: 21 },
  'Southern': { peak: 72.3, base_ratio: 0.54, peak_hour: 19 },
  'Eastern':  { peak: 29.4, base_ratio: 0.55, peak_hour: 20 },
  'NE':       { peak: 4.8,  base_ratio: 0.56, peak_hour: 19 },
};

const SEASON_MULT: Record<number, number> = { 0: 1.00, 1: 0.88, 2: 0.82, 3: 0.91 };

function getHourlyProfile(region: string, hour: number, month: number) {
  const cfg = REGIONS[region as keyof typeof REGIONS] || REGIONS['Northern'];
  const season_q = Math.floor((month % 12) / 3);
  const base = cfg.peak * cfg.base_ratio;
  const mult = SEASON_MULT[season_q];
  
  let load = base;
  if (hour < 5) load = base * 0.78;
  else if (hour < 9) load = base + (cfg.peak * 0.6 - base) * (hour - 5) / 4;
  else if (hour < 13) load = cfg.peak * 0.6;
  else if (hour < 16) load = cfg.peak * 0.55;
  else if (hour < cfg.peak_hour) load = cfg.peak * 0.55 + (cfg.peak - cfg.peak * 0.55) * (hour - 16) / Math.max(1, cfg.peak_hour - 16);
  else if (hour === cfg.peak_hour) load = cfg.peak;
  else load = cfg.peak - (cfg.peak - base * 1.05) * (hour - cfg.peak_hour) / (23 - cfg.peak_hour);
  
  return load * mult;
}

function generateData(region: string, days: number = 7) {
  const data = [];
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  for (let d = 0; d < days * 24; d++) {
    const dt = new Date(start.getTime() + d * 60 * 60 * 1000);
    const hour = dt.getHours();
    const month = dt.getMonth() + 1;
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    
    const baseLoad = getHourlyProfile(region, hour, month);
    const noise = baseLoad * (Math.random() * 0.05 - 0.025);
    const weekendFactor = isWeekend ? 0.92 : 1.0;
    
    const actual = (baseLoad + noise) * weekendFactor;
    
    // Model Predictions Simulation
    // Gradient Boosting: Best (~2.5% error)
    const gbt = actual * (1 + (Math.random() * 0.04 - 0.02));
    // RNN: Moderate (~6% error)
    const rnn = actual * (1 + (Math.random() * 0.12 - 0.06));
    // SARIMA: Poor (~15% error)
    const sarima = actual * (1 + (Math.random() * 0.30 - 0.15));

    data.push({
      timestamp: dt.toISOString(),
      actual: parseFloat(actual.toFixed(2)),
      gbt: parseFloat(gbt.toFixed(2)),
      rnn: parseFloat(rnn.toFixed(2)),
      sarima: parseFloat(sarima.toFixed(2)),
      hour,
      region
    });
  }
  return data;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/data", (req, res) => {
    const region = (req.query.region as string) || "Northern";
    const days = parseInt(req.query.days as string) || 7;
    res.json(generateData(region, days));
  });

  app.get("/api/predict", (req, res) => {
    const region = (req.query.region as string) || "Northern";
    // Predict next 24 hours
    const data = [];
    const now = new Date();
    for (let h = 0; h < 24; h++) {
      const dt = new Date(now.getTime() + h * 60 * 60 * 1000);
      const hour = dt.getHours();
      const month = dt.getMonth() + 1;
      const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
      
      const baseLoad = getHourlyProfile(region, hour, month);
      const weekendFactor = isWeekend ? 0.92 : 1.0;
      const predicted = baseLoad * weekendFactor;

      data.push({
        timestamp: dt.toISOString(),
        predicted: parseFloat(predicted.toFixed(2)),
        hour,
        region
      });
    }
    res.json(data);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
