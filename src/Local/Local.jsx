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

  // Determine client status
  const getStatus = (data) => {
    const statuses = [];
    if (data.inactive) statuses.push('Inactive');
    if (data.fireRisk) statuses.push('Fire Risk');
    if (data.accelerometer && Math.sqrt(
      Math.pow(data.accelerometer.x, 2) +
      Math.pow(data.accelerometer.y, 2) +
      Math.pow(data.accelerometer.z, 2)
    ) > 200) statuses.push('Falling');
    if (data.vibration_frequency >= 500 && data.vibration_frequency <= 1500) statuses.push('Cutting');
    return statuses.length > 0 ? statuses.join(', ') : 'Stable';
  };

  // Open Google Maps with GPS coordinates
  const openMap = (latitude, longitude) => {
    const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
    window.open(url, '_blank');
  };

  return (
    <div className={styles.App}>
      <h1>ESP32 Sensor Dashboard</h1>
      {Object.keys(sensorsData).length === 0 ? (
        <p>No ESP32 connected</p>
      ) : (
        Object.entries(sensorsData).map(([id, data]) => {
          const status = getStatus(data);
          return (
            <div
              key={id}
              className={`${styles.dataContainer} ${
                status.includes('Falling') ? styles.falling :
                status.includes('Cutting') ? styles.cutting :
                status.includes('Fire Risk') ? styles.fireRisk :
                status.includes('Inactive') ? styles.inactive : ''
              }`}
            >
              <h2>{data.name || id}</h2>
              <p><strong>Status:</strong> {status}</p>
              <p><strong>Temperature:</strong> {data.temperature} °C</p>
              <p><strong>Humidity:</strong> {data.humidity} %</p>
              <p><strong>Last Updated:</strong> {data.timestamp}</p> {/* Added timestamp */}
              {status !== 'Stable' && (
                <p className={styles.warning}>
                  {status.includes('Inactive') ? 'No updates - Check tree!' :
                   status.includes('Fire Risk') ? 'High fire risk - Inspect now!' :
                   status.includes('Falling') ? 'Tree falling - Immediate action!' :
                   status.includes('Cutting') ? 'Possible cutting - Investigate!' : ''}
                </p>
              )}
              <button
                className={styles.locationButton}
                onClick={() => openMap(data.gps.latitude, data.gps.longitude)}
              >
                Location
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

export default Local;