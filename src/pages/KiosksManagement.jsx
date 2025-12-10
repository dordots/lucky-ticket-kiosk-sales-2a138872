import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as kiosksService from "@/firebase/services/kiosks";
import * as usersService from "@/firebase/services/users";
import { auth } from "@/api/entities";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Search, 
  Store,
  Edit, 
  Trash2,
  MapPin,
  User,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useKiosk } from "@/contexts/KioskContext";

export default function KiosksManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedKiosk, setSelectedKiosk] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    franchisee_id: "",
    is_active: true,
  });
  const [currentUser, setCurrentUser] = useState(null);
  const { refreshKiosks, currentKiosk } = useKiosk();

  const queryClient = useQueryClient();

  // Get current user to check permissions
  React.useEffect(() => {
    auth.me().then(setCurrentUser).catch(console.error);
  }, []);

  const { data: kiosks = [], isLoading } = useQuery({
    queryKey: ['kiosks-all'],
    queryFn: () => kiosksService.getAllKiosks(),
    enabled: currentUser?.role === 'system_manager' || currentUser?.role === 'franchisee',
  });

  const { data: franchisees = [] } = useQuery({
    queryKey: ['franchisees-all'],
    queryFn: () => usersService.getUsersByRole('franchisee'),
    enabled: currentUser?.role === 'system_manager',
  });

  const createMutation = useMutation({
    mutationFn: (data) => kiosksService.createKiosk(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiosks-all'] });
      refreshKiosks();
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => kiosksService.updateKiosk(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiosks-all'] });
      refreshKiosks();
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => kiosksService.deleteKiosk(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kiosks-all'] });
      refreshKiosks();
      setDeleteDialogOpen(false);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      location: "",
      franchisee_id: "",
      is_active: true,
    });
    setSelectedKiosk(null);
  };

  const handleEdit = (kiosk) => {
    setSelectedKiosk(kiosk);
    setFormData({
      name: kiosk.name || "",
      location: kiosk.location || "",
      franchisee_id: kiosk.franchisee_id || "",
      is_active: kiosk.is_active !== false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('נא למלא את שם הקיוסק');
      return;
    }

    const payload = {
      ...formData,
      franchisee_id: formData.franchisee_id || null,
    };

    // If franchisee is creating, force assign to themselves
    if (currentUser?.role === 'franchisee') {
      payload.franchisee_id = currentUser.id;
    }

    if (selectedKiosk) {
      await updateMutation.mutateAsync({ 
        id: selectedKiosk.id, 
        data: payload 
      });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleDelete = async () => {
    if (selectedKiosk) {
      await deleteMutation.mutateAsync(selectedKiosk.id);
    }
  };

  const filteredKiosks = kiosks
    .filter(k => k.name?.includes(searchTerm) || k.location?.includes(searchTerm))
    .filter(k => {
      if (currentUser?.role === 'franchisee') {
        return k.franchisee_id === currentUser.id;
      }
      return true;
    });

  // Franchisee access: only if they don't have a kiosk yet
  if (currentUser?.role === 'franchisee') {
    const hasKiosk = kiosks.some(k => k.franchisee_id === currentUser.id) || !!currentKiosk;
    if (hasKiosk) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">כבר משויך לך קיוסק</p>
        </div>
      );
    }
  } else if (currentUser && currentUser.role !== 'system_manager') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">אין לך הרשאה לגשת לדף זה</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ניהול קיוסקים</h1>
          <p className="text-muted-foreground">ניהול כל הקיוסקים במערכת</p>
        </div>
        <Button 
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          className="bg-theme-gradient"
        >
          <Plus className="h-4 w-4 ml-2" />
          הוסף קיוסק חדש
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="חיפוש לפי שם או מיקום..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Kiosks Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filteredKiosks.map((kiosk, index) => {
            const franchisee = franchisees.find(f => f.id === kiosk.franchisee_id);
            const isActive = kiosk.is_active !== false;
            
            return (
              <motion.div
                key={kiosk.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`relative overflow-hidden ${!isActive ? 'opacity-60' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white">
                          <Store className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground">
                            {kiosk.name || 'ללא שם'}
                          </h3>
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
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(kiosk)}>
                          <Edit className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        {currentUser?.role === 'system_manager' && (
                          <Button variant="ghost" size="icon" onClick={() => {
                            setSelectedKiosk(kiosk);
                            setDeleteDialogOpen(true);
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      {kiosk.location && (
                        <div className="flex items-center gap-2 text-foreground">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{kiosk.location}</span>
                        </div>
                      )}
                      {franchisee ? (
                        <div className="flex items-center gap-2 text-foreground">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>{franchisee.full_name || franchisee.email}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <User className="h-4 w-4" />
                          <span>ללא זכיין</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredKiosks.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Store className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">לא נמצאו קיוסקים</p>
          <p className="text-sm text-muted-foreground mt-1">הוסף קיוסק חדש כדי להתחיל</p>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-accent" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-accent rounded" />
                    <div className="h-3 w-16 bg-accent rounded" />
                  </div>
                </div>
                <div className="h-3 w-full bg-accent rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedKiosk ? "עריכת קיוסק" : "הוספת קיוסק חדש"}</DialogTitle>
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

                    <div className="space-y-2">
                      {currentUser?.role === 'franchisee' ? (
                        <div className="text-sm text-muted-foreground">
                          הקיוסק ישויך אליך אוטומטית
                        </div>
                      ) : (
                        <>
                        <Label>זכיין (לא חובה)</Label>
                        <Select
                          value={formData.franchisee_id}
                          onValueChange={(value) => setFormData({ ...formData, franchisee_id: value === 'none' ? '' : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="בחר זכיין או השאר ריק" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">ללא זכיין</SelectItem>
                            {franchisees
                              .filter((franchisee) => {
                                // exclude franchisees already assigned to another kiosk
                                const assignedKiosk = kiosks.find(
                                  (k) => k.franchisee_id === franchisee.id && k.id !== selectedKiosk?.id
                                );
                                return !assignedKiosk;
                              })
                              .map((franchisee) => (
                                <SelectItem key={franchisee.id} value={franchisee.id}>
                                  {franchisee.full_name || franchisee.email}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        </>
                      )}
                    </div>

            <div className="flex items-center justify-between">
              <Label>קיוסק פעיל</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
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
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {selectedKiosk ? "עדכן" : "צור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת קיוסק</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את הקיוסק "{selectedKiosk?.name}"?
              <br />
              <br />
              פעולה זו תמחק את הקיוסק ולא ניתן לבטל אותה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}





