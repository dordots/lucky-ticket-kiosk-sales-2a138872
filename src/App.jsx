import './App.css'
import { useEffect } from 'react'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { KioskProvider } from "@/contexts/KioskContext"

const colorThemes = {
  indigo: { 
    primary: "241 77% 63%", 
    gradientFrom: "241 77% 63%",
    gradientTo: "262 83% 58%",
    h: 241,
    s: 77,
    l: 63
  },
  green: { 
    primary: "142 76% 36%", 
    gradientFrom: "142 76% 36%",
    gradientTo: "173 58% 39%",
    h: 142,
    s: 76,
    l: 36
  },
  orange: { 
    primary: "25 95% 53%", 
    gradientFrom: "25 95% 53%",
    gradientTo: "0 84.2% 60.2%",
    h: 25,
    s: 95,
    l: 53
  },
  blue: { 
    primary: "217 91% 60%", 
    gradientFrom: "217 91% 60%",
    gradientTo: "199 89% 48%",
    h: 217,
    s: 91,
    l: 60
  },
  pink: { 
    primary: "330 81% 60%", 
    gradientFrom: "330 81% 60%",
    gradientTo: "346 77% 49.8%",
    h: 330,
    s: 81,
    l: 60
  },
  purple: { 
    primary: "262 83% 58%", 
    gradientFrom: "262 83% 58%",
    gradientTo: "241 77% 63%",
    h: 262,
    s: 83,
    l: 58
  },
};

const fontSizes = {
  small: "14px",
  medium: "16px",
  large: "18px",
};

function App() {
  useEffect(() => {
    // Load and apply saved theme preferences
    const savedTheme = localStorage.getItem("app-theme") || "indigo";
    const savedColorScheme = localStorage.getItem("app-color-scheme") || "light";
    const savedFontSize = localStorage.getItem("app-font-size") || "medium";

    // Apply color theme
    const selectedTheme = colorThemes[savedTheme] || colorThemes.indigo;
    document.documentElement.style.setProperty("--primary", selectedTheme.primary);
    document.documentElement.style.setProperty("--ring", selectedTheme.primary);
    document.documentElement.style.setProperty("--sidebar-primary", selectedTheme.primary);
    document.documentElement.style.setProperty("--sidebar-ring", selectedTheme.primary);
    document.documentElement.style.setProperty("--theme-primary-h", selectedTheme.h);
    document.documentElement.style.setProperty("--theme-primary-s", `${selectedTheme.s}%`);
    document.documentElement.style.setProperty("--theme-primary-l", `${selectedTheme.l}%`);
    document.documentElement.style.setProperty("--theme-gradient-from", selectedTheme.gradientFrom);
    document.documentElement.style.setProperty("--theme-gradient-to", selectedTheme.gradientTo);
    
    // Apply color scheme (light is default, dark needs class)
    if (savedColorScheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.remove("light");
    }

    // Apply font size
    const selectedFontSize = fontSizes[savedFontSize] || fontSizes.medium;
    document.documentElement.style.setProperty("--base-font-size", selectedFontSize);
    document.body.style.fontSize = selectedFontSize;
  }, []);

  return (
    <>
      <KioskProvider>
      <Pages />
      <Toaster />
      </KioskProvider>
    </>
  )
}

export default App 