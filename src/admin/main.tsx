import React from "react";
import ReactDOM from "react-dom/client";
import { AdminApp } from "./AdminApp";
import { AppErrorBoundary } from "../ui/components/AppErrorBoundary";
import "../styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AdminApp />
    </AppErrorBoundary>
  </React.StrictMode>
);
