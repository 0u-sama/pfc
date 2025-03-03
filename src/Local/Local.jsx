import React, { useEffect, useState } from 'react';
import styles from './Local.module.css';

function Local() {
  const [sensorsData, setSensorsData] = useState({});
  const [hasAlertedDisconnect, setHasAlertedDisconnect] = useState(false);
  const [newClientIds, setNewClientIds] = useState([]);
  const [expandedCards, setExpandedCards] = useState({});
  const [menuOpen, setMenuOpen] = useState(null);

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
    // Set background image on body
    document.body.style.backgroundImage = "url('/src/assets/forest.jpg')";
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

    return () => {
      clearInterval(interval);
      // Optional: Clean up body style on unmount - comment out if you want it persistent
      // document.body.style.backgroundImage = '';
    };
  }, []);

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

  const openMap = (latitude, longitude) => {
    const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
    window.open(url, '_blank');
  };

  const toggleCard = (id) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
    setMenuOpen(null);
  };

  const toggleMenu = (id) => {
    setMenuOpen((prev) => (prev === id ? null : id));
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
    setMenuOpen(null);
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
    setMenuOpen(null);
  };

  return (
    <div className={styles.App}>
      <h1>ESP32 Sensor Dashboard</h1>
      {Object.keys(sensorsData).length === 0 ? (
        <p>No ESP32 connected</p>
      ) : (
        Object.entries(sensorsData).map(([id, data]) => {
          const status = getStatus(data);
          const isExpanded = expandedCards[id] || false;
          return (
            <div
              key={id}
              className={`${styles.dataContainer} ${
                isExpanded ? styles.expanded : styles.collapsed
              } ${
                status.includes('Falling') ? styles.falling :
                status.includes('Cutting') ? styles.cutting :
                status.includes('Fire Risk') ? styles.fireRisk :
                status.includes('Inactive') ? styles.inactive : ''
              }`}
              onClick={() => toggleCard(id)}
            >
              {isExpanded ? (
                <>
                  <h2>{data.name || id}</h2>
                  <p><strong>Status:</strong> {status}</p>
                  <p><strong>Temperature:</strong> {data.temperature} °C</p>
                  <p><strong>Humidity:</strong> {data.humidity} %</p>
                  <p><strong>Last Updated:</strong> {data.timestamp}</p>
                  {status !== 'Stable' && (
                    <p className={styles.warning}>
                      {status.includes('Inactive') ? 'No updates - Check tree!' :
                       status.includes('Fire Risk') ? 'High fire risk - Inspect now!' :
                       status.includes('Falling') ? 'Tree falling - Immediate action!' :
                       status.includes('Cutting') ? 'Possible cutting - Investigate!' : ''}
                    </p>
                  )}
                  <div className={styles.buttonGroup}>
                    <button
                      className={styles.actionButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        editName(id, data.name || id);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className={styles.actionButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteClient(id);
                      }}
                    >
                      Delete
                    </button>
                    <button
                      className={styles.locationButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        openMap(data.gps.latitude, data.gps.longitude);
                      }}
                    >
                      Location
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.collapsedContent}>
                  <span>{data.name || id}: {status}</span>
                  <div className={styles.menuWrapper}>
                    <button
                      className={styles.menuButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMenu(id);
                      }}
                    >
                      ⋮
                    </button>
                    {menuOpen === id && (
                      <div className={styles.dropdownMenu}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            editName(id, data.name || id);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteClient(id);
                          }}
                        >
                          Delete
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openMap(data.gps.latitude, data.gps.longitude);
                          }}
                        >
                          Location
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default Local;