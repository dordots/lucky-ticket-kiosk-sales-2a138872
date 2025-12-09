import React, { useState, useEffect } from "react";
import { auth, Sale } from "@/api/entities";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useKiosk } from "@/contexts/KioskContext";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { he } from "date-fns/locale";
import * as salesService from "@/firebase/services/sales";
import { 
  Search, 
  Filter, 
  Calendar,
  Download,
  Eye,
  CreditCard,
  Banknote,
  Wallet,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

const paymentIcons = {
  cash: Banknote,
  card: CreditCard,
};

const statusColors = {
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-amber-100 text-amber-700",
};

const statusLabels = {
  completed: "הושלם",
  cancelled: "בוטל",
  refunded: "זוכה",
};

export default function SalesHistory() {
  const [user, setUser] = useState(null);
  const hasPermission = (perm) => {
    if (!user) return false;
    if (user.role !== 'assistant') return true;
    if (!perm) return true;
    return Array.isArray(user.permissions) ? user.permissions.includes(perm) : false;
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [selectedSale, setSelectedSale] = useState(null);
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

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales-history', currentKiosk?.id],
    queryFn: () => {
      if (currentKiosk?.id) {
        return salesService.getSalesByKiosk(currentKiosk.id, 500);
      } else if (user?.role === 'system_manager') {
        return salesService.getAllSales(500);
      }
      return [];
    },
    enabled: !kioskLoading && (!!currentKiosk || user?.role === 'system_manager'),
  });

  // Permission guard for assistants
  if (user && user.role === 'assistant' && !hasPermission('sales_history_view')) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">אין לך הרשאה לצפות בהיסטוריית המכירות</p>
      </div>
    );
  }

  // Filter sales based on user role and filters
  const isOwner = user?.position === 'owner' || user?.role === 'admin';
  
  const filteredSales = sales.filter(sale => {
    // Role-based filtering: sellers only see their own sales
    // If user is admin/owner - show all, otherwise filter by seller
    if (!isOwner && user?.id && sale.seller_id !== user?.id && sale.seller_id !== 'demo') {
      return false;
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSeller = sale.seller_name?.toLowerCase().includes(searchLower);
      const matchesItems = sale.items?.some(item => 
        item.ticket_name?.toLowerCase().includes(searchLower)
      );
      if (!matchesSeller && !matchesItems) return false;
    }

    // Status filter
    if (statusFilter !== "all" && sale.status !== statusFilter) {
      return false;
    }

    // Payment method filter
    if (paymentFilter !== "all" && sale.payment_method !== paymentFilter) {
      return false;
    }

    // Date range filter
    const saleDate = new Date(sale.created_date);
    if (dateRange.from && saleDate < startOfDay(dateRange.from)) return false;
    if (dateRange.to && saleDate > endOfDay(dateRange.to)) return false;

    return true;
  });

  const totalRevenue = filteredSales
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + (s.total_amount || 0), 0);

  const totalItems = filteredSales
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + (s.items?.reduce((is, i) => is + i.quantity, 0) || 0), 0);

  const handleExportCSV = () => {
    const headers = ["תאריך", "שעה", "מוכר", "פריטים", "סכום", "תשלום", "סטטוס"];
    const rows = filteredSales.map(sale => [
      format(new Date(sale.created_date), "dd/MM/yyyy"),
      format(new Date(sale.created_date), "HH:mm"),
      sale.seller_name,
      sale.items?.map(i => `${i.quantity}x${i.ticket_name}`).join("; "),
      sale.total_amount,
      sale.payment_method === 'cash' ? 'מזומן' : 'כרטיס',
      statusLabels[sale.status],
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(","))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">היסטוריית מכירות</h1>
          <p className="text-muted-foreground">
            {isOwner ? 'כל העסקאות במערכת' : 'העסקאות שלך'}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleExportCSV}
          disabled={user?.role === 'assistant' && !hasPermission('sales_history_export')}
        >
          <Download className="h-4 w-4 ml-2" />
          ייצוא CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <p className="text-indigo-100 text-sm">סה"כ עסקאות</p>
            <p className="text-2xl font-bold">{filteredSales.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <CardContent className="p-4">
            <p className="text-emerald-100 text-sm">סה"כ הכנסות</p>
            <p className="text-2xl font-bold">₪{totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white">
          <CardContent className="p-4">
            <p className="text-orange-100 text-sm">כרטיסים נמכרו</p>
            <p className="text-2xl font-bold">{totalItems}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="חיפוש מוכר או כרטיס..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="completed">הושלם</SelectItem>
                <SelectItem value="cancelled">בוטל</SelectItem>
                <SelectItem value="refunded">זוכה</SelectItem>
              </SelectContent>
            </Select>

            {/* Payment Filter */}
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="אמצעי תשלום" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל אמצעי התשלום</SelectItem>
                <SelectItem value="cash">מזומן</SelectItem>
                <SelectItem value="card">כרטיס אשראי</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-right font-normal">
                  <Calendar className="h-4 w-4 ml-2" />
                  {dateRange.from && dateRange.to ? (
                    <span>
                      {format(dateRange.from, "dd/MM")} - {format(dateRange.to, "dd/MM")}
                    </span>
                  ) : (
                    <span>בחר תאריכים</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => range && setDateRange(range)}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-accent">
                  <TableHead className="text-right">תאריך ושעה</TableHead>
                  <TableHead className="text-right">מוכר</TableHead>
                  <TableHead className="text-right">פריטים</TableHead>
                  <TableHead className="text-right">סכום</TableHead>
                  <TableHead className="text-right">תשלום</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">הערות</TableHead>
                  <TableHead className="text-right">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => {
                  const PaymentIcon = paymentIcons[sale.payment_method] || Wallet;
                  
                  return (
                    <TableRow key={sale.id} className="hover:bg-accent">
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {format(new Date(sale.created_date), "dd/MM/yyyy", { locale: he })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(sale.created_date), "HH:mm")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{sale.seller_name || "—"}</TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          {sale.items?.slice(0, 2).map((item, i) => (
                            <p key={i} className="text-sm truncate">
                              {item.quantity}× {item.ticket_name}
                            </p>
                          ))}
                          {sale.items?.length > 2 && (
                            <p className="text-xs text-muted-foreground">
                              +{sale.items.length - 2} נוספים
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-indigo-600">
                        ₪{sale.total_amount?.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PaymentIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {sale.payment_method === 'cash' ? 'מזומן' : 'כרטיס'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[sale.status]}>
                          {statusLabels[sale.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sale.notes ? (
                          <div className="flex items-center gap-1" title={sale.notes}>
                            <FileText className="h-4 w-4 text-indigo-600" />
                            <span className="text-xs text-slate-500 truncate max-w-[100px]">
                              {sale.notes.length > 20 ? sale.notes.substring(0, 20) + '...' : sale.notes}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setSelectedSale(sale)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {filteredSales.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">לא נמצאו עסקאות</p>
              <p className="text-sm text-muted-foreground mt-1">בצע מכירות כדי לראות את ההיסטוריה כאן</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sale Details Dialog */}
      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>פרטי עסקה</DialogTitle>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">תאריך</p>
                  <p className="font-medium">
                    {format(new Date(selectedSale.created_date), "dd/MM/yyyy HH:mm", { locale: he })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">מוכר</p>
                  <p className="font-medium">{selectedSale.seller_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">אמצעי תשלום</p>
                  <p className="font-medium">
                    {selectedSale.payment_method === 'cash' ? 'מזומן' : 'כרטיס אשראי'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">סטטוס</p>
                  <Badge className={statusColors[selectedSale.status]}>
                    {statusLabels[selectedSale.status]}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-500 mb-2">פריטים</p>
                <div className="bg-accent rounded-lg p-3 space-y-2">
                  {selectedSale.items?.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span>{item.quantity}× {item.ticket_name}</span>
                      <span className="font-medium">₪{item.total?.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2 flex items-center justify-between font-bold">
                    <span>סה"כ</span>
                    <span className="text-indigo-600">₪{selectedSale.total_amount?.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedSale.notes && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-indigo-600" />
                    <p className="text-sm font-medium text-indigo-800">הערות</p>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap">{selectedSale.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}