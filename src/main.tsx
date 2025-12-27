import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// Set initial direction based on stored language
const storedLang = localStorage.getItem('i18nextLng') || 'ar';
document.documentElement.dir = storedLang === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = storedLang;

createRoot(document.getElementById("root")!).render(<App />);
