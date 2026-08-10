import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { seedIfEmpty } from "@/data/seed/seedData";
import App from "@/app/App";
import "@/index.css";

seedIfEmpty();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
