/**
 * Energy Grid Load Forecasting API Server
 * Node.js + Express backend for renewable energy management
 * Provides REST API endpoints for forecasting and grid control
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage for real-time data
let currentGridState = {
  solarCapacity: 0.67,
  windCapacity: 0.54,
  batteryLevel: 0.82,
  gridLoad: 0.71,
  backupActive: false,
  lastUpdated: new Date().toISOString()
};

let forecastCache = {
  data: null,
  timestamp: null,
  ttl: 300000 // 5 minutes
};

// Utility: Run Python script
async function runPythonScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [scriptPath, ...args]);
    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

// Utility: Generate synthetic real-time data
function generateRealtimeData() {
  const hour = new Date().getHours();
  
  // Solar: high during day (6am-6pm)
  const solarBase = Math.max(0, Math.sin((hour - 6) * Math.PI / 12) * 0.8);
  const solarNoise = (Math.random() - 0.5) * 0.1;
  currentGridState.solarCapacity = Math.max(0, Math.min(1, solarBase + solarNoise));
  
  // Wind: moderate variability
  const windBase = 0.4 + Math.sin(hour * Math.PI / 6) * 0.3;
  const windNoise = (Math.random() - 0.5) * 0.15;
  currentGridState.windCapacity = Math.max(0, Math.min(1, windBase + windNoise));
  
  // Grid load: follows demand curve
  const loadBase = 0.5 + Math.sin((hour - 12) * Math.PI / 12) * 0.3;
  const loadNoise = (Math.random() - 0.5) * 0.05;
  currentGridState.gridLoad = Math.max(0.2, Math.min(1, loadBase + loadNoise));
  
  // Battery management
  const totalGen = currentGridState.solarCapacity + currentGridState.windCapacity;
  const energyDelta = (totalGen - currentGridState.gridLoad) * 0.02;
  currentGridState.batteryLevel = Math.max(0, Math.min(1, currentGridState.batteryLevel + energyDelta));
  
  // Auto backup activation
  if (totalGen < currentGridState.gridLoad * 0.85 && currentGridState.batteryLevel < 0.3) {
    currentGridState.backupActive = true;
  } else if (totalGen > currentGridState.gridLoad * 1.1) {
    currentGridState.backupActive = false;
  }
  
  currentGridState.lastUpdated = new Date().toISOString();
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    version: '4.2.1'
  });
});

// Get current grid state
app.get('/api/grid/state', (req, res) => {
  generateRealtimeData();
  res.json({
    success: true,
    data: currentGridState
  });
});

// Update grid state (manual control)
app.post('/api/grid/state', (req, res) => {
  const { solarCapacity, windCapacity, batteryLevel, gridLoad, backupActive } = req.body;
  
  if (solarCapacity !== undefined) currentGridState.solarCapacity = Math.max(0, Math.min(1, solarCapacity));
  if (windCapacity !== undefined) currentGridState.windCapacity = Math.max(0, Math.min(1, windCapacity));
  if (batteryLevel !== undefined) currentGridState.batteryLevel = Math.max(0, Math.min(1, batteryLevel));
  if (gridLoad !== undefined) currentGridState.gridLoad = Math.max(0, Math.min(1, gridLoad));
  if (backupActive !== undefined) currentGridState.backupActive = backupActive;
  
  currentGridState.lastUpdated = new Date().toISOString();
  
  res.json({
    success: true,
    message: 'Grid state updated',
    data: currentGridState
  });
});

// Get 24-hour forecast
app.get('/api/forecast/24h', async (req, res) => {
  try {
    // Check cache
    if (forecastCache.data && forecastCache.timestamp) {
      const age = Date.now() - forecastCache.timestamp;
      if (age < forecastCache.ttl) {
        return res.json({
          success: true,
          cached: true,
          data: forecastCache.data
        });
      }
    }
    
    // Run Python forecasting script
    const scriptPath = path.join(__dirname, 'beta_regression.py');
    await runPythonScript(scriptPath);
    
    // Read forecast output
    const forecastPath = path.join(__dirname, 'forecast_output.json');
    const forecastData = await fs.readFile(forecastPath, 'utf8');
    const forecast = JSON.parse(forecastData);
    
    // Update cache
    forecastCache.data = forecast;
    forecastCache.timestamp = Date.now();
    
    res.json({
      success: true,
      cached: false,
      data: forecast
    });
  } catch (error) {
    console.error('Forecast error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate forecast',
      message: error.message
    });
  }
});

// Get quantile forecast for specific metric
app.get('/api/forecast/quantile/:metric', async (req, res) => {
  try {
    const { metric } = req.params;
    const { quantile = 0.5 } = req.query;
    
    if (!['solar', 'wind'].includes(metric)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid metric. Use "solar" or "wind"'
      });
    }
    
    // Get cached or fresh forecast
    let forecast = forecastCache.data;
    if (!forecast) {
      const scriptPath = path.join(__dirname, 'beta_regression.py');
      await runPythonScript(scriptPath);
      const forecastPath = path.join(__dirname, 'forecast_output.json');
      const forecastData = await fs.readFile(forecastPath, 'utf8');
      forecast = JSON.parse(forecastData);
      forecastCache.data = forecast;
      forecastCache.timestamp = Date.now();
    }
    
    const quantileKey = `p${Math.round(parseFloat(quantile) * 100)}`;
    
    res.json({
      success: true,
      metric,
      quantile: parseFloat(quantile),
      data: forecast[metric][quantileKey] || forecast[metric].p50
    });
  } catch (error) {
    console.error('Quantile forecast error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate quantile forecast',
      message: error.message
    });
  }
});

// Grid control recommendations
app.post('/api/grid/recommend', (req, res) => {
  const { solarForecast, windForecast, demand, batteryLevel } = req.body;
  
  if (!solarForecast || !windForecast || !demand || batteryLevel === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: solarForecast, windForecast, demand, batteryLevel'
    });
  }
  
  const totalRenewable = solarForecast + windForecast;
  let action = 'NOMINAL_OPERATION';
  let priority = 'normal';
  let message = 'Grid operating within normal parameters';
  
  if (totalRenewable < demand * 0.85) {
    if (batteryLevel > 0.3) {
      action = 'DISCHARGE_BATTERY';
      priority = 'medium';
      message = 'Renewable generation below demand. Discharging battery storage.';
    } else {
      action = 'ACTIVATE_BACKUP';
      priority = 'high';
      message = 'Critical: Insufficient renewable generation and low battery. Activate backup generators.';
    }
  } else if (totalRenewable > demand * 1.15) {
    if (batteryLevel < 0.9) {
      action = 'CHARGE_BATTERY';
      priority = 'low';
      message = 'Excess renewable generation. Charging battery storage.';
    } else {
      action = 'CURTAIL_GENERATION';
      priority = 'low';
      message = 'Battery full and excess generation. Consider curtailing or exporting power.';
    }
  }
  
  res.json({
    success: true,
    recommendation: {
      action,
      priority,
      message,
      metrics: {
        totalRenewable: totalRenewable.toFixed(3),
        demand: demand.toFixed(3),
        batteryLevel: batteryLevel.toFixed(3),
        deficit: Math.max(0, demand - totalRenewable).toFixed(3),
        surplus: Math.max(0, totalRenewable - demand).toFixed(3)
      }
    }
  });
});

// System logs endpoint
app.get('/api/logs', (req, res) => {
  const logs = [
    { timestamp: new Date().toISOString(), level: 'INFO', message: 'System operational' },
    { timestamp: new Date().toISOString(), level: 'SUCCESS', message: 'Beta regression model loaded' },
    { timestamp: new Date().toISOString(), level: 'INFO', message: 'Forecasting engine ready' }
  ];
  
  res.json({
    success: true,
    data: logs
  });
});

// WebSocket-like updates (SSE)
app.get('/api/stream/state', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const interval = setInterval(() => {
    generateRealtimeData();
    res.write(`data: ${JSON.stringify(currentGridState)}\n\n`);
  }, 3000);
  
  req.on('close', () => {
    clearInterval(interval);
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('========================================');
  console.log('ENERGY GRID FORECASTING API SERVER');
  console.log('========================================');
  console.log(`Status: OPERATIONAL`);
  console.log(`Port: ${PORT}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('========================================');
  console.log('Available endpoints:');
  console.log('  GET  /api/health');
  console.log('  GET  /api/grid/state');
  console.log('  POST /api/grid/state');
  console.log('  GET  /api/forecast/24h');
  console.log('  GET  /api/forecast/quantile/:metric');
  console.log('  POST /api/grid/recommend');
  console.log('  GET  /api/logs');
  console.log('  GET  /api/stream/state');
  console.log('========================================');
  
  // Initialize real-time data generation
  setInterval(generateRealtimeData, 3000);
});

module.exports = app;