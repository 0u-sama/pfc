import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Local from "./Local/Local.jsx"; // Adjust path if needed
import Settings from './Settings/Settings.jsx'; // We’ll create this next
import styles from './App.module.css'; // We’ll create this for shared styles

function App() {
  return (
    <Router>
      <div className={styles.appWrapper}>
        {/* Navigation Links */}
        <nav className={styles.nav}>
          <Link to="/" className={styles.navLink}>Dashboard</Link>
          <Link to="/settings" className={styles.navLink}>Settings</Link>
        </nav>
        {/* Routes */}
        <Routes>
          <Route path="/" element={<Local />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;