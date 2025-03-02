import React, { useEffect, useState } from 'react';
import styles from './Local.module.css';

function Local() {
  const [sensorsData, setSensorsData] = useState({});
  const [hasAlertedDisconnect, setHasAlertedDisconnect] = useState(false);
  const [newClientIds, setNewClientIds] = useState([]);

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

      Object.entries(data).forEach(([id, sensor]) => {
        if (sensor.new && !newClientIds.includes(id)) {
          alert(`New client connected: ${id}`);
          setNewClientIds((prev) => [...prev, id]);
        }
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

  return (
    <div className={styles.App}>
      <h1>ESP32 Sensor Dashboard</h1>
      {Object.keys(sensorsData).length === 0 ? (
        <p>No ESP32 connected</p>
      ) : (
        Object.entries(sensorsData).map(([id, data]) => (
          <div key={id} className={styles.dataContainer}>
            <h2>{id}</h2>
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