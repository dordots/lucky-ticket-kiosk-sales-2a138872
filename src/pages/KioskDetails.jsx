import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useKiosk } from "@/contexts/KioskContext";
import * as kiosksService from "@/firebase/services/kiosks";
import * as usersService from "@/firebase/services/users";
import { auth } from "@/api/entities";
import { motion } from "framer-motion";
import { 
  Store,
  MapPin,
  Users,
  Edit,
  User,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function KioskDetails() {
  const [user, setUser] = useState(null);
  const hasPermission = (perm) => {
    if (!user) return false;
    if (user.role !== 'assistant') return true;
    if (!perm) return true;
    return Array.isArray(user.permissions) ? user.permissions.includes(perm) : false;
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const { currentKiosk, refreshKiosks } = useKiosk();
  const [formData, setFormData] = useState({
    name: "",
    location: "",
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await auth.me();
        setUser(userData);
      } catch (e) {
        console.log("User not logged in");
      }
    };
    loadUser();
  }, []);

  const { data: kioskUsers = [] } = useQuery({
    queryKey: ['kiosk-users', currentKiosk?.id],
    queryFn: () => {
      if (currentKiosk?.id) {
        return usersService.getUsersByKiosk(currentKiosk.id);
      }
      return [];
    },
    enabled: !!currentKiosk && (user?.role === 'franchisee' || user?.role === 'system_manager'),
  });

  // Permission guard for assistants
  if (user && user.role === 'assistant' && !hasPermission('kiosk_details_view')) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">אין לך הרשאה לצפות בפרטי הקיוסק</p>
      </div>
    );
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => kiosksService.updateKiosk(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiosks-all'] });
      queryClient.invalidateQueries({ queryKey: ['kiosks-for-franchisees'] });
      refreshKiosks();
      setDialogOpen(false);
      alert('פרטי הקיוסק עודכנו בהצלחה!');
    },
  });

  const handleEdit = () => {
    if (currentKiosk) {
      setFormData({
        name: currentKiosk.name || "",
        location: currentKiosk.location || "",
      });
      setDialogOpen(true);
    }
  };

  const handleSubmit = async () => {
    if (!currentKiosk) return;
    
    if (!formData.name) {
      alert('נא למלא את שם הקיוסק');
      return;
    }

    await updateMutation.mutateAsync({ 
      id: currentKiosk.id, 
      data: {
        name: formData.name,
        location: formData.location,
      }
    });
  };

  // Check if user is franchisee or system manager
  if (!user || (user.role !== 'franchisee' && user.role !== 'system_manager')) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">אין לך הרשאה לגשת לדף זה</p>
      </div>
    );
  }

  if (!currentKiosk) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">לא נמצא קיוסק</p>
      </div>
    );
  }

  const franchisee = kioskUsers.find(u => u.role === 'franchisee');
  const assistants = kioskUsers.filter(u => u.role === 'assistant');
  const isActive = currentKiosk.is_active !== false;
  const canEdit = user.role === 'franchisee' && currentKiosk.franchisee_id === user.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">פרטי הקיוסק</h1>
          <p className="text-muted-foreground">מידע על הקיוסק שלך</p>
        </div>
        {canEdit && (
          <Button 
            onClick={handleEdit}
            className="bg-theme-gradient"
          >
            <Edit className="h-4 w-4 ml-2" />
            ערוך פרטים
          </Button>
        )}
      </div>

      {/* Kiosk Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              {currentKiosk.name}
            </CardTitle>
            <Badge className={isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
              {isActive ? (
                <>
                  <CheckCircle2 className="h-3 w-3 ml-1" />
                  פעיל
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 ml-1" />
                  לא פעיל
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Location */}
          {currentKiosk.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">מיקום</p>
                <p className="text-foreground">{currentKiosk.location}</p>
              </div>
            </div>
          )}

          {/* Franchisee */}
          {franchisee && (
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">זכיין</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-foreground font-medium">{franchisee.full_name || 'ללא שם'}</p>
                  {franchisee.email && (
                    <span className="text-sm text-muted-foreground">({franchisee.email})</span>
                  )}
                </div>
                {franchisee.phone && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <Phone className="h-3 w-3 inline ml-1" />
                    {franchisee.phone}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Assistants */}
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                עוזרים ({assistants.length})
              </p>
              {assistants.length > 0 ? (
                <div className="space-y-2">
                  {assistants.map((assistant) => (
                    <div key={assistant.id} className="flex items-center justify-between p-2 bg-accent rounded-lg">
                      <div>
                        <p className="text-foreground font-medium">{assistant.full_name || 'ללא שם'}</p>
                        {assistant.email && (
                          <p className="text-sm text-muted-foreground">{assistant.email}</p>
                        )}
                      </div>
                      <Badge className={assistant.is_active !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                        {assistant.is_active !== false ? "פעיל" : "לא פעיל"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">אין עוזרים בקיוסק זה</p>
              )}
            </div>
          </div>

          {/* Created Date */}
          {currentKiosk.created_date && (
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">תאריך יצירה</p>
                <p className="text-foreground">
                  {new Date(currentKiosk.created_date.toDate?.() || currentKiosk.created_date).toLocaleDateString('he-IL')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת פרטי קיוסק</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>שם הקיוסק *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="שם הקיוסק"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>מיקום</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="מיקום הקיוסק"
              />
            </div>
          </div>

          <DialogFooter className="gap-3 sm:gap-3">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ביטול
            </Button>
            <Button 
              onClick={handleSubmit}
              className="bg-theme-gradient"
              disabled={updateMutation.isPending}
            >
              עדכן
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}





