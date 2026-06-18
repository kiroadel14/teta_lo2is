import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

import app from "./firebase";

console.log("Firebase Connected:", app);

createRoot(document.getElementById("root")!).render(<App />);