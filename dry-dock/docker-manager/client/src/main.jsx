import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { ThemeProvider } from "./theme/ThemeContext.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { EnvProvider } from "./env/EnvContext.jsx";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <EnvProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </EnvProvider>
    </AuthProvider>
  </React.StrictMode>
);
