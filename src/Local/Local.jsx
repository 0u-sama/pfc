import React, { useEffect, useState } from 'react';
import styles from './Local.module.css';
import alertSound from '../assets/alert.mp3';

function Local() {
  const [sensorsData, setSensorsData] = useState({});
  const [hasAlertedDisconnect, setHasAlertedDisconnect] = useState(false);
  const [newClientIds, setNewClientIds] = useState([]);
  const [modalOpen, setModalOpen] = useState(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [selectedSound, setSelectedSound] = useState('default');
  const [uploadedSounds, setUploadedSounds] = useState([]);
  const [thresholds, setThresholds] = useState({
    fireRiskTemp: 35,
    fireRiskHum: 20,
    fallingAccel: 200,
    cuttingFreqMin: 500,
    cuttingFreqMax: 1500,
  });
  const [notificationPrefs, setNotificationPrefs] = useState({
    browserNotifications: true,
    inAppToasts: true,
  });
  const [lastAlertedStatus, setLastAlertedStatus] = useState({});
  const [silencedSensors, setSilencedSensors] = useState({});
  const [currentAudio, setCurrentAudio] = useState(null);
  const [lastAlertTime, setLastAlertTime] = useState({});
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if ("Notification" in window) Notification.requestPermission();

    const savedSound = localStorage.getItem('selectedSound');
    if (savedSound) setSelectedSound(savedSound);

    const savedUploadedSounds = localStorage.getItem('uploadedSounds');
    let parsedSounds = [];
    if (savedUploadedSounds) {
      parsedSounds = JSON.parse(savedUploadedSounds);
      setUploadedSounds(parsedSounds);
    }

    if (savedSound && savedSound !== 'default' && !parsedSounds.some((s) => s.id === savedSound)) {
      setSelectedSound('default');
      localStorage.setItem('selectedSound', 'default');
    }

    const savedThresholds = localStorage.getItem('alertThresholds');
    if (savedThresholds) setThresholds(JSON.parse(savedThresholds));

    const loadNotificationPrefs = () => {
      const savedPrefs = localStorage.getItem('notificationPrefs');
      if (savedPrefs) setNotificationPrefs(JSON.parse(savedPrefs));
    };
    loadNotificationPrefs();

    window.addEventListener('storage', (event) => {
      if (event.key === 'notificationPrefs') loadNotificationPrefs();
      else if (event.key === 'alertThresholds') {
        const updatedThresholds = localStorage.getItem('alertThresholds');
        if (updatedThresholds) setThresholds(JSON.parse(updatedThresholds));
      } else if (event.key === 'uploadedSounds' || event.key === 'selectedSound') {
        const updatedSounds = localStorage.getItem('uploadedSounds');
        const updatedSelectedSound = localStorage.getItem('selectedSound');
        const parsedUpdatedSounds = updatedSounds ? JSON.parse(updatedSounds) : [];
        setUploadedSounds(parsedUpdatedSounds);

        if (updatedSelectedSound && updatedSelectedSound !== 'default' && !parsedUpdatedSounds.some((s) => s.id === updatedSelectedSound)) {
          setSelectedSound('default');
          localStorage.setItem('selectedSound', 'default');
        } else if (updatedSelectedSound) {
          setSelectedSound(updatedSelectedSound);
        }
      }
    });

    return () => window.removeEventListener('storage', loadNotificationPrefs);
  }, []);

  const handleEnableAlerts = () => {
    setHasUserInteracted(true);
  };

  const toggleSilence = (id) => {
    setSilencedSensors((prev) => {
      const newState = { ...prev, [id]: !prev[id] };

      if (!newState[id]) {
        setLastAlertedStatus((prevStatus) => {
          const newStatus = { ...prevStatus };
          delete newStatus[id];
          return newStatus;
        });
        setLastAlertTime((prevTime) => {
          const newTime = { ...prevTime };
          delete newTime[id];
          return newTime;
        });
        setToasts((prevToasts) => prevToasts.filter((toast) => !toast.message.includes(id)));
      }

      if (newState[id] && currentAudio && !currentAudio.ended) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
      }

      return newState;
    });
  };

  const addToast = (message, status, isSilenced) => {
    if (isSilenced || !notificationPrefs.inAppToasts) return;

    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, status }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  const playAlertSound = (isSilenced) => {
    if (!hasUserInteracted || isSilenced || (currentAudio && !currentAudio.ended)) return;

    let soundSrc = alertSound;
    if (selectedSound !== 'default') {
      const uploadedSound = uploadedSounds.find((s) => s.id === selectedSound);
      soundSrc = uploadedSound ? uploadedSound.data : alertSound;
    }

    const sound = new Audio(soundSrc);
    sound.volume = 1.0;
    sound.onerror = (e) => console.error('Audio file failed to load:', soundSrc, e);
    sound.onended = () => {
      setCurrentAudio(null);
    };
    sound.play()
      .then(() => setCurrentAudio(sound))
      .catch((err) => console.error('Error playing sound:', err));
  };

  const fetchData = async () => {
    try {
      // Fetch data.json from the ESP32 server
      const response = await fetch('http://192.168.43.161:3000/data.json');
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();

      setIsOffline(false);

      // Cache the data for offline use
      localStorage.setItem('cachedSensorData', JSON.stringify(data));

      Object.entries(data).forEach(([id, sensor]) => {
        if (sensor.new && !newClientIds.includes(id)) {
          const name = window.prompt(`New client detected: ${id}. Enter a name:`, id);
          if (name) {
            fetch('http://192.168.43.161:3000/set-name', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, name }),
            }).catch((err) => console.error('Error setting name:', err));
          }
          setNewClientIds((prev) => [...prev, id]);
        }
      });

      const newLastAlertedStatus = { ...lastAlertedStatus };
      const newLastAlertTime = { ...lastAlertTime };

      Object.entries(data).forEach(([id, sensor]) => {
        const previousStatus = sensorsData[id] ? getStatus(sensorsData[id]) : 'Stable';
        const currentStatus = getStatus(sensor);

        const lastStatusForSensor = lastAlertedStatus[id] || 'Stable';
        const isSilenced = silencedSensors[id] || false;

        if (currentStatus !== 'Stable' && (previousStatus !== currentStatus || currentStatus !== lastStatusForSensor)) {
          const currentTime = Date.now();
          const lastTime = lastAlertTime[id] || 0;
          const notificationCooldown = 15000;
          const timeSinceLastAlert = currentTime - lastTime;

          const message = `${sensor.name || id}: ${currentStatus.includes('Inactive') ? 'No updates - Check tree!' :
                            currentStatus.includes('Fire Risk') ? 'High fire risk - Inspect now!' :
                            currentStatus.includes('Falling') ? 'Tree falling - Immediate action!' :
                            currentStatus.includes('Cutting') ? 'Possible cutting - Investigate!' : currentStatus}`;

          if (timeSinceLastAlert >= notificationCooldown && !isSilenced) {
            if (notificationPrefs.browserNotifications && Notification.permission === 'granted') {
              new Notification(`Alert for ${sensor.name || id}`, { body: message });
            }
            setToasts((prevToasts) => prevToasts.filter((toast) => !toast.message.includes(id)));
            addToast(message, currentStatus.toLowerCase(), isSilenced);
            newLastAlertTime[id] = currentTime;
          }

          if (!isSilenced) playAlertSound(isSilenced);
          else if (currentAudio && !currentAudio.ended) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            setCurrentAudio(null);
          }

          newLastAlertedStatus[id] = currentStatus;
        }
      });

      setLastAlertedStatus(newLastAlertedStatus);
      setLastAlertTime(newLastAlertTime);
      setSensorsData(data);
    } catch (error) {
      console.error('Error fetching data.json:', error.message);
      setIsOffline(true);

      // Fallback to cached data
      const cachedData = localStorage.getItem('cachedSensorData');
      if (cachedData) {
        const offlineData = JSON.parse(cachedData);

        setSensorsData(offlineData);

        const newLastAlertTime = { ...lastAlertTime };
        Object.keys(offlineData).forEach((id) => {
          newLastAlertTime[id] = lastAlertTime[id] || 0;
        });
        const newLastAlertedStatus = { ...lastAlertedStatus };

        Object.entries(offlineData).forEach(([id, sensor]) => {
          const previousStatus = sensorsData[id] ? getStatus(sensorsData[id]) : 'Stable';
          const currentStatus = getStatus(sensor);
          const lastStatusForSensor = lastAlertedStatus[id];
          const isSilenced = silencedSensors[id] || false;

          console.log('Offline (Cached) - Previous Status:', previousStatus, 'Current Status:', currentStatus, 'Last Status:', lastStatusForSensor);

          if (currentStatus !== 'Stable' && (previousStatus !== currentStatus || !lastStatusForSensor)) {
            const currentTime = Date.now();
            const lastTime = newLastAlertTime[id] || 0;
            const notificationCooldown = 15000;
            const timeSinceLastAlert = currentTime - lastTime;

            const message = `${sensor.name || id}: ${currentStatus.includes('Inactive') ? 'No updates - Check tree!' :
                              currentStatus.includes('Fire Risk') ? 'High fire risk - Inspect now!' :
                              currentStatus.includes('Falling') ? 'Tree falling - Immediate action!' :
                              currentStatus.includes('Cutting') ? 'Possible cutting - Investigate!' : currentStatus}`;

            console.log('Attempting to trigger alert with message:', message);

            if ((timeSinceLastAlert >= notificationCooldown || lastTime === 0) && !isSilenced && hasUserInteracted) {
              if (notificationPrefs.browserNotifications && Notification.permission === 'granted') {
                new Notification(`Alert for ${sensor.name || id}`, { body: message });
              }
              setToasts((prevToasts) => prevToasts.filter((toast) => !toast.message.includes(id)));
              addToast(message, currentStatus.toLowerCase(), isSilenced);
              newLastAlertTime[id] = currentTime;
              playAlertSound(isSilenced);
              console.log('Alert triggered successfully');
            } else {
              console.log('Alert not triggered - Conditions:', { timeSinceLastAlert, notificationCooldown, isSilenced, hasUserInteracted });
            }

            newLastAlertedStatus[id] = currentStatus;
          }
        });

        setLastAlertedStatus(newLastAlertedStatus);
        setLastAlertTime(newLastAlertTime);
      } else {
        console.warn('No cached data available offline');
        setSensorsData({});
      }
    }
  };

  useEffect(() => {
    const loadData = async () => await fetchData();
    loadData();

    const interval = setInterval(async () => await fetchData(), 1000);
    return () => clearInterval(interval);
  }, [hasUserInteracted, thresholds, silencedSensors]);

  const getStatus = (data) => {
    const statuses = [];
    if (data.inactive) statuses.push('Inactive');
    if (data.accelerometer && Math.sqrt(
      Math.pow(data.accelerometer.x, 2) +
      Math.pow(data.accelerometer.y, 2) +
      Math.pow(data.accelerometer.z, 2)
    ) > thresholds.fallingAccel) statuses.push('Falling');
    if (data.vibration_frequency >= thresholds.cuttingFreqMin && data.vibration_frequency <= thresholds.cuttingFreqMax) statuses.push('Cutting');

    const temp = Number(data.temperature);
    const hum = Number(data.humidity);
    if (!isNaN(temp) && !isNaN(hum) && temp > thresholds.fireRiskTemp && hum < thresholds.fireRiskHum) {
      statuses.push('Fire Risk');
    }

    return statuses.length > 0 ? statuses.join(', ') : 'Stable';
  };

  const openMap = (latitude, longitude) => {
    const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
    window.open(url, '_blank');
  };

  const toggleModal = (id) => setModalOpen((prev) => (prev === id ? null : id));

  const editName = (id, currentName) => {
    const newName = window.prompt(`Edit name for ${id}:`, currentName);
    if (newName) {
      fetch('http://192.168.43.161:3000/set-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: newName }),
      }).catch((err) => console.error('Error editing name:', err));
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
          }
        })
        .catch((err) => console.error('Error deleting client:', err));
    }
  };

  return (
    <div className={styles.App}>
      <h1>ESP32 Sensor Dashboard</h1>
      {isOffline && (
        <p className={styles.offlineMessage}>
          Offline: Displaying last known data from cache. Some features may be limited.
        </p>
      )}
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
                    disabled={isOffline}
                  >
                    Edit
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteClient(modalOpen);
                    }}
                    disabled={isOffline}
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
                  <button
                    className={styles.silenceButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSilence(modalOpen);
                    }}
                  >
                    {silencedSensors[modalOpen] ? 'Unsilence' : 'Silence'}
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
      {!hasUserInteracted && (
        <div className={styles['enable-alerts-overlay']}>
          <div className={styles['enable-alerts-content']}>
            <p>Please click the button below to ensure alert sounds can play.</p>
            <button className={styles['enable-alerts-button']} onClick={handleEnableAlerts}>
              Enable Alerts
            </button>
          </div>
        </div>
      )}
      <div className={styles['toast-container']}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.status]}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Local;