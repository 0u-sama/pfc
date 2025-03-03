import React, { useEffect, useState } from 'react';
import styles from './Local.module.css';

function Local() {
  const [sensorsData, setSensorsData] = useState({});
  const [hasAlertedDisconnect, setHasAlertedDisconnect] = useState(false);
  const [newClientIds, setNewClientIds] = useState([]);
  const [activeClients, setActiveClients] = useState({}); // Track last update time per id

  const fetchData = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      const response = await fetch('http://192.168.43.161:3000/data', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();

      // Check for new clients and prompt for name
      Object.entries(data).forEach(([id, sensor]) => {
        if (sensor.new && !newClientIds.includes(id)) {
          const name = window.prompt(`New client detected: ${id}. Enter a name:`, id);
          if (name) {
            fetch('http://192.168.43.161:3000/set-name', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, name }),
            }).catch(err => console.error('Error setting name:', err));
          }
          setNewClientIds((prev) => [...prev, id]);
        }
      });

      // Update activeClients with latest timestamp
      const now = Date.now();
      setActiveClients((prev) => {
        const updated = { ...prev };
        Object.keys(data).forEach((id) => {
          updated[id] = now; // Mark as active with current time
        });
        return updated;
      });

      setSensorsData(data);
      setHasAlertedDisconnect(false);
    } catch (error) {
      console.error('Error fetching data:', error.message);
      if (Object.keys(sensorsData).length > 0 && !hasAlertedDisconnect) {
        alert('ESP32 server disconnected!');
        setHasAlertedDisconnect(true);
        setSensorsData({});
      }
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchData();
    };
    loadData();

    const interval = setInterval(async () => {
      await fetchData();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Check if client is inactive (no update for over 5 minutes)
  const isInactive = (id) => {
    const lastUpdate = activeClients[id];
    if (!lastUpdate) return true; // Never updated = inactive
    const diffSeconds = (Date.now() - lastUpdate) / 1000;
    return diffSeconds > 300; // 5 minutes = 300s
  };

  return (
    <div className={styles.App}>
      <h1>ESP32 Sensor Dashboard</h1>
      {Object.keys(sensorsData).length === 0 ? (
        <p>No ESP32 connected</p>
      ) : (
        Object.entries(sensorsData).map(([id, data]) => (
          <div
            key={id}
            className={`${styles.dataContainer} ${isInactive(id) ? styles.inactive : ''}`}
          >
            <h2>{data.name || id}</h2>
            {isInactive(id) && (
              <p className={styles.warning}>Warning: Inactive - Possible issue (last update: {data.timestamp})</p>
            )}
            <p><strong>Temperature:</strong> {data.temperature} °C</p>
            <p><strong>Humidity:</strong> {data.humidity} %</p>
            <p><strong>Accelerometer:</strong></p>
            <ul>
              <li>X: {data.accelerometer.x}</li>
              <li>Y: {data.accelerometer.y}</li>
              <li>Z: {data.accelerometer.z}</li>
            </ul>
            <p><strong>Vibration Frequency:</strong> {data.vibration_frequency} Hz</p>
            <p><strong>GPS:</strong></p>
            <ul>
              <li>Latitude: {data.gps.latitude}</li>
              <li>Longitude: {data.gps.longitude}</li>
            </ul>
            <p><strong>Timestamp:</strong> {data.timestamp}</p>
          </div>
        ))
      )}
    </div>
  );
}

export default Local;