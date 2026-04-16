// Sentry must be initialised before anything else
import { initSentry } from "./lib/sentry";
initSentry();

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
