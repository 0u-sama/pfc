import React, { useState, useEffect } from 'react';
import styles from './Settings.module.css';
import alertSound from '../assets/alert.mp3';

function Settings({ onBack }) {
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
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null);

  useEffect(() => {
    const savedSound = localStorage.getItem('selectedSound');
    if (savedSound) setSelectedSound(savedSound);

    const savedUploadedSounds = localStorage.getItem('uploadedSounds');
    if (savedUploadedSounds) setUploadedSounds(JSON.parse(savedUploadedSounds));

    const savedThresholds = localStorage.getItem('alertThresholds');
    if (savedThresholds) setThresholds(JSON.parse(savedThresholds));

    const savedPrefs = localStorage.getItem('notificationPrefs');
    if (savedPrefs) setNotificationPrefs(JSON.parse(savedPrefs));
  }, []);

  const handleSoundChange = (e) => {
    const value = e.target.value;
    setSelectedSound(value);
    localStorage.setItem('selectedSound', value);
    window.dispatchEvent(new Event('storage'));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const soundData = event.target.result;
        const newSound = {
          id: Date.now().toString(),
          name: file.name,
          data: soundData,
        };
        setUploadedSounds((prev) => {
          const updatedSounds = [...prev, newSound];
          localStorage.setItem('uploadedSounds', JSON.stringify(updatedSounds));
          return updatedSounds;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveSound = (id) => {
    setUploadedSounds((prev) => {
      const updatedSounds = prev.filter((sound) => sound.id !== id);
      localStorage.setItem('uploadedSounds', JSON.stringify(updatedSounds));

      // If the removed sound was selected, switch to default
      if (selectedSound === id) {
        setSelectedSound('default');
        localStorage.setItem('selectedSound', 'default');
        alert(`Removed sound was the active selection. Switched to default sound.`);
      }

      window.dispatchEvent(new Event('storage'));
      return updatedSounds;
    });
  };

  const handleThresholdChange = (e) => {
    const { name, value } = e.target;
    setThresholds((prev) => {
      const updatedThresholds = { ...prev, [name]: Number(value) };
      localStorage.setItem('alertThresholds', JSON.stringify(updatedThresholds));
      window.dispatchEvent(new Event('storage'));
      return updatedThresholds;
    });
  };

  const handleNotificationPrefChange = (e) => {
    const { name, checked } = e.target;
    setNotificationPrefs((prev) => {
      const updatedPrefs = { ...prev, [name]: checked };
      localStorage.setItem('notificationPrefs', JSON.stringify(updatedPrefs));
      window.dispatchEvent(new Event('storage'));
      return updatedPrefs;
    });
  };

  const handleEnableAlerts = () => setHasUserInteracted(true);

  const playPreviewSound = () => {
    if (!hasUserInteracted) return;

    if (currentAudio && !currentAudio.ended) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      return;
    }

    let soundSrc = alertSound;
    if (selectedSound !== 'default') {
      const uploadedSound = uploadedSounds.find((s) => s.id === selectedSound);
      if (uploadedSound) soundSrc = uploadedSound.data;
    }

    const sound = new Audio(soundSrc);
    sound.volume = 1.0;
    sound.onerror = () => console.error('Audio file failed to load:', soundSrc);
    sound.onended = () => setCurrentAudio(null);
    sound.play()
      .then(() => setCurrentAudio(sound))
      .catch((err) => console.error('Error playing sound:', err));
  };

  return (
    <div className={styles.settings}>
      <h1>Settings</h1>

      <div className={styles.section}>
        <h2>Alert Sound</h2>
        <select value={selectedSound} onChange={handleSoundChange}>
          <option value="default">Default Sound</option>
          {uploadedSounds.map((sound) => (
            <option key={sound.id} value={sound.id}>
              {sound.name}
            </option>
          ))}
        </select>
        <button onClick={playPreviewSound} disabled={!hasUserInteracted}>
          {currentAudio && !currentAudio.ended ? 'Stop Preview' : 'Preview Sound'}
        </button>
        <div className={styles.upload}>
          <label htmlFor="sound-upload">Upload Custom Sound:</label>
          <input
            type="file"
            id="sound-upload"
            accept="audio/*"
            onChange={handleFileUpload}
          />
        </div>
        {uploadedSounds.length > 0 && (
          <div className={styles.uploadedSounds}>
            <h3>Uploaded Sounds</h3>
            <ul>
              {uploadedSounds.map((sound) => (
                <li key={sound.id}>
                  {sound.name}
                  <button
                    className={styles.removeButton}
                    onClick={() => handleRemoveSound(sound.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2>Alert Thresholds</h2>
        <div className={styles.threshold}>
          <label>Fire Risk Temperature (°C):</label>
          <input
            type="number"
            name="fireRiskTemp"
            value={thresholds.fireRiskTemp}
            onChange={handleThresholdChange}
          />
        </div>
        <div className={styles.threshold}>
          <label>Fire Risk Humidity (%):</label>
          <input
            type="number"
            name="fireRiskHum"
            value={thresholds.fireRiskHum}
            onChange={handleThresholdChange}
          />
        </div>
        <div className={styles.threshold}>
          <label>Falling Acceleration (m/s²):</label>
          <input
            type="number"
            name="fallingAccel"
            value={thresholds.fallingAccel}
            onChange={handleThresholdChange}
          />
        </div>
        <div className={styles.threshold}>
          <label>Cutting Frequency Min (Hz):</label>
          <input
            type="number"
            name="cuttingFreqMin"
            value={thresholds.cuttingFreqMin}
            onChange={handleThresholdChange}
          />
        </div>
        <div className={styles.threshold}>
          <label>Cutting Frequency Max (Hz):</label>
          <input
            type="number"
            name="cuttingFreqMax"
            value={thresholds.cuttingFreqMax}
            onChange={handleThresholdChange}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h2>Notification Preferences</h2>
        <div className={styles.checkbox}>
          <label>
            <input
              type="checkbox"
              name="browserNotifications"
              checked={notificationPrefs.browserNotifications}
              onChange={handleNotificationPrefChange}
            />
            Browser Notifications
          </label>
        </div>
        <div className={styles.checkbox}>
          <label>
            <input
              type="checkbox"
              name="inAppToasts"
              checked={notificationPrefs.inAppToasts}
              onChange={handleNotificationPrefChange}
            />
            In-App Toasts
          </label>
        </div>
      </div>

      {!hasUserInteracted && (
        <div className={styles['enable-alerts-overlay']}>
          <div className={styles['enable-alerts-content']}>
            <p>Please click the button below to enable alert sounds.</p>
            <button className={styles['enable-alerts-button']} onClick={handleEnableAlerts}>
              Enable Alerts
            </button>
          </div>
        </div>
      )}

      <button className={styles.backButton} onClick={onBack}>
        Back to Dashboard
      </button>
    </div>
  );
}

export default Settings;