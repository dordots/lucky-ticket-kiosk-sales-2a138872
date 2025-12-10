import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import * as kiosksService from "@/firebase/services/kiosks";
import * as usersService from "@/firebase/services/users";
import { auth } from "@/api/entities";
import { useKiosk } from "@/contexts/KioskContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Store } from "lucide-react";

export default function KioskSelfCreate() {
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
  });
  const navigate = useNavigate();
  const { currentKiosk } = useKiosk();

  useEffect(() => {
    auth.me().then(setCurrentUser).catch(console.error);
  }, []);

  const createMutation = useMutation({
    mutationFn: (data) => kiosksService.createKiosk(data),
    onSuccess: async (created) => {
      try {
        // Assign kiosk to user
        await usersService.updateUser(currentUser.id, {
          kiosk_id: created.id,
          kiosk_ids: [created.id],
        });
      } catch (err) {
        console.error("Error updating user with kiosk:", err);
      }
      alert("קיוסק נוצר בהצלחה!");
      // סימון לניווט אחרי ריענון, כדי שהקונטקסט יתעדכן ואז לעבור לדשבורד
      localStorage.setItem('afterReloadRedirect', '/Dashboard');
      window.location.reload();
    },
    onError: (err) => {
      console.error(err);
      alert("שגיאה ביצירת קיוסק: " + (err?.message || "שגיאה לא ידועה"));
    }
  });

  if (!currentUser) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">טוען...</p>
      </div>
    );
  }

  // If user is not franchisee, block
  if (currentUser.role !== "franchisee") {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">אין לך הרשאה לגשת לדף זה</p>
      </div>
    );
  }

  // If franchisee already has a kiosk, block this page
  if (currentKiosk || currentUser.kiosk_id || (currentUser.kiosk_ids && currentUser.kiosk_ids.length > 0)) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">כבר יש לך קיוסק משויך.</p>
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert("נא למלא שם קיוסק");
      return;
    }
    const payload = {
      name: formData.name,
      location: formData.location,
      franchisee_id: currentUser.id,
      is_active: true,
    };
    createMutation.mutate(payload);
  };

  return (
    <div className="max-w-xl mx-auto py-10">
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">יצירת קיוסק</h1>
              <p className="text-muted-foreground">מלא את פרטי הקיוסק שלך.</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label>שם הקיוסק *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="לדוגמה: קיוסק מרכז העיר"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>מיקום</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="לדוגמה: רחוב הרצל 10, תל אביב"
              />
            </div>

            <Button type="submit" className="w-full bg-theme-gradient" disabled={createMutation.isLoading}>
              {createMutation.isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  יוצר...
                </span>
              ) : (
                "צור קיוסק"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

