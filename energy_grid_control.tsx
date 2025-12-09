import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Power, Wind, Sun, Battery, AlertTriangle, Activity, Database, Settings, Play, Pause, RefreshCw } from 'lucide-react';

const EnergyGridControl = () => {
  const [systemStatus, setSystemStatus] = useState('OPERATIONAL');
  const [solarCapacity, setSolarCapacity] = useState(0.67);
  const [windCapacity, setWindCapacity] = useState(0.54);
  const [batteryLevel, setBatteryLevel] = useState(0.82);
  const [gridLoad, setGridLoad] = useState(0.71);
  const [backupActive, setBackupActive] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [forecastData, setForecastData] = useState([]);
  const [quantileData, setQuantileData] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('solar');

  const addLog = (message, level = 'INFO') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev.slice(-8), { time: timestamp, message, level }]);
  };

  useEffect(() => {
    const generateForecast = () => {
      const data = [];
      const now = new Date();
      for (let i = 0; i < 24; i++) {
        const hour = (now.getHours() + i) % 24;
        const solarBase = Math.max(0, Math.sin((hour - 6) * Math.PI / 12) * 0.8);
        const windBase = 0.4 + Math.sin(hour * Math.PI / 6) * 0.3;
        data.push({
          hour: `${hour}:00`,
          solar: Math.max(0, Math.min(1, solarBase + (Math.random() - 0.5) * 0.1)),
          wind: Math.max(0, Math.min(1, windBase + (Math.random() - 0.5) * 0.15)),
          demand: 0.5 + Math.sin((hour - 12) * Math.PI / 12) * 0.3 + (Math.random() - 0.5) * 0.1
        });
      }
      setForecastData(data);
    };

    const generateQuantiles = () => {
      const data = [];
      for (let i = 0; i < 24; i++) {
        const base = 0.5 + Math.sin(i * Math.PI / 6) * 0.2;
        data.push({
          hour: `${i}:00`,
          p10: Math.max(0, base - 0.15),
          p50: base,
          p90: Math.min(1, base + 0.15)
        });
      }
      setQuantileData(data);
    };

    generateForecast();
    generateQuantiles();
    addLog('System initialized', 'SUCCESS');
    addLog('Beta regression model loaded', 'INFO');
    addLog('Quantile forecasts generated', 'INFO');

    const interval = setInterval(() => {
      const hour = new Date().getHours();
      const solarVar = Math.max(0, Math.min(1, Math.sin((hour - 6) * Math.PI / 12) * 0.8 + (Math.random() - 0.5) * 0.1));
      const windVar = Math.max(0, Math.min(1, 0.4 + Math.sin(hour * Math.PI / 6) * 0.3 + (Math.random() - 0.5) * 0.15));
      
      setSolarCapacity(solarVar);
      setWindCapacity(windVar);
      setGridLoad(0.5 + Math.sin((hour - 12) * Math.PI / 12) * 0.3 + (Math.random() - 0.5) * 0.05);
      
      const totalGen = solarVar + windVar;
      const newBattery = Math.max(0, Math.min(1, batteryLevel + (totalGen - gridLoad) * 0.05));
      setBatteryLevel(newBattery);

      if (autoMode && totalGen < gridLoad * 0.9 && newBattery < 0.3) {
        setBackupActive(true);
        addLog('Backup generators activated', 'WARNING');
      } else if (autoMode && totalGen > gridLoad * 1.1 && newBattery > 0.8) {
        setBackupActive(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [autoMode, batteryLevel, gridLoad]);

  const MetricPanel = ({ title, value, icon: Icon, unit, status }) => (
    <div className="bg-gray-800 border border-gray-600 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-gray-400" />
          <span className="text-xs text-gray-400 tracking-wider">{title}</span>
        </div>
        <div className={`w-2 h-2 rounded-full ${status === 'normal' ? 'bg-green-500' : status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`} />
      </div>
      <div className="text-3xl font-mono text-gray-200">{(value * 100).toFixed(1)}<span className="text-lg text-gray-500">{unit}</span></div>
      <div className="mt-2 bg-gray-700 h-2">
        <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-6 font-mono">
      {/* Header */}
      <div className="border-b border-gray-700 pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wider text-gray-100">RENEWABLE ENERGY MANAGEMENT SYSTEM</h1>
            <p className="text-sm text-gray-500 mt-1">GRID CONTROL INTERFACE v4.2.1</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500">SYSTEM STATUS</div>
              <div className={`text-sm font-bold ${systemStatus === 'OPERATIONAL' ? 'text-green-500' : 'text-red-500'}`}>{systemStatus}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">TIMESTAMP</div>
              <div className="text-sm">{new Date().toLocaleTimeString('en-US', { hour12: false })}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricPanel 
          title="SOLAR CAPACITY" 
          value={solarCapacity} 
          icon={Sun} 
          unit="%" 
          status={solarCapacity > 0.6 ? 'normal' : solarCapacity > 0.3 ? 'warning' : 'critical'}
        />
        <MetricPanel 
          title="WIND CAPACITY" 
          value={windCapacity} 
          icon={Wind} 
          unit="%" 
          status={windCapacity > 0.5 ? 'normal' : windCapacity > 0.25 ? 'warning' : 'critical'}
        />
        <MetricPanel 
          title="BATTERY STORAGE" 
          value={batteryLevel} 
          icon={Battery} 
          unit="%" 
          status={batteryLevel > 0.5 ? 'normal' : batteryLevel > 0.2 ? 'warning' : 'critical'}
        />
        <MetricPanel 
          title="GRID LOAD" 
          value={gridLoad} 
          icon={Activity} 
          unit="%" 
          status={gridLoad < 0.8 ? 'normal' : gridLoad < 0.9 ? 'warning' : 'critical'}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-600 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm tracking-wider text-gray-400">24-HOUR CAPACITY FORECAST</h3>
            <select 
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-xs px-2 py-1 text-gray-300"
            >
              <option value="solar">SOLAR</option>
              <option value="wind">WIND</option>
              <option value="demand">DEMAND</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hour" stroke="#9CA3AF" style={{ fontSize: '10px' }} />
              <YAxis stroke="#9CA3AF" style={{ fontSize: '10px' }} domain={[0, 1]} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563' }} />
              <Line type="monotone" dataKey={selectedMetric} stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-800 border border-gray-600 p-4">
          <h3 className="text-sm tracking-wider text-gray-400 mb-4">PROBABILISTIC FORECAST (P10/P50/P90)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={quantileData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="hour" stroke="#9CA3AF" style={{ fontSize: '10px' }} />
              <YAxis stroke="#9CA3AF" style={{ fontSize: '10px' }} domain={[0, 1]} />
              <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #4B5563' }} />
              <Area type="monotone" dataKey="p90" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.2} />
              <Area type="monotone" dataKey="p50" stackId="2" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.4} />
              <Area type="monotone" dataKey="p10" stackId="3" stroke="#EF4444" fill="#EF4444" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-600 p-4">
          <h3 className="text-sm tracking-wider text-gray-400 mb-4">CONTROL OPERATIONS</h3>
          <div className="space-y-2">
            <button 
              onClick={() => {
                setAutoMode(!autoMode);
                addLog(`Auto mode ${!autoMode ? 'enabled' : 'disabled'}`, 'INFO');
              }}
              className={`w-full px-4 py-2 border ${autoMode ? 'bg-blue-900 border-blue-500 text-blue-200' : 'bg-gray-700 border-gray-600 text-gray-300'} text-sm flex items-center justify-center gap-2`}
            >
              {autoMode ? <Pause size={16} /> : <Play size={16} />}
              AUTO MODE: {autoMode ? 'ENABLED' : 'DISABLED'}
            </button>
            <button 
              onClick={() => {
                setBackupActive(!backupActive);
                addLog(`Backup generators ${!backupActive ? 'activated' : 'deactivated'}`, 'WARNING');
              }}
              className={`w-full px-4 py-2 border ${backupActive ? 'bg-yellow-900 border-yellow-500 text-yellow-200' : 'bg-gray-700 border-gray-600 text-gray-300'} text-sm flex items-center justify-center gap-2`}
            >
              <Power size={16} />
              BACKUP: {backupActive ? 'ACTIVE' : 'STANDBY'}
            </button>
            <button 
              onClick={() => {
                addLog('Running beta regression forecast...', 'INFO');
                setTimeout(() => addLog('Forecast complete', 'SUCCESS'), 1000);
              }}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-gray-300 text-sm flex items-center justify-center gap-2 hover:bg-gray-600"
            >
              <RefreshCw size={16} />
              RUN FORECAST
            </button>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-600 p-4">
          <h3 className="text-sm tracking-wider text-gray-400 mb-4">SYSTEM PARAMETERS</h3>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">MODEL TYPE:</span>
              <span className="text-gray-300">BETA REGRESSION</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">SEASONALITY:</span>
              <span className="text-gray-300">FOURIER ORDER 6</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">QUANTILES:</span>
              <span className="text-gray-300">P10, P50, P90</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">FORECAST HORIZON:</span>
              <span className="text-gray-300">24 HOURS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">UPDATE INTERVAL:</span>
              <span className="text-gray-300">3 SECONDS</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-600 p-4">
          <h3 className="text-sm tracking-wider text-gray-400 mb-4">SYSTEM ALERTS</h3>
          <div className="space-y-2">
            {batteryLevel < 0.3 && (
              <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-900 bg-opacity-20 p-2 border border-yellow-700">
                <AlertTriangle size={14} />
                LOW BATTERY WARNING
              </div>
            )}
            {(solarCapacity + windCapacity) < gridLoad * 0.8 && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900 bg-opacity-20 p-2 border border-red-700">
                <AlertTriangle size={14} />
                INSUFFICIENT GENERATION
              </div>
            )}
            {backupActive && (
              <div className="flex items-center gap-2 text-xs text-orange-400 bg-orange-900 bg-opacity-20 p-2 border border-orange-700">
                <Power size={14} />
                BACKUP GENERATOR ONLINE
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Logs */}
      <div className="bg-gray-800 border border-gray-600 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database size={16} className="text-gray-400" />
          <h3 className="text-sm tracking-wider text-gray-400">SYSTEM LOGS</h3>
        </div>
        <div className="bg-black bg-opacity-50 p-3 font-mono text-xs space-y-1 h-32 overflow-y-auto">
          {logs.map((log, idx) => (
            <div key={idx} className="flex gap-3">
              <span className="text-gray-600">[{log.time}]</span>
              <span className={`${log.level === 'SUCCESS' ? 'text-green-400' : log.level === 'WARNING' ? 'text-yellow-400' : log.level === 'ERROR' ? 'text-red-400' : 'text-gray-400'}`}>
                {log.level}:
              </span>
              <span className="text-gray-300">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EnergyGridControl;