// src/main.jsx
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/decor-tokens.css";
import "./styles/buttons.css";
import "./styles/modal.css";
import "./styles/scrollbars.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
