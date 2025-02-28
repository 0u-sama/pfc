import React, { useEffect, useState } from 'react';
import styles from './V1.module.css';


function V1() {
  const [sensorsData, setSensorsData] = useState({
    temperature: 'Loading...',
    humidity: 'Loading...',
    accelerometer: { x: 'Loading...', y: 'Loading...', z: 'Loading...' },
    vibration_frequency: 'Loading...',
    gps: { latitude: 'Loading...', longitude: 'Loading...' },
    timestamp: 'Loading...',
  });

  const fetchData = async () => {
    try {
      const response = await fetch('http://192.168.43.135/data');
      console.log(response);
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
    // Call fetchData and handle its Promise
    const loadData = async () => {
      await fetchData(); // Initial fetch
    };
    loadData();

    // Set up interval to fetch data every 2 seconds
    const interval = setInterval(async () => {
      await fetchData();
    }, 2000);

    // Cleanup interval when component unmounts
    return () => clearInterval(interval);
  }, []); // Empty dependency array for mount-only execution

  return (
    <div className={styles.App}>
      <h1>DATA</h1>
      <div className={styles.dataContainer}>
        <p><strong>Temperature:</strong> {sensorsData.temperature} °C</p>
        <p><strong>Humidity:</strong> {sensorsData.humidity} %</p>
        <p><strong>Accelerometer:</strong></p>
        <ul>
          <li>X: {sensorsData.accelerometer.x}</li>
          <li>Y: {sensorsData.accelerometer.y}</li>
          <li>Z: {sensorsData.accelerometer.z}</li>
        </ul>
        <p><strong>Vibration Frequency:</strong> {sensorsData.vibration_frequency} Hz</p>
        <p><strong>GPS:</strong></p>
        <ul>
          <li>Latitude: {sensorsData.gps.latitude}</li>
          <li>Longitude: {sensorsData.gps.longitude}</li>
        </ul>
        <p><strong>Timestamp:</strong> {sensorsData.timestamp}</p>
      </div>
    </div>
  );
}

export default V1;