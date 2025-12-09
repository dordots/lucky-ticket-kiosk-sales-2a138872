import React, { useState, useEffect } from "react";
import { Sale, TicketType, User } from "@/api/entities";
import { useQuery } from "@tanstack/react-query";
import { useKiosk } from "@/contexts/KioskContext";
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from "date-fns";
import { he } from "date-fns/locale";
import * as salesService from "@/firebase/services/sales";
import * as ticketTypesService from "@/firebase/services/ticketTypes";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Package,
  Download,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

export default function Reports() {
  const [reportPeriod, setReportPeriod] = useState("week");
  const { currentKiosk, isLoading: kioskLoading } = useKiosk();
  const [user, setUser] = useState(null);
  const hasPermission = (perm) => {
    if (!user) return false;
    if (user.role !== 'assistant') return true;
    if (!perm) return true;
    return Array.isArray(user.permissions) ? user.permissions.includes(perm) : false;
  };

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { auth } = await import("@/api/entities");
        const userData = await auth.me();
        setUser(userData);
      } catch (e) {
        console.log("User not logged in");
      }
    };
    loadUser();
  }, []);

  const { data: sales = [] } = useQuery({
    queryKey: ['sales-reports', currentKiosk?.id],
    queryFn: () => {
      if (currentKiosk?.id) {
        return salesService.getSalesByKiosk(currentKiosk.id, 1000);
      } else if (user?.role === 'system_manager') {
        return salesService.getAllSales(1000);
      }
      return [];
    },
    enabled: !kioskLoading && (!!currentKiosk || user?.role === 'system_manager'),
  });

  // Permission guard for assistants
  if (user && user.role === 'assistant' && !hasPermission('reports_view')) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">אין לך הרשאה לצפות בדוחות</p>
      </div>
    );
  }

  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets-reports', currentKiosk?.id],
    queryFn: () => {
      if (currentKiosk?.id) {
        return ticketTypesService.getTicketTypesByKiosk(currentKiosk.id);
      } else if (user?.role === 'system_manager') {
        return ticketTypesService.getAllTicketTypes();
      }
      return [];
    },
    enabled: !kioskLoading && (!!currentKiosk || user?.role === 'system_manager'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => User.list(),
  });

  // Calculate date ranges
  const today = new Date();
  const ranges = {
    week: { from: subDays(today, 7), to: today },
    month: { from: startOfMonth(today), to: endOfMonth(today) },
    quarter: { from: subMonths(today, 3), to: today },
  };

  const currentRange = ranges[reportPeriod];

  // Filter sales by period
  const periodSales = sales.filter(sale => {
    const saleDate = new Date(sale.created_date);
    return saleDate >= currentRange.from && saleDate <= currentRange.to && sale.status === 'completed';
  });

  // Daily Revenue Chart Data
  const dailyData = (() => {
    const days = eachDayOfInterval({ start: currentRange.from, end: currentRange.to });
    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const daySales = periodSales.filter(sale => {
        const saleDate = new Date(sale.created_date);
        return saleDate >= dayStart && saleDate <= dayEnd;
      });
      return {
        date: format(day, "dd/MM"),
        revenue: daySales.reduce((sum, s) => sum + (s.total_amount || 0), 0),
        count: daySales.length,
      };
    });
  })();

  // Ticket Type Distribution
  const ticketDistribution = (() => {
    const distribution = {};
    periodSales.forEach(sale => {
      sale.items?.forEach(item => {
        if (!distribution[item.ticket_name]) {
          distribution[item.ticket_name] = { quantity: 0, revenue: 0 };
        }
        distribution[item.ticket_name].quantity += item.quantity;
        distribution[item.ticket_name].revenue += item.total;
      });
    });
    return Object.entries(distribution)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  })();

  // Seller Performance
  const sellerPerformance = (() => {
    const performance = {};
    periodSales.forEach(sale => {
      const seller = sale.seller_name || 'לא ידוע';
      if (!performance[seller]) {
        performance[seller] = { count: 0, revenue: 0, items: 0 };
      }
      performance[seller].count += 1;
      performance[seller].revenue += sale.total_amount || 0;
      performance[seller].items += sale.items?.reduce((s, i) => s + i.quantity, 0) || 0;
    });
    return Object.entries(performance)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  })();

  // Payment Method Distribution
  const paymentDistribution = (() => {
    const labels = { cash: 'מזומן', card: 'כרטיס' };
    const distribution = { cash: 0, card: 0 };
    periodSales.forEach(sale => {
      const method = sale.payment_method || 'cash'; // Default to cash instead of other
      if (distribution.hasOwnProperty(method)) {
        distribution[method] += sale.total_amount || 0;
      }
    });
    return Object.entries(distribution).map(([key, value]) => ({
      name: labels[key],
      value,
    }));
  })();

  // Summary Stats
  const totalRevenue = periodSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const totalSales = periodSales.length;
  const totalItems = periodSales.reduce((sum, s) => 
    sum + (s.items?.reduce((is, i) => is + i.quantity, 0) || 0), 0
  );
  const avgSale = totalSales > 0 ? totalRevenue / totalSales : 0;

  const handleExportReport = () => {
    if (user?.role === 'assistant' && !hasPermission('reports_export')) {
      alert('אין לך הרשאה לייצא דוחות');
      return;
    }
    // Helper function to escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Build CSV content
    const csvRows = [];
    
    // Header section
    csvRows.push('דוח מכירות');
    csvRows.push(`תקופה: ${reportPeriod === 'week' ? 'שבוע' : reportPeriod === 'month' ? 'חודש' : 'רבעון'}`);
    csvRows.push(`תאריכים: ${format(currentRange.from, 'dd/MM/yyyy')} - ${format(currentRange.to, 'dd/MM/yyyy')}`);
    csvRows.push(''); // Empty row
    
    // Summary section
    csvRows.push('סיכום כללי');
    csvRows.push(['מטריקה', 'ערך'].map(escapeCSV).join(','));
    csvRows.push(['סה"כ הכנסות', `₪${totalRevenue.toFixed(2)}`].map(escapeCSV).join(','));
    csvRows.push(['מספר עסקאות', totalSales].map(escapeCSV).join(','));
    csvRows.push(['סה"כ כרטיסים נמכרו', totalItems].map(escapeCSV).join(','));
    csvRows.push(['ממוצע לעסקה', `₪${avgSale.toFixed(2)}`].map(escapeCSV).join(','));
    csvRows.push(''); // Empty row
    
    // Daily data section
    csvRows.push('הכנסות יומיות');
    csvRows.push(['תאריך', 'הכנסות (₪)', 'מספר עסקאות'].map(escapeCSV).join(','));
    dailyData.forEach(day => {
      csvRows.push([
        day.date,
        day.revenue.toFixed(2),
        day.count
      ].map(escapeCSV).join(','));
    });
    csvRows.push(''); // Empty row
    
    // Ticket distribution section
    csvRows.push('מכירות לפי סוג כרטיס');
    csvRows.push(['סוג כרטיס', 'כמות', 'הכנסות (₪)'].map(escapeCSV).join(','));
    ticketDistribution.forEach(ticket => {
      csvRows.push([
        ticket.name,
        ticket.quantity,
        ticket.revenue.toFixed(2)
      ].map(escapeCSV).join(','));
    });
    csvRows.push(''); // Empty row
    
    // Seller performance section
    csvRows.push('ביצועי מוכרים');
    csvRows.push(['מוכר', 'מספר עסקאות', 'הכנסות (₪)', 'כרטיסים נמכרו'].map(escapeCSV).join(','));
    sellerPerformance.forEach(seller => {
      csvRows.push([
        seller.name,
        seller.count,
        seller.revenue.toFixed(2),
        seller.items
      ].map(escapeCSV).join(','));
    });
    
    // Payment distribution section
    csvRows.push(''); // Empty row
    csvRows.push('התפלגות אמצעי תשלום');
    csvRows.push(['אמצעי תשלום', 'הכנסות (₪)'].map(escapeCSV).join(','));
    paymentDistribution.forEach(payment => {
      csvRows.push([
        payment.name,
        payment.value.toFixed(2)
      ].map(escapeCSV).join(','));
    });
    
    // Join all rows and create CSV file
    const csvContent = csvRows.join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${reportPeriod}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card rounded-lg shadow-lg p-3 border border-border">
          <p className="text-sm font-medium text-foreground mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm text-foreground">
              <span style={{ color: entry.color }}>●</span> {entry.name}: ₪{entry.value?.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">דוחות וסיכומים</h1>
          <p className="text-muted-foreground">ניתוח מכירות וביצועים</p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={reportPeriod} onValueChange={setReportPeriod}>
            <TabsList>
              <TabsTrigger value="week">שבוע</TabsTrigger>
              <TabsTrigger value="month">חודש</TabsTrigger>
              <TabsTrigger value="quarter">רבעון</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="h-4 w-4 ml-2" />
            ייצוא
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-indigo-200" />
              <span className="text-indigo-100">סה"כ הכנסות</span>
            </div>
            <p className="text-2xl font-bold">₪{totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="h-5 w-5 text-emerald-200" />
              <span className="text-emerald-100">עסקאות</span>
            </div>
            <p className="text-2xl font-bold">{totalSales}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Package className="h-5 w-5 text-orange-200" />
              <span className="text-orange-100">כרטיסים נמכרו</span>
            </div>
            <p className="text-2xl font-bold">{totalItems}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-blue-200" />
              <span className="text-blue-100">ממוצע לעסקה</span>
            </div>
            <p className="text-2xl font-bold">₪{avgSale.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">הכנסות יומיות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `₪${v}`} />
                  <Tooltip 
                    content={<CustomTooltip />}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      color: 'hsl(var(--foreground))'
                    }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="הכנסות" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">התפלגות אמצעי תשלום</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={false}
                  >
                    {paymentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend 
                    formatter={(value) => value}
                    wrapperStyle={{ color: 'hsl(var(--foreground))' }}
                    iconType="circle"
                  />
                  <Tooltip 
                    formatter={(value) => `₪${value.toFixed(2)}`}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      color: 'hsl(var(--foreground))'
                    }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">מכירות לפי סוג כרטיס</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ticketDistribution.length > 0 ? ticketDistribution.slice(0, 6).map((ticket, index) => {
                const maxRevenue = ticketDistribution[0]?.revenue || 1;
                return (
                  <div key={ticket.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{ticket.name}</span>
                      <div className="text-left">
                        <span className="font-bold text-primary">₪{ticket.revenue.toFixed(2)}</span>
                        <span className="text-sm text-muted-foreground mr-2">({ticket.quantity} יח')</span>
                      </div>
                    </div>
                    <div className="h-2 bg-accent rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full"
                        style={{ 
                          width: `${(ticket.revenue / maxRevenue) * 100}%`,
                          backgroundColor: COLORS[index % COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>אין מכירות בתקופה זו</p>
                  <p className="text-sm text-muted-foreground">בצע מכירות כדי לראות נתונים</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Seller Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ביצועי מוכרים</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sellerPerformance.length > 0 ? sellerPerformance.slice(0, 6).map((seller, index) => (
                <div key={seller.name} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-accent rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium`}
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    >
                      {seller.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{seller.name}</p>
                      <p className="text-sm text-muted-foreground">{seller.count} עסקאות</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-indigo-600">₪{seller.revenue.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">{seller.items} כרטיסים</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>אין נתוני מוכרים עדיין</p>
                  <p className="text-sm text-muted-foreground">הנתונים יופיעו לאחר מכירות</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Report */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">דוח מלאי קריטי</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tickets
              .filter(t => t.quantity <= t.min_threshold && t.is_active)
              .map(ticket => (
                <div 
                  key={ticket.id} 
                  className={`p-4 rounded-lg border ${
                    ticket.quantity === 0 
                      ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50' 
                      : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">{ticket.name}</span>
                    <span className={`text-sm font-bold ${
                      ticket.quantity === 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {ticket.quantity === 0 ? 'אזל!' : 'נמוך'}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">
                    במלאי: {ticket.quantity} / סף: {ticket.min_threshold}
                  </p>
                </div>
              ))}
            {tickets.filter(t => t.quantity <= t.min_threshold && t.is_active).length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">
                כל הפריטים במלאי תקין
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}