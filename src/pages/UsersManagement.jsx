import React, { useState, useEffect } from "react";
import { User, auth } from "@/api/entities";
import { firebase } from "@/api/firebaseClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as usersService from "@/firebase/services/users";
import * as kiosksService from "@/firebase/services/kiosks";
import { useKiosk } from "@/contexts/KioskContext";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  Search, 
  User as UserIcon,
  Edit, 
  Trash2,
  Shield,
  ShieldAlert,
  Mail,
  Phone,
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
// Toast removed

const roleLabels = {
  system_manager: "מנהל מערכת",
  franchisee: "זכיין",
  assistant: "עוזר זכיין",
};

const roleIcons = {
  system_manager: ShieldAlert,
  franchisee: ShieldAlert,
  assistant: Shield,
};

const roleColors = {
  system_manager: "bg-red-100 text-red-700",
  franchisee: "bg-purple-100 text-purple-700",
  assistant: "bg-accent text-foreground",
};

// Keep old position labels for backward compatibility
const positionLabels = {
  owner: "זכיין",
  seller: "עוזר זכיין",
};

export default function UsersManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [userLimitDialogOpen, setUserLimitDialogOpen] = useState(false);
  const [userLimitInfo, setUserLimitInfo] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const { currentKiosk } = useKiosk();
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "assistant", // 'system_manager', 'franchisee', 'assistant'
    kiosk_id: "",
    is_active: true,
    phone: "",
  });

  const queryClient = useQueryClient();

  // Get current user
  useEffect(() => {
    auth.me().then(setCurrentUser).catch(console.error);
  }, []);

  // Get available kiosks for selection
  const { data: availableKiosks = [] } = useQuery({
    queryKey: ['kiosks-for-user-creation'],
    queryFn: async () => {
      if (currentUser?.role === 'system_manager') {
        return await kiosksService.getAllKiosks();
      } else if (currentUser?.role === 'franchisee' && currentKiosk) {
        return [currentKiosk];
      }
      return [];
    },
    enabled: !!currentUser && (currentUser.role === 'system_manager' || (currentUser.role === 'franchisee' && !!currentKiosk)),
  });

  const { data: allUsers = [], isLoading } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => User.list(),
  });

  // Filter users based on current user's role
  const users = React.useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'system_manager') {
      return allUsers; // System managers see all users
    } else if (currentUser.role === 'franchisee' && currentKiosk) {
      // Franchisees see only users from their kiosk
      return allUsers.filter(u => u.kiosk_id === currentKiosk.id);
    }
    return []; // Assistants can't see users management
  }, [allUsers, currentUser, currentKiosk]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Determine role and position
      let role = data.role;
      let position = data.role === 'franchisee' ? 'owner' : 'seller';
      // Force kiosk to franchisee's kiosk when franchisee creates assistants
      let kioskId = data.kiosk_id || null;
      if (currentUser?.role === 'franchisee' && currentKiosk) {
        kioskId = currentKiosk.id;
      }
      
      // Create user in Firebase Authentication and Firestore
      await firebase.auth.createUser(data.email, data.password, {
        full_name: data.full_name,
        role: role,
        position: position,
        kiosk_id: kioskId,
        phone: data.phone,
        is_active: data.is_active,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['users-all'] });
      setDialogOpen(false);
      resetForm();
      // Show success message
      alert('משתמש נוצר בהצלחה! המשתמש יכול להתחבר עם האימייל והסיסמה שניתנו.');
      // Note: The user will need to sign in again because createUser signs out
      // This is a limitation of Firebase Auth client SDK
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-all'] });
      setDialogOpen(false);
      resetForm();
      // Toast notification removed
    },
  });

  const resetForm = () => {
    // Default role based on current user
    let defaultRole = "assistant";
    if (currentUser?.role === 'system_manager') {
      defaultRole = "franchisee"; // System managers can create franchisees
    } else if (currentUser?.role === 'franchisee') {
      defaultRole = "assistant"; // Franchisees create assistants
    }
    
    setFormData({
      email: "",
      full_name: "",
      password: "",
      role: defaultRole,
      kiosk_id: currentKiosk?.id || "",
      is_active: true,
      phone: "",
    });
    setSelectedUser(null);
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setFormData({
      email: user.email || "",
      full_name: user.full_name || "",
      password: "", // Don't show password when editing
      role: user.role || (user.position === 'owner' ? 'franchisee' : 'assistant'),
      kiosk_id: user.kiosk_id || "",
      is_active: user.is_active !== false,
      phone: user.phone || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (selectedUser) {
      // Update existing user
      const updateData = {
        is_active: formData.is_active,
        phone: formData.phone,
        full_name: formData.full_name,
      };
      
      // Only system managers can change role and kiosk
      if (currentUser?.role === 'system_manager') {
        updateData.role = formData.role;
        updateData.position = formData.role === 'franchisee' ? 'owner' : 'seller';
        if (formData.kiosk_id) {
          updateData.kiosk_id = formData.kiosk_id;
        }
      }
      
      await updateMutation.mutateAsync({ 
        id: selectedUser.id, 
        data: updateData
      });
    } else {
      // Create new user - check user limit first
      if (!formData.email || !formData.password || !formData.full_name) {
        alert('נא למלא את כל השדות הנדרשים');
        return;
      }
      
      // Validate kiosk selection
      if (formData.role === 'assistant' && !formData.kiosk_id) {
        alert('נא לבחור קיוסק לעוזר');
        return;
      }
      
      try {
        // Check user limit before creating (only for assistants)
        if (formData.role === 'assistant') {
        const limitCheck = await usersService.checkUserLimit(4);
        if (limitCheck.isLimitReached) {
          setUserLimitInfo(limitCheck);
          setUserLimitDialogOpen(true);
          return;
          }
        }
        
        await createMutation.mutateAsync({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
          kiosk_id: formData.kiosk_id,
          phone: formData.phone,
          is_active: formData.is_active,
        });
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          alert('כתובת האימייל כבר בשימוש');
        } else {
          alert('שגיאה ביצירת משתמש: ' + error.message);
        }
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.includes(searchTerm) || 
    u.email?.includes(searchTerm) ||
    u.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ניהול משתמשים</h1>
          <p className="text-muted-foreground">
            {currentUser?.role === 'system_manager' 
              ? 'ניהול זכיינים ועוזרי זכיין' 
              : currentUser?.role === 'franchisee'
              ? 'ניהול עוזרי זכיין בקיוסק שלך'
              : 'ניהול משתמשים'}
          </p>
        </div>
        {(currentUser?.role === 'system_manager' || currentUser?.role === 'franchisee') && (
        <Button 
          onClick={async () => {
            resetForm();
              // Check user limit before opening dialog (only for assistants)
              if (formData.role === 'assistant' || (!currentUser?.role === 'system_manager' && currentUser?.role === 'franchisee')) {
            try {
              const limitCheck = await usersService.checkUserLimit(4);
              if (limitCheck.isLimitReached) {
                setUserLimitInfo(limitCheck);
                setUserLimitDialogOpen(true);
                return;
              }
            } catch (error) {
              console.error('Error checking user limit:', error);
                }
            }
            setDialogOpen(true);
          }}
          className="bg-theme-gradient"
        >
          <Plus className="h-4 w-4 ml-2" />
          הוסף משתמש חדש
        </Button>
        )}
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
            const userRole = user.role || (user.position === 'owner' ? 'franchisee' : 'assistant');
            const RoleIcon = roleIcons[userRole] || Shield;
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
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                          {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground">
                            {user.full_name || 'ללא שם'}
                          </h3>
                          <Badge className={roleColors[userRole] || roleColors.assistant}>
                            <RoleIcon className="h-3 w-3 ml-1" />
                            {roleLabels[userRole] || 'עוזר זכיין'}
                          </Badge>
                        </div>
                      </div>
                      {(currentUser?.role === 'system_manager' || currentUser?.role === 'franchisee') && (
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                        <Edit className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      )}
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

      {filteredUsers.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <UserIcon className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">לא נמצאו משתמשים</p>
          <p className="text-sm text-muted-foreground mt-1">הזמן משתמשים חדשים דרך מערכת ההזמנות</p>
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

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{selectedUser ? "עריכת משתמש" : "הוספת משתמש חדש"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedUser ? (
              <div className="flex items-center gap-3 p-4 bg-accent rounded-xl">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                  {(selectedUser.full_name || selectedUser.email || 'U').charAt(0).toUpperCase()}
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
                  className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  <KeyRound className="h-4 w-4 ml-2" />
                  איפוס סיסמה
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>שם מלא *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="שם המשתמש"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>כתובת אימייל *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@example.com"
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

              {/* Role selection - only for system managers */}
              {currentUser?.role === 'system_manager' && (
              <div className="space-y-2">
                <Label>תפקיד</Label>
                <Select
                    value={formData.role}
                    onValueChange={(value) => {
                      setFormData({ 
                        ...formData, 
                        role: value,
                        kiosk_id: value === 'assistant' ? formData.kiosk_id : '' // Clear kiosk if not assistant
                      });
                    }}
                    disabled={!!selectedUser}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="franchisee">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4" />
                        <span>זכיין</span>
                      </div>
                    </SelectItem>
                      <SelectItem value="assistant">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span>עוזר זכיין</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              )}

              {/* Kiosk selection - for assistants or when editing */}
              {(formData.role === 'assistant' || selectedUser?.role === 'assistant') && availableKiosks.length > 0 && (
                <div className="space-y-2">
                  <Label>קיוסק *</Label>
                  <Select
                    value={formData.kiosk_id}
                    onValueChange={(value) => setFormData({ ...formData, kiosk_id: value })}
                    disabled={currentUser?.role === 'franchisee'} // franchisee cannot change kiosk
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר קיוסק" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableKiosks.map((kiosk) => (
                        <SelectItem key={kiosk.id} value={kiosk.id}>
                          {kiosk.name} {kiosk.location ? `- ${kiosk.location}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>טלפון</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="050-1234567"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>משתמש פעיל</Label>
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
            >
              עדכן
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

      {/* User Limit Dialog */}
      <AlertDialog open={userLimitDialogOpen} onOpenChange={setUserLimitDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              הגעת למגבלת המשתמשים
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                הגעת למגבלה של <strong>{userLimitInfo?.maxUsers || 4} משתמשים פעילים</strong>.
              </p>
              <p>
                כרגע יש לך <strong>{userLimitInfo?.currentCount || 0} משתמשים פעילים</strong> במערכת.
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
                <p className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                  כדי להוסיף משתמשים נוספים:
                </p>
                <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-300 text-sm">
                  <li>צור קשר עם התמיכה הטכנית</li>
                  <li>בצע תשלום להסרת המגבלה</li>
                  <li>קבל הרשאה למספר משתמשים בלתי מוגבל</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>הבנתי</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setUserLimitDialogOpen(false);
                // כאן ניתן להוסיף קישור לעמוד תשלום או יצירת קשר
                alert('לצורך הוספת משתמשים נוספים, אנא צור קשר עם התמיכה הטכנית.');
              }}
              className="bg-theme-gradient"
            >
              יצירת קשר
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}