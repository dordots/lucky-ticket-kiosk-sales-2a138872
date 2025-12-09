import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as usersService from "@/firebase/services/users";
import * as kiosksService from "@/firebase/services/kiosks";
import { firebase } from "@/api/firebaseClient";
import { auth } from "@/api/entities";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Search, 
  User as UserIcon,
  Edit, 
  Trash2,
  ShieldAlert,
  Mail,
  Phone,
  Store,
  KeyRound
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

export default function FranchiseesManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "franchisee",
    kiosk_id: "",
    is_active: true,
    phone: "",
  });

  const queryClient = useQueryClient();

  // Get current user to check permissions
  useEffect(() => {
    auth.me().then(setCurrentUser).catch(console.error);
  }, []);

  const { data: franchisees = [], isLoading: franchiseesLoading } = useQuery({
    queryKey: ['franchisees-all'],
    queryFn: () => usersService.getUsersByRole('franchisee'),
    enabled: currentUser?.role === 'system_manager',
  });

  const { data: assistants = [], isLoading: assistantsLoading } = useQuery({
    queryKey: ['assistants-all'],
    queryFn: () => usersService.getUsersByRole('assistant'),
    enabled: currentUser?.role === 'system_manager',
  });

  const { data: kiosks = [] } = useQuery({
    queryKey: ['kiosks-for-franchisees'],
    queryFn: () => kiosksService.getAllKiosks(),
    enabled: currentUser?.role === 'system_manager',
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      await firebase.auth.createUser(data.email, data.password, {
        full_name: data.full_name,
        role: data.role,
        position: data.role === 'franchisee' ? 'owner' : 'assistant',
        kiosk_id: data.kiosk_id || null,
        kiosk_ids: data.role === 'franchisee' && data.kiosk_id ? [data.kiosk_id] : [],
        phone: data.phone,
        is_active: data.is_active,
      });
      
      // If kiosk_id is provided and role is franchisee, update the kiosk with franchisee_id
      if (data.kiosk_id && data.role === 'franchisee') {
        // Get the created user's UID
        const allUsers = await usersService.getAllUsers();
        const createdUser = allUsers.find(u => u.email === data.email);
        if (createdUser) {
          await kiosksService.updateKiosk(data.kiosk_id, {
            franchisee_id: createdUser.id
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['franchisees-all'] });
      queryClient.invalidateQueries({ queryKey: ['assistants-all'] });
      queryClient.invalidateQueries({ queryKey: ['kiosks-for-franchisees'] });
      queryClient.invalidateQueries({ queryKey: ['kiosks-all'] });
      setDialogOpen(false);
      resetForm();
      alert('משתמש נוצר בהצלחה!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => usersService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['franchisees-all'] });
      queryClient.invalidateQueries({ queryKey: ['assistants-all'] });
      queryClient.invalidateQueries({ queryKey: ['kiosks-for-franchisees'] });
      setDialogOpen(false);
      resetForm();
      alert('משתמש עודכן בהצלחה!');
    },
  });

  const resetForm = () => {
    setFormData({
      email: "",
      full_name: "",
      password: "",
      role: "franchisee",
      kiosk_id: "",
      is_active: true,
      phone: "",
    });
    setSelectedUser(null);
  };

  const getRoleLabel = (role) => role === 'assistant' ? 'עוזר זכיין' : 'זכיין';

  const handleEdit = (user) => {
    setSelectedUser(user);
    setFormData({
      email: user.email || "",
      full_name: user.full_name || "",
      password: "",
      role: user.role || "franchisee",
      kiosk_id: user.kiosk_id || "",
      is_active: user.is_active !== false,
      phone: user.phone || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.email || !formData.full_name) {
      alert('נא למלא את כל השדות הנדרשים');
      return;
    }

    if (selectedUser) {
      // Update existing user
      await updateMutation.mutateAsync({ 
        id: selectedUser.id, 
        data: {
          full_name: formData.full_name,
          kiosk_id: formData.kiosk_id || null,
          kiosk_ids: (formData.role === 'franchisee' && formData.kiosk_id) ? [formData.kiosk_id] : [],
          is_active: formData.is_active,
          phone: formData.phone,
        }
      });
    } else {
      // Create new user
      if (!formData.password) {
        alert('נא להזין סיסמה');
        return;
      }

      if (formData.role === 'assistant' && !formData.kiosk_id) {
        alert('עבור עוזר זכיין יש לבחור קיוסק');
        return;
      }
      
      try {
        await createMutation.mutateAsync(formData);
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          alert('כתובת האימייל כבר בשימוש');
        } else {
          alert('שגיאה ביצירת זכיין: ' + error.message);
        }
      }
    }
  };

  const users = [...franchisees, ...assistants];

  const filteredUsers = users.filter(u => 
    u.full_name?.includes(searchTerm) || 
    u.email?.includes(searchTerm) ||
    u.phone?.includes(searchTerm)
  );

  // Check if user is system manager
  if (currentUser?.role !== 'system_manager') {
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
          <h1 className="text-2xl font-bold text-foreground">יצירת משתמשים</h1>
          <p className="text-muted-foreground">יצירה וניהול זכיינים ועוזרי זכיינים במערכת</p>
        </div>
        <Button 
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          className="bg-theme-gradient"
        >
          <Plus className="h-4 w-4 ml-2" />
          הוסף משתמש חדש
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="חיפוש לפי שם, מייל או טלפון..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filteredUsers.map((user, index) => {
            const kiosk = kiosks.find(k => k.id === user.kiosk_id);
            const isActive = user.is_active !== false;
            
            return (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`relative overflow-hidden ${!isActive ? 'opacity-60' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                          {(user.full_name || user.email || 'Z').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground">
                            {user.full_name || 'ללא שם'}
                          </h3>
                          <Badge className={user.role === 'franchisee' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}>
                            <ShieldAlert className="h-3 w-3 ml-1" />
                            {user.role === 'franchisee' ? 'זכיין' : 'עוזר זכיין'}
                          </Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-foreground">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{user.email}</span>
                      </div>
                      {user.phone && (
                        <div className="flex items-center gap-2 text-foreground">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{user.phone}</span>
                        </div>
                      )}
                      {kiosk && (
                        <div className="flex items-center gap-2 text-foreground">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate">{kiosk.name}</span>
                        </div>
                      )}
                    </div>

                    {!isActive && (
                      <div className="absolute top-2 left-2">
                        <Badge variant="secondary" className="bg-red-100 text-red-700">
                          לא פעיל
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredUsers.length === 0 && !franchiseesLoading && !assistantsLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <UserIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">לא נמצאו משתמשים</p>
          <p className="text-sm text-muted-foreground mt-1">הוסף משתמש חדש כדי להתחיל</p>
        </div>
      )}

      {(franchiseesLoading || assistantsLoading) && (
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
            <DialogTitle>{selectedUser ? "עריכת משתמש" : "הוספת משתמש חדש"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedUser ? (
              <div className="flex items-center gap-3 p-4 bg-accent rounded-xl">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                  {(selectedUser.full_name || selectedUser.email || 'Z').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground">
                    {selectedUser.full_name || 'ללא שם'}
                  </h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResetPasswordDialogOpen(true)}
                  className="text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                  <KeyRound className="h-4 w-4 ml-2" />
                  איפוס סיסמה
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>תפקיד *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר תפקיד" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="franchisee">זכיין</SelectItem>
                      <SelectItem value="assistant">עוזר זכיין</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>שם מלא *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder={`שם ${getRoleLabel(formData.role)}`}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>כתובת אימייל *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="franchisee@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>סיסמה *</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="מינימום 6 תווים"
                    required
                    minLength={6}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>קיוסק {formData.role === 'assistant' ? '(חובה לעוזר זכיין)' : ''}</Label>
              <Select
                value={formData.kiosk_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, kiosk_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר קיוסק (אופציונלי)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא קיוסק</SelectItem>
                  {kiosks
                    .filter(k => !k.franchisee_id || k.franchisee_id === selectedUser?.id)
                    .map((kiosk) => (
                      <SelectItem key={kiosk.id} value={kiosk.id}>
                        {kiosk.name} {kiosk.location ? `- ${kiosk.location}` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>טלפון</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="050-1234567"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>{`${getRoleLabel(formData.role)} פעיל`}</Label>
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
              {selectedUser ? "עדכן" : "צור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <AlertDialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>איפוס סיסמה</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך לאפס את הסיסמה של {selectedUser?.full_name || selectedUser?.email}?
              <br />
              <br />
              הודעת איפוס סיסמה תישלח לכתובת האימייל: <strong>{selectedUser?.email}</strong>
              <br />
              המשתמש יוכל ליצור סיסמה חדשה דרך הקישור בהודעה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await firebase.auth.resetUserPassword(selectedUser?.email);
                  alert('הודעת איפוס סיסמה נשלחה בהצלחה לכתובת האימייל');
                  setResetPasswordDialogOpen(false);
                } catch (error) {
                  alert('שגיאה באיפוס סיסמה: ' + error.message);
                }
              }}
              className="bg-primary hover:bg-primary/90"
            >
              שלח הודעת איפוס
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

