import React, { useEffect, useState } from 'react';
import styles from './V2.module.css';

function V2() {
  const [sensorsData, setSensorsData] = useState({});

  const fetchData = async () => {
    try {
      const response = await fetch('http://192.168.43.235/data'); // Update with ESP32 #3's IP
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      setSensorsData(data);
    } catch (error) {
      console.error('Error fetching data:', error.message);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await fetchData();
    };
    loadData();

    const interval = setInterval(async () => {
      await fetchData();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.App}>
      <h1>ESP32 Sensor Dashboard</h1>
      {Object.keys(sensorsData).length === 0 ? (
        <p>No ESP32 devices connected yet...</p>
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

export default V2;