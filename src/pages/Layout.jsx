
import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { auth, Notification } from "@/api/entities";
import { firebase } from "@/api/firebaseClient";
import { useQuery } from "@tanstack/react-query";
import Login from "./Login";
import { 
  ShoppingCart, 
  LayoutDashboard, 
  Package, 
  History, 
  Users, 
  BarChart3, 
  Bell,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  Key
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Listen to auth state changes
    const unsubscribe = firebase.auth.onAuthStateChange(async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        try {
          const userData = await auth.me();
          setUser(userData);
        } catch (e) {
          console.log("Error loading user data");
          setUser(null);
        }
      } else {
        setUser(null);
        // Redirect to login if not on login page
        if (location.pathname !== '/Login') {
          navigate('/Login');
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [location.pathname, navigate]);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => Notification.filter({ is_read: false }),
    refetchInterval: 30000,
  });

  const isOwner = user?.position === 'owner' || user?.role === 'admin';

  const navItems = [
    { name: "מכירה", icon: ShoppingCart, page: "SellerPOS", roles: ['all'] },
    { name: "לוח בקרה", icon: LayoutDashboard, page: "Dashboard", roles: ['all', 'owner'] },
    { name: "מלאי", icon: Package, page: "Inventory", roles: ['owner'] },
    { name: "היסטוריית מכירות", icon: History, page: "SalesHistory", roles: ['all'] },
    { name: "משתמשים", icon: Users, page: "UsersManagement", roles: ['owner'] },
    { name: "דוחות", icon: BarChart3, page: "Reports", roles: ['owner'] },
    { name: "יומן פעולות", icon: History, page: "AuditLog", roles: ['owner'] },
  ];

  const filteredNavItems = navItems.filter(item => {
    // If user is seller, show only SellerPOS
    if (user && user.position === 'seller' && user.role !== 'admin') {
      return item.page === 'SellerPOS';
    }
    if (item.roles.includes('all')) return true;
    if (!user) return false; // אם אין משתמש, הצג רק 'all'
    if (item.roles.includes('owner') && isOwner) return true;
    return false;
  });
  
  const isSeller = user && user.position === 'seller' && user.role !== 'admin';

  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await auth.logout();
      setUser(null);
      window.location.reload(); // רענון הדף כדי לאפס את כל המצב
    } catch (e) {
      console.error("Error logging out:", e);
    }
  };

  // Show login page if not authenticated
  if (!user && !isLoading && location.pathname !== '/Login') {
    return <Login />;
  }

  // Show login page directly if on login route
  if (location.pathname === '/Login') {
    return <Login />;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen h-screen bg-slate-50 flex flex-col lg:flex-row overflow-hidden">
      <style>{`
        :root {
          --primary: 241 77% 63%;
          --primary-foreground: 0 0% 100%;
        }
      `}</style>
      
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 right-0 left-0 z-50 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="text-lg font-bold text-slate-800">כרטיסי מזל</h1>
          {!isSeller && (
            <div className="flex items-center gap-2">
              <Link to={createPageUrl("Notifications")}>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {notifications.length > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500">
                      {notifications.length}
                    </Badge>
                  )}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 right-0 z-50 h-screen w-72 bg-white border-l border-slate-200 
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:h-full
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full lg:h-screen">
          {/* Logo */}
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">כרטיסי מזל</h1>
                  <p className="text-xs text-slate-500">ניהול מכירות</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNavItems.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                    ${isActive 
                      ? 'bg-indigo-50 text-indigo-600 font-medium' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }
                  `}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                  {item.page === "Notifications" && notifications.length > 0 && (
                    <Badge className="mr-auto bg-red-500 text-white">
                      {notifications.length}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-slate-100">
            {user ? (
              <DropdownMenu open={showUserMenu} onOpenChange={setShowUserMenu}>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-medium">
                      {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {user.full_name || user.email}
                      </p>
                  <p className="text-xs text-slate-500">
                    {user.position === 'owner' ? 'בעל עסק' : 
                     user.role === 'admin' ? 'מנהל מערכת' : 'מוכר'}
                  </p>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => {
                    setChangePasswordOpen(true);
                    setShowUserMenu(false);
                  }}>
                    <Key className="h-4 w-4 mr-2" />
                    שנה סיסמה
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    התנתק
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
                    <div className="px-4 py-3 bg-slate-50 rounded-xl">
                      <p className="text-sm text-slate-500 text-center">לא מחובר</p>
                    </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:mr-0 min-h-0 h-full pt-16 lg:pt-0 overflow-y-auto">
        <div className="p-4 lg:p-8 h-full">
          {children}
        </div>
      </main>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>שינוי סיסמה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {passwordError}
              </div>
            )}
            <div className="space-y-2">
              <Label>סיסמה נוכחית</Label>
              <Input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                placeholder="הזן סיסמה נוכחית"
              />
            </div>
            <div className="space-y-2">
              <Label>סיסמה חדשה</Label>
              <Input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="מינימום 6 תווים"
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label>אישור סיסמה</Label>
              <Input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="הזן שוב את הסיסמה החדשה"
                minLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setChangePasswordOpen(false);
              setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
              setPasswordError("");
            }}>
              ביטול
            </Button>
            <Button
              onClick={async () => {
                setPasswordError("");
                if (passwordData.newPassword !== passwordData.confirmPassword) {
                  setPasswordError("הסיסמאות לא תואמות");
                  return;
                }
                if (passwordData.newPassword.length < 6) {
                  setPasswordError("סיסמה חייבת להכיל לפחות 6 תווים");
                  return;
                }
                try {
                  await firebase.auth.changePassword(passwordData.currentPassword, passwordData.newPassword);
                  setChangePasswordOpen(false);
                  setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
                  alert("סיסמה שונתה בהצלחה");
                } catch (error) {
                  if (error.code === "auth/wrong-password") {
                    setPasswordError("סיסמה נוכחית שגויה");
                  } else {
                    setPasswordError("שגיאה בשינוי סיסמה: " + error.message);
                  }
                }
              }}
              className="bg-gradient-to-r from-indigo-500 to-purple-600"
            >
              שנה סיסמה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
