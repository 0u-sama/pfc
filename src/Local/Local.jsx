import React, { useEffect, useState } from 'react';
import styles from './Local.module.css';
import forestImage from './assets/forest.jpg'; // Adjust if in public/

function Local() {
  const [sensorsData, setSensorsData] = useState({});
  const [hasAlertedDisconnect, setHasAlertedDisconnect] = useState(false);
  const [newClientIds, setNewClientIds] = useState([]);
  const [modalOpen, setModalOpen] = useState(null);

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
    // Set background image on body - your style
    document.body.style.backgroundImage = `url(${forestImage})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
    document.body.style.backgroundAttachment = 'fixed';

    const loadData = async () => {
      await fetchData();
    };
    loadData();

    const interval = setInterval(async () => {
      await fetchData();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getStatus = (data) => {
    const statuses = [];
    if (data.inactive) statuses.push('Inactive');
    if (data.accelerometer && Math.sqrt(
      Math.pow(data.accelerometer.x, 2) +
      Math.pow(data.accelerometer.y, 2) +
      Math.pow(data.accelerometer.z, 2)
    ) > 200) statuses.push('Falling');
    if (data.vibration_frequency >= 500 && data.vibration_frequency <= 1500) statuses.push('Cutting');

    // Check fire risk like vibration (client-side, no server state)
    const temp = Number(data.temperature);
    const hum = Number(data.humidity);
    if (!isNaN(temp) && !isNaN(hum) && temp > 35 && hum < 20) {
      statuses.push('Fire Risk');
    }

    return statuses.length > 0 ? statuses.join(', ') : 'Stable';
  };

  const openMap = (latitude, longitude) => {
    const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
    window.open(url, '_blank');
  };

  const toggleModal = (id) => {
    setModalOpen((prev) => (prev === id ? null : id));
  };

  const editName = (id, currentName) => {
    const newName = window.prompt(`Edit name for ${id}:`, currentName);
    if (newName) {
      fetch('http://192.168.43.161:3000/set-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: newName }),
      }).catch(err => console.error('Error editing name:', err));
    }
  };

  const deleteClient = (id) => {
    if (window.confirm(`Delete ${sensorsData[id].name || id}?`)) {
      fetch('http://192.168.43.161:3000/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
        .then((res) => {
          if (res.ok) {
            setSensorsData((prev) => {
              const newData = { ...prev };
              delete newData[id];
              return newData;
            });
            console.log(`Deleted ${id}`);
          } else {
            console.error('Failed to delete client');
          }
        })
        .catch(err => console.error('Error deleting client:', err));
    }
  };

  return (
    <div className={styles.App}>
      <h1>ESP32 Sensor Dashboard</h1>
      {Object.keys(sensorsData).length === 0 ? (
        <p>No ESP32 connected</p>
      ) : (
        <>
          <div className={styles.grid}>
            {Object.entries(sensorsData).map(([id, data]) => {
              const status = getStatus(data);
              return (
                <div
                  key={id}
                  className={`${styles.card} ${
                    status.includes('Falling') ? styles.falling :
                    status.includes('Cutting') ? styles.cutting :
                    status.includes('Fire Risk') ? styles.fireRisk :
                    status.includes('Inactive') ? styles.inactive : ''
                  }`}
                  onClick={() => toggleModal(id)}
                >
                  <div className={styles.cardContent}>
                    <span>{data.name || id}: {status}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {modalOpen && sensorsData[modalOpen] && (
            <div className={styles.modalOverlay} onClick={() => setModalOpen(null)}>
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <h2>{sensorsData[modalOpen].name || modalOpen}</h2>
                <p><strong>Status:</strong> {getStatus(sensorsData[modalOpen])}</p>
                <p><strong>Temperature:</strong> {sensorsData[modalOpen].temperature} °C</p>
                <p><strong>Humidity:</strong> {sensorsData[modalOpen].humidity} %</p>
                <p><strong>Last Updated:</strong> {sensorsData[modalOpen].timestamp}</p>
                {getStatus(sensorsData[modalOpen]) !== 'Stable' && (
                  <p className={styles.warning}>
                    {getStatus(sensorsData[modalOpen]).includes('Inactive') ? 'No updates - Check tree!' :
                     getStatus(sensorsData[modalOpen]).includes('Fire Risk') ? 'High fire risk - Inspect now!' :
                     getStatus(sensorsData[modalOpen]).includes('Falling') ? 'Tree falling - Immediate action!' :
                     getStatus(sensorsData[modalOpen]).includes('Cutting') ? 'Possible cutting - Investigate!' : ''}
                  </p>
                )}
                <div className={styles.buttonGroup}>
                  <button
                    className={styles.actionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      editName(modalOpen, sensorsData[modalOpen].name || modalOpen);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteClient(modalOpen);
                    }}
                  >
                    Delete
                  </button>
                  <button
                    className={styles.locationButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      openMap(sensorsData[modalOpen].gps.latitude, sensorsData[modalOpen].gps.longitude);
                    }}
                  >
                    Location
                  </button>
                </div>
                <button
                  className={styles.closeButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    setModalOpen(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Local;