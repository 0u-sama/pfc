import React, { useState } from "react";
import styles from "./Online.module.css";
import app from "../firebaseConfig";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const auth = getAuth(app);

export default function Online({ setLoggedIn }) {
  const [data, setData] = useState({});
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false); // State for password visibility

  const handleInput = (e) => {
    let newInput = { [e.target.name]: e.target.value };
    setData({ ...data, ...newInput });
    setError(null);
  };

  const toggleShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleLogIn = () => {
    if (!data.email || !data.password) {
      setError("Please enter both email and password.");
      return;
    }

    signInWithEmailAndPassword(auth, data.email, data.password)
      .then((response) => {
        setLoggedIn(true);
      })
      .catch((err) => {
        switch (err.code) {
          case "auth/invalid-credential":
            setError("Invalid credentials. Check email/password or contact the admin.");
            break;
          case "auth/user-not-found":
            setError("User doesn't exist. Please contact the admin.");
            break;
          case "auth/wrong-password":
            setError("Password wrong.");
            break;
          case "auth/invalid-email":
            setError("Invalid email format.");
            break;
          default:
            setError("An error occurred: " + err.message);
        }
      });
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <input
          name="email"
          onChange={handleInput}
          placeholder="Email"
          className={error ? styles.error : ""}
        />
        <div className={styles.passwordContainer}>
          <input
            type={showPassword ? "text" : "password"} // Toggle type based on state
            name="password"
            onChange={handleInput}
            placeholder="Password"
            className={error ? styles.error : ""}
          />
          <span
            className={styles.showPasswordIcon}
            onClick={toggleShowPassword}
          >
            {showPassword ? (
              // Eye-slash SVG (hide password)
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              // Eye SVG (show password)
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </span>
        </div>
        <button onClick={handleLogIn}>Log In</button>
        {error && <p className={styles.errorMessage}>{error}</p>}
      </div>
    </div>
  );
}