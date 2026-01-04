import React, { useState, useEffect } from "react";
import { Palette, Moon, Sun, Type, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import * as usersService from "@/firebase/services/users";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const colorThemes = [
  { 
    name: "כחול-סגול", 
    value: "indigo", 
    primary: "241 77% 63%", 
    gradientFrom: "241 77% 63%",
    gradientTo: "262 83% 58%",
    h: 241,
    s: 77,
    l: 63
  },
  { 
    name: "ירוק", 
    value: "green", 
    primary: "142 76% 36%", 
    gradientFrom: "142 76% 36%",
    gradientTo: "173 58% 39%",
    h: 142,
    s: 76,
    l: 36
  },
  { 
    name: "כתום", 
    value: "orange", 
    primary: "25 95% 53%", 
    gradientFrom: "25 95% 53%",
    gradientTo: "0 84.2% 60.2%",
    h: 25,
    s: 95,
    l: 53
  },
  { 
    name: "כחול", 
    value: "blue", 
    primary: "217 91% 60%", 
    gradientFrom: "217 91% 60%",
    gradientTo: "199 89% 48%",
    h: 217,
    s: 91,
    l: 60
  },
  { 
    name: "ורוד", 
    value: "pink", 
    primary: "330 81% 60%", 
    gradientFrom: "330 81% 60%",
    gradientTo: "346 77% 49.8%",
    h: 330,
    s: 81,
    l: 60
  },
  { 
    name: "סגול", 
    value: "purple", 
    primary: "262 83% 58%", 
    gradientFrom: "262 83% 58%",
    gradientTo: "241 77% 63%",
    h: 262,
    s: 83,
    l: 58
  },
];

const fontSizes = [
  { name: "קטן", value: "small", size: "14px" },
  { name: "בינוני", value: "medium", size: "16px" },
  { name: "גדול", value: "large", size: "18px" },
];

export default function Settings() {
  const [theme, setTheme] = useState("indigo");
  const [colorScheme, setColorScheme] = useState("light");
  const [fontSize, setFontSize] = useState("medium");
  const [user, setUser] = useState(null);
  const [commissionRate, setCommissionRate] = useState("");
  const [isSavingCommission, setIsSavingCommission] = useState(false);
  const queryClient = useQueryClient();
  const hasPermission = (perm) => {
    if (!user) return false;
    if (user.role !== 'assistant') return true;
    if (!perm) return true;
    return Array.isArray(user.permissions) ? user.permissions.includes(perm) : false;
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { auth } = await import("@/api/entities");
        const userData = await auth.me();
        setUser(userData);
        if (userData?.commission_rate) {
          setCommissionRate(userData.commission_rate.toString());
        }
      } catch (e) {
        console.log("User not logged in");
      }
    };
    loadUser();

    // Load saved preferences
    const savedTheme = localStorage.getItem("app-theme") || "indigo";
    const savedColorScheme = localStorage.getItem("app-color-scheme") || "light";
    const savedFontSize = localStorage.getItem("app-font-size") || "medium";

    setTheme(savedTheme);
    setColorScheme(savedColorScheme);
    setFontSize(savedFontSize);

    // Apply theme
    applyTheme(savedTheme, savedColorScheme, savedFontSize);
  }, []);

  // Assistants allowed by default; no granular permission check needed

  const applyTheme = (newTheme, newColorScheme, newFontSize) => {
    // Apply color theme
    const selectedTheme = colorThemes.find(t => t.value === newTheme) || colorThemes[0];
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
    if (newColorScheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.remove("light");
    }

    // Apply font size
    const selectedFontSize = fontSizes.find(f => f.value === newFontSize) || fontSizes[1];
    document.documentElement.style.setProperty("--base-font-size", selectedFontSize.size);
    document.body.style.fontSize = selectedFontSize.size;
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("app-theme", newTheme);
    applyTheme(newTheme, colorScheme, fontSize);
  };

  const handleColorSchemeChange = (newColorScheme) => {
    setColorScheme(newColorScheme);
    localStorage.setItem("app-color-scheme", newColorScheme);
    applyTheme(theme, newColorScheme, fontSize);
  };

  const handleFontSizeChange = (newFontSize) => {
    setFontSize(newFontSize);
    localStorage.setItem("app-font-size", newFontSize);
    applyTheme(theme, colorScheme, newFontSize);
  };

  const resetSettings = () => {
    const defaultTheme = "indigo";
    const defaultColorScheme = "light";
    const defaultFontSize = "medium";

    setTheme(defaultTheme);
    setColorScheme(defaultColorScheme);
    setFontSize(defaultFontSize);

    localStorage.setItem("app-theme", defaultTheme);
    localStorage.setItem("app-color-scheme", defaultColorScheme);
    localStorage.setItem("app-font-size", defaultFontSize);

    applyTheme(defaultTheme, defaultColorScheme, defaultFontSize);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">הגדרות</h1>
        <p className="text-muted-foreground">התאם את העיצוב והתצוגה לפי העדפותיך</p>
      </div>

      {/* Color Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            צבע ראשי
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {colorThemes.map((colorTheme) => (
              <button
                key={colorTheme.value}
                onClick={() => handleThemeChange(colorTheme.value)}
                className={`
                  relative p-4 rounded-xl border-2 transition-all
                  ${theme === colorTheme.value 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50'
                  }
                `}
              >
                <div 
                  className="h-12 rounded-lg mb-2"
                  style={{
                    background: `linear-gradient(to right, hsl(${colorTheme.gradientFrom}), hsl(${colorTheme.gradientTo}))`
                  }}
                />
                <p className="text-sm font-medium text-foreground">{colorTheme.name}</p>
                {theme === colorTheme.value && (
                  <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">נבחר</Badge>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Color Scheme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {colorScheme === "dark" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
            תמה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleColorSchemeChange("light")}
                className={`
                  p-6 rounded-xl border-2 transition-all text-right
                  ${colorScheme === "light"
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/10'
                    : 'border-border hover:border-primary/50 bg-card'
                  }
                `}
              >
                <Sun className="h-8 w-8 mb-2 text-yellow-500" />
                <p className="font-medium text-foreground">בהיר</p>
                <p className="text-sm text-muted-foreground">תמה בהירה</p>
              </button>
              <button
                onClick={() => handleColorSchemeChange("dark")}
                className={`
                  p-6 rounded-xl border-2 transition-all text-right
                  ${colorScheme === "dark"
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/20'
                    : 'border-border hover:border-primary/50 bg-slate-800'
                  }
                `}
              >
                <Moon className="h-8 w-8 mb-2 text-blue-400" />
                <p className="font-medium text-foreground">כהה</p>
                <p className="text-sm text-muted-foreground">תמה כהה</p>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Font Size */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            גודל גופן
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>גודל טקסט</Label>
            <Select value={fontSize} onValueChange={handleFontSizeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontSizes.map((fs) => (
                  <SelectItem key={fs.value} value={fs.value}>
                    {fs.name} ({fs.size})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              גודל הטקסט הבסיסי בכל האפליקציה
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Commission Rate (only for franchisees) */}
      {user?.role === 'franchisee' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              עמלה
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="commission">גובה עמלה (אחוזים)</Label>
                <Input
                  id="commission"
                  type="number"
                  value={commissionRate}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || (parseFloat(val) >= 0 && parseFloat(val) <= 100)) {
                      setCommissionRate(val);
                    }
                  }}
                  placeholder="לדוגמה: 15"
                  min="0"
                  max="100"
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  אם העמלה שלך היא 15%, תקבל 15% מכל מכירה. העמלה תשמש לחישוב הרווחים האישיים שלך בדוחות.
                </p>
                {user?.commission_rate && (
                  <p className="text-sm text-muted-foreground">
                    עמלה נוכחית: <strong>{user.commission_rate}%</strong>
                  </p>
                )}
              </div>
              <Button
                onClick={async () => {
                  if (!user?.id) {
                    alert('לא ניתן לשמור ללא משתמש');
                    return;
                  }
                  
                  setIsSavingCommission(true);
                  try {
                    const updateData = {};
                    if (commissionRate && commissionRate.trim() !== "") {
                      const rate = parseFloat(commissionRate);
                      if (rate >= 0 && rate <= 100) {
                        updateData.commission_rate = rate;
                        updateData.commission_set = true;
                      } else {
                        alert('העמלה חייבת להיות בין 0 ל-100');
                        setIsSavingCommission(false);
                        return;
                      }
                    } else {
                      updateData.commission_rate = null;
                      updateData.commission_set = false;
                    }
                    
                    await usersService.updateUser(user.id, updateData);
                    
                    // Refresh user data
                    const { auth } = await import("@/api/entities");
                    const userData = await auth.me();
                    setUser(userData);
                    if (userData?.commission_rate) {
                      setCommissionRate(userData.commission_rate.toString());
                    } else {
                      setCommissionRate("");
                    }
                    
                    alert('העמלה נשמרה בהצלחה!');
                    queryClient.invalidateQueries({ queryKey: ['reports'] });
                  } catch (error) {
                    console.error('Error saving commission:', error);
                    alert('שגיאה בשמירת העמלה: ' + (error.message || 'שגיאה לא ידועה'));
                  } finally {
                    setIsSavingCommission(false);
                  }
                }}
                disabled={isSavingCommission}
                className="bg-theme-gradient"
              >
                {isSavingCommission ? 'שומר...' : 'שמור עמלה'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset Button */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">איפוס הגדרות</p>
              <p className="text-sm text-muted-foreground">חזור להגדרות ברירת המחדל</p>
            </div>
            <Button variant="outline" onClick={resetSettings}>
              איפוס
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

