import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { seedIfEmpty } from "@/data/seed/seedData";
import { runLegacyChargeMigration } from "@/data/migrations/legacyChargeMigration";
import { runTenantNameMigration } from "@/data/migrations/tenantNameMigration";
import App from "@/app/App";
import "@/index.css";

seedIfEmpty();
runLegacyChargeMigration();
runTenantNameMigration();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
