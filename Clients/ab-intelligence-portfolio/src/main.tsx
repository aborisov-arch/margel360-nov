import { createRoot } from "react-dom/client";
import { FormspreeProvider } from "@formspree/react";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <FormspreeProvider project="xvzvdero">
    <App />
  </FormspreeProvider>
);
