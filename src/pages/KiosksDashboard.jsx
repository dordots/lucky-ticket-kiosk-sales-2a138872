import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useKiosk } from "@/contexts/KioskContext";
import * as kiosksService from "@/firebase/services/kiosks";
import * as usersService from "@/firebase/services/users";
import * as salesService from "@/firebase/services/sales";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { 
  Store,
  Users,
  TrendingUp,
  DollarSign,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/api/entities";

export default function KiosksDashboard() {
  const [user, setUser] = useState(null);
  const { currentKiosk, allKiosks, selectKiosk } = useKiosk();

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

  const { data: kiosks = [], isLoading: kiosksLoading } = useQuery({
    queryKey: ['kiosks-dashboard'],
    queryFn: () => kiosksService.getAllKiosks(),
    enabled: user?.role === 'system_manager',
  });

  // Get stats for each kiosk
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-dashboard'],
    queryFn: () => usersService.getAllUsers(),
    enabled: user?.role === 'system_manager',
  });

  // Calculate stats for each kiosk
  const kioskStats = React.useMemo(() => {
    return kiosks.map(kiosk => {
      const kioskUsers = allUsers.filter(u => u.kiosk_id === kiosk.id);
      const franchisee = kioskUsers.find(u => u.role === 'franchisee');
      const assistants = kioskUsers.filter(u => u.role === 'assistant');
      
      return {
        ...kiosk,
        franchisee,
        assistantsCount: assistants.length,
        totalUsers: kioskUsers.length,
        isActive: kiosk.is_active !== false
      };
    });
  }, [kiosks, allUsers]);

  // Check if user is system manager
  if (user?.role !== 'system_manager') {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">אין לך הרשאה לגשת לדף זה</p>
      </div>
    );
  }

  if (kiosksLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">לוח בקרה - ניהול קיוסקים</h1>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE, d בMMMM yyyy", { locale: he })}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ קיוסקים</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kiosks.length}</div>
            <p className="text-xs text-muted-foreground">
              {kiosks.filter(k => k.is_active !== false).length} פעילים
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ זכיינים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allUsers.filter(u => u.role === 'franchisee').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {allUsers.filter(u => u.role === 'franchisee' && u.is_active !== false).length} פעילים
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ עוזרים</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allUsers.filter(u => u.role === 'assistant').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {allUsers.filter(u => u.role === 'assistant' && u.is_active !== false).length} פעילים
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">סה"כ משתמשים</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allUsers.filter(u => u.role !== 'system_manager').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {allUsers.filter(u => u.role !== 'system_manager' && u.is_active !== false).length} פעילים
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Kiosks List */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">רשימת קיוסקים</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kioskStats.map((kiosk) => (
            <Card key={kiosk.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => selectKiosk(kiosk.id)}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{kiosk.name}</CardTitle>
                  <Badge className={kiosk.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                    {kiosk.isActive ? "פעיל" : "לא פעיל"}
                  </Badge>
                </div>
                {kiosk.location && (
                  <p className="text-sm text-muted-foreground mt-1">{kiosk.location}</p>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {kiosk.franchisee && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">זכיין:</span>
                      <span className="font-medium">{kiosk.franchisee.full_name || kiosk.franchisee.email}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">עוזרים:</span>
                    <span className="font-medium">{kiosk.assistantsCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">סה"כ משתמשים:</span>
                    <span className="font-medium">{kiosk.totalUsers}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {kioskStats.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Store className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">אין קיוסקים במערכת</p>
            <p className="text-sm text-muted-foreground mt-1">הוסף קיוסק חדש דרך דף ניהול הקיוסקים</p>
          </div>
        )}
      </div>
    </div>
  );
}


