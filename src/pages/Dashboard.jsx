import React, { useState, useEffect } from "react";
import { auth, Sale, TicketType, User } from "@/api/entities";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, startOfDay, endOfDay, startOfMonth } from "date-fns";
import { he } from "date-fns/locale";
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
    queryKey: ['sales-all'],
    queryFn: () => Sale.list('-created_date', 100),
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets-all'],
    queryFn: () => TicketType.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => User.list(),
  });

  // Calculate stats
  const today = new Date();
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

  const lowStockCount = tickets.filter(t => t.quantity <= t.min_threshold && t.is_active).length;
  const activeUsers = users.filter(u => u.is_active !== false).length;

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

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">לוח בקרה</h1>
          <p className="text-slate-500">
            {format(today, "EEEE, d בMMMM yyyy", { locale: he })}
          </p>
        </div>
        <Link to={createPageUrl("SellerPOS")}>
          <Button className="bg-gradient-to-r from-indigo-500 to-purple-600">
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
          <CardHeader>
            <CardTitle className="text-lg">מכירות השבוע</CardTitle>
          </CardHeader>
          <CardContent>
            <SalesChart sales={sales} />
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
                          <span className="font-medium text-slate-700">{ticket.name}</span>
                          <div className="text-left">
                            <span className="font-bold text-slate-400">₪0.00</span>
                            <span className="text-sm text-slate-400 mr-2">(0 יח')</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-200 rounded-full" style={{ width: '0%' }} />
                        </div>
                      </div>
                    ));
                  }
                  return (
                    <div className="text-center py-8">
                      <p className="text-slate-500">אין מכירות עדיין</p>
                      <p className="text-sm text-slate-400">המידע יעודכן לאחר מכירות</p>
                    </div>
                  );
                }

                const maxRevenue = sorted[0]?.[1]?.revenue || 1;

                return sorted.map(([name, data], index) => (
                  <div key={name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700">{name}</span>
                      <div className="text-left">
                        <span className="font-bold text-indigo-600">
                          ₪{data.revenue.toFixed(2)}
                        </span>
                        <span className="text-sm text-slate-500 mr-2">
                          ({data.quantity} יח')
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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