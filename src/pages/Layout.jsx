
import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { auth, Notification } from "@/api/entities";
import { firebase } from "@/api/firebaseClient";
import { useQuery } from "@tanstack/react-query";
import Login from "./Login";
import { useKiosk } from "@/contexts/KioskContext";
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
  Settings,
  Store,
  ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentKiosk, allKiosks, selectKiosk, canSelectKiosk, isLoading: kioskLoading } = useKiosk();

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
    queryKey: ['notifications-unread', user?.id],
    queryFn: () => {
      // System managers don't need notifications
      if (user?.role === 'system_manager') {
        return [];
      }
      return Notification.filter({ is_read: false });
    },
    enabled: !!user && user.role !== 'system_manager',
    refetchInterval: 30000,
  });

  const isOwner = user?.position === 'owner' || user?.role === 'admin';
  const isSystemManager = user?.role === 'system_manager';
  const isFranchisee = user?.role === 'franchisee';

  const navItems = [
    { name: "דף מכירה", icon: ShoppingCart, page: "SellerPOS", roles: ['all'] },
    { name: "לוח בקרה", icon: LayoutDashboard, page: "Dashboard", roles: ['all', 'owner', 'franchisee'] },
    { name: "מלאי", icon: Package, page: "Inventory", roles: ['owner', 'franchisee'] },
    { name: "היסטוריית מכירות", icon: History, page: "SalesHistory", roles: ['all', 'franchisee'] },
    { name: "פרטי קיוסק", icon: Store, page: "KioskDetails", roles: ['franchisee'] },
    { name: "משתמשים", icon: Users, page: "UsersManagement", roles: ['owner', 'franchisee'] },
    { name: "קיוסקים", icon: Store, page: "KiosksManagement", roles: ['system_manager'] },
    { name: "לוח בקרה - קיוסקים", icon: LayoutDashboard, page: "KiosksDashboard", roles: ['system_manager'] },
    { name: "זכיינים", icon: ShieldAlert, page: "FranchiseesManagement", roles: ['system_manager'] },
    { name: "דוחות", icon: BarChart3, page: "Reports", roles: ['owner', 'franchisee'] },
    { name: "יומן פעולות", icon: History, page: "AuditLog", roles: ['owner', 'franchisee'] },
    { name: "הגדרות", icon: Settings, page: "Settings", roles: ['all'] },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (!user) return false;
    
    // System managers see only: Kiosks, Kiosks Dashboard, Settings
    if (user.role === 'system_manager') {
      return item.roles.includes('system_manager') || item.page === 'Settings';
    }
    
    // Assistants see only: SellerPOS, Settings
    if (user.role === 'assistant') {
      return item.page === 'SellerPOS' || item.page === 'Settings';
    }
    
    // Franchisees see: SellerPOS, Dashboard, Inventory, SalesHistory, Users, Reports, AuditLog, Settings
    if (user.role === 'franchisee') {
      if (item.roles.includes('all')) return true;
      if (item.roles.includes('owner') || item.roles.includes('franchisee')) return true;
      return false;
    }
    
    // Legacy owner role (for backward compatibility)
    if (item.roles.includes('all')) return true;
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
      
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 right-0 left-0 z-50 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">כרטיסי מזל</h1>
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
        fixed top-0 right-0 z-50 h-screen w-72 bg-background border-l border-border 
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:h-full
        ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full lg:h-screen">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-theme-gradient flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-foreground">כרטיסי מזל</h1>
                  <p className="text-xs text-muted-foreground">ניהול מכירות</p>
                  {currentKiosk && !kioskLoading && (
                    <div className="flex items-center gap-1 mt-1">
                      <Store className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground truncate">{currentKiosk.name}</p>
                    </div>
                  )}
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
            
            {/* Kiosk Selector for System Managers and Franchisees with multiple kiosks */}
            {canSelectKiosk && allKiosks.length > 0 && (
              <div className="mt-4">
                <Select
                  value={currentKiosk?.id || ''}
                  onValueChange={(value) => selectKiosk(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="בחר קיוסק" />
                  </SelectTrigger>
                  <SelectContent>
                    {allKiosks.map((kiosk) => (
                      <SelectItem key={kiosk.id} value={kiosk.id}>
                        {kiosk.name} {kiosk.location ? `- ${kiosk.location}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                    }
                  `}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-foreground'}`} />
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
          <div className="p-4 border-t border-border">
            {user ? (
              <DropdownMenu open={showUserMenu} onOpenChange={setShowUserMenu}>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-3 px-4 py-3 bg-accent rounded-xl cursor-pointer hover:bg-accent/80 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-theme-gradient flex items-center justify-center text-white font-medium">
                      {user.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.full_name || user.email}
                      </p>
                  <p className="text-xs text-muted-foreground">
                    {user.role === 'system_manager' ? 'מנהל מערכת' :
                     user.role === 'franchisee' ? 'זכיין' : 
                     user.role === 'assistant' ? 'עוזר זכיין' :
                     user.position === 'owner' ? 'זכיין' : 'עוזר זכיין'}
                  </p>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    התנתק
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
                    <div className="px-4 py-3 bg-accent rounded-xl">
                      <p className="text-sm text-muted-foreground text-center">לא מחובר</p>
                    </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:mr-0 min-h-0 h-full pt-16 lg:pt-0 overflow-y-auto bg-background">
        <div className="p-4 lg:p-8 h-full">
          {children}
        </div>
      </main>

    </div>
  );
}
