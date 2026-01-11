import React, { useState, useEffect, useMemo } from "react";
import { auth, Sale, TicketType, User } from "@/api/entities";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useKiosk } from "@/contexts/KioskContext";
import { format, startOfDay, endOfDay, startOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear } from "date-fns";
import { he } from "date-fns/locale";
import * as salesService from "@/firebase/services/sales";
import * as ticketTypesService from "@/firebase/services/ticketTypes";
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users,
  ArrowLeft,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import StatsCard from "@/components/dashboard/StatsCard";
import RecentSalesTable from "@/components/dashboard/RecentSalesTable";
import LowStockAlert from "@/components/dashboard/LowStockAlert";
import SalesChart from "@/components/dashboard/SalesChart";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const hasPermission = (perm) => {
    if (!user) return false;
    if (user.role !== 'assistant') return true;
    if (!perm) return true;
    return Array.isArray(user.permissions) ? user.permissions.includes(perm) : false;
  };
  const [salesPeriod, setSalesPeriod] = useState("week"); // day, week, month, year
  const { currentKiosk, isLoading: kioskLoading } = useKiosk();

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

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sales-dashboard', currentKiosk?.id],
    queryFn: () => {
      if (currentKiosk?.id) {
        return salesService.getSalesByKiosk(currentKiosk.id, 100);
      } else if (user?.role === 'system_manager') {
        return salesService.getAllSales(100);
      }
      return [];
    },
    enabled: !kioskLoading && (!!currentKiosk || user?.role === 'system_manager'),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets-dashboard', currentKiosk?.id],
    queryFn: () => {
      if (currentKiosk?.id) {
        return ticketTypesService.getTicketTypesByKiosk(currentKiosk.id);
      } else if (user?.role === 'system_manager') {
        return ticketTypesService.getAllTicketTypes();
      }
      return [];
    },
    enabled: !kioskLoading && (!!currentKiosk || user?.role === 'system_manager'),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => User.list(),
  });

  // Calculate stats with useMemo for performance
  const today = new Date(); // Define today outside useMemo for use in JSX
  const stats = useMemo(() => {
    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);
    const monthStart = startOfMonth(today);

    const todaySales = sales.filter(sale => {
      const saleDate = new Date(sale.created_date);
      return saleDate >= todayStart && saleDate <= todayEnd && sale.status === 'completed';
    });

    const monthSales = sales.filter(sale => {
      const saleDate = new Date(sale.created_date);
      return saleDate >= monthStart && sale.status === 'completed';
    });

    const todayRevenue = todaySales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const monthRevenue = monthSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const todayTickets = todaySales.reduce((sum, sale) => 
      sum + (sale.items?.reduce((s, item) => s + item.quantity, 0) || 0), 0
    );

    const lowStockCount = tickets.filter(t => {
      const quantityCounter = t.quantity_counter ?? 0;
      const quantityVault = t.quantity_vault ?? 0;
      const totalQuantity = quantityCounter + quantityVault;
      const threshold = t.min_threshold || 10;
      
      // Only count tickets that:
      // 1. Are active
      // 2. Have been entered into inventory (totalQuantity > 0)
      // 3. Have stock on counter that is low (quantityCounter > 0 && quantityCounter <= threshold)
      return t.is_active && 
             totalQuantity > 0 && 
             quantityCounter > 0 && 
             quantityCounter <= threshold;
    }).length;
    const activeUsers = users.filter(u => u.is_active !== false).length;

    return {
      todaySales,
      monthSales,
      todayRevenue,
      monthRevenue,
      todayTickets,
      lowStockCount,
      activeUsers,
    };
  }, [sales, tickets, users]);

  const { todaySales, monthSales, todayRevenue, monthRevenue, todayTickets, lowStockCount, activeUsers } = stats;

  const isOwner = user?.position === 'owner' || user?.role === 'admin';

  const handleViewSale = (sale) => {
    // Navigate to sale details
    window.location.href = createPageUrl(`SaleDetails?id=${sale.id}`);
  };

  const handleEditSale = (sale) => {
    window.location.href = createPageUrl(`EditSale?id=${sale.id}`);
  };

  const handleDeleteSale = (sale) => {
    window.location.href = createPageUrl(`DeleteSale?id=${sale.id}`);
  };

  const isLoading = salesLoading || ticketsLoading;

  // Permission guard for assistants
  if (user && user.role === 'assistant' && !hasPermission('dashboard_view')) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">אין לך הרשאה לגשת ללוח הבקרה</p>
      </div>
    );
  }

  if (isLoading) {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">לוח בקרה</h1>
          <p className="text-muted-foreground">
            {format(today, "EEEE, d בMMMM yyyy", { locale: he })}
          </p>
        </div>
        <Link to={createPageUrl("SellerPOS")}>
          <Button className="bg-theme-gradient">
            <ShoppingCart className="h-4 w-4 ml-2" />
            מכירה חדשה
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="הכנסות היום"
          value={`₪${todayRevenue.toFixed(2)}`}
          icon={DollarSign}
          color="green"
          delay={0}
        />
        <StatsCard
          title="כרטיסים נמכרו היום"
          value={todayTickets}
          icon={ShoppingCart}
          color="indigo"
          delay={0.1}
        />
        <StatsCard
          title="מלאי קריטי"
          value={lowStockCount}
          icon={Package}
          color={lowStockCount > 0 ? "orange" : "blue"}
          delay={0.2}
          description="כרטיסים שהמלאי שלהם נמוך מסף ההתראה"
        />
        <StatsCard
          title="הכנסות החודש"
          value={`₪${monthRevenue.toFixed(2)}`}
          icon={TrendingUp}
          color="blue"
          delay={0.3}
        />
      </div>

      {/* Low Stock Alert */}
      <LowStockAlert tickets={tickets} />

      {/* Charts & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              {salesPeriod === "day" && "מכירות היום"}
              {salesPeriod === "week" && "מכירות השבוע"}
              {salesPeriod === "month" && "מכירות החודש"}
              {salesPeriod === "year" && "מכירות השנה"}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={salesPeriod === "day" ? "default" : "outline"}
                size="sm"
                onClick={() => setSalesPeriod("day")}
                className={salesPeriod === "day" ? "bg-primary hover:bg-primary/90" : ""}
              >
                יום
              </Button>
              <Button
                variant={salesPeriod === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setSalesPeriod("week")}
                className={salesPeriod === "week" ? "bg-primary hover:bg-primary/90" : ""}
              >
                שבוע
              </Button>
              <Button
                variant={salesPeriod === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setSalesPeriod("month")}
                className={salesPeriod === "month" ? "bg-primary hover:bg-primary/90" : ""}
              >
                חודש
              </Button>
              <Button
                variant={salesPeriod === "year" ? "default" : "outline"}
                size="sm"
                onClick={() => setSalesPeriod("year")}
                className={salesPeriod === "year" ? "bg-primary hover:bg-primary/90" : ""}
              >
                שנה
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <SalesChart sales={sales} period={salesPeriod} />
          </CardContent>
        </Card>

        {/* Top Tickets */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">כרטיסים מובילים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                // Calculate top selling tickets
                const ticketSales = {};
                monthSales.forEach(sale => {
                  sale.items?.forEach(item => {
                    if (!ticketSales[item.ticket_name]) {
                      ticketSales[item.ticket_name] = { quantity: 0, revenue: 0 };
                    }
                    ticketSales[item.ticket_name].quantity += item.quantity;
                    ticketSales[item.ticket_name].revenue += item.total;
                  });
                });

                const sorted = Object.entries(ticketSales)
                  .sort(([,a], [,b]) => b.revenue - a.revenue)
                  .slice(0, 5);

                if (sorted.length === 0) {
                  // Show tickets from inventory if no sales
                  if (tickets.length > 0) {
                    return tickets.slice(0, 5).map((ticket) => (
                      <div key={ticket.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{ticket.name}</span>
                          <div className="text-left">
                            <span className="font-bold text-muted-foreground">₪0.00</span>
                            <span className="text-sm text-muted-foreground mr-2">(0 יח')</span>
                          </div>
                        </div>
                        <div className="h-2 bg-accent rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: '0%' }} />
                        </div>
                      </div>
                    ));
                  }
                  return (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">אין מכירות עדיין</p>
                      <p className="text-sm text-muted-foreground">המידע יעודכן לאחר מכירות</p>
                    </div>
                  );
                }

                const maxRevenue = sorted[0]?.[1]?.revenue || 1;

                return sorted.map(([name, data], index) => (
                  <div key={name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{name}</span>
                      <div className="text-left">
                        <span className="font-bold text-primary">
                          ₪{data.revenue.toFixed(2)}
                        </span>
                        <span className="text-sm text-muted-foreground mr-2">
                          ({data.quantity} יח')
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-accent rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{ width: `${(data.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">עסקאות אחרונות</CardTitle>
          <Link to={createPageUrl("SalesHistory")}>
            <Button variant="ghost" size="sm">
              הצג הכל
              <ArrowLeft className="h-4 w-4 mr-2" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <RecentSalesTable 
            sales={sales.slice(0, 10)} 
            onView={handleViewSale}
            onEdit={handleEditSale}
            onDelete={handleDeleteSale}
            isOwner={isOwner}
          />
        </CardContent>
      </Card>
    </div>
  );
}