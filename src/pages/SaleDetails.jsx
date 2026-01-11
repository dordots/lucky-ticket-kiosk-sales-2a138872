import React, { useState, useEffect } from "react";
import { auth, Sale, AuditLog } from "@/api/entities";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { 
  ArrowRight, 
  CreditCard, 
  Banknote, 
  Wallet,
  User,
  Calendar,
  FileText,
  Edit,
  Trash2,
  XCircle,
  History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const paymentLabels = {
  cash: { label: "מזומן", icon: Banknote },
  card: { label: "כרטיס אשראי", icon: CreditCard },
  other: { label: "אחר", icon: Wallet },
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

export default function SaleDetails() {
  const [user, setUser] = useState(null);
  
  const urlParams = new URLSearchParams(window.location.search);
  const saleId = urlParams.get('id');

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

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale', saleId],
    queryFn: async () => {
      if (!saleId) return null;
      return await Sale.get(saleId);
    },
    enabled: !!saleId,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs', saleId],
    queryFn: () => AuditLog.filter({ target_id: saleId }),
    enabled: !!saleId,
  });

  const isOwner = user?.position === 'owner' || user?.role === 'admin';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-foreground mb-2">העסקה לא נמצאה</h2>
        <p className="text-muted-foreground mb-4">העסקה המבוקשת אינה קיימת במערכת</p>
        <Link to={createPageUrl("SalesHistory")}>
          <Button>חזרה להיסטוריית מכירות</Button>
        </Link>
      </div>
    );
  }

  const PaymentIcon = paymentLabels[sale.payment_method]?.icon || Wallet;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("SalesHistory")}>
            <Button variant="ghost" size="icon">
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">פרטי עסקה</h1>
            <p className="text-muted-foreground text-sm">מזהה: {sale.id?.slice(0, 8)}...</p>
          </div>
        </div>
        {isOwner && sale.status === 'completed' && (
          <div className="flex gap-2">
            <Link to={createPageUrl(`EditSale?id=${sale.id}`)}>
              <Button variant="outline">
                <Edit className="h-4 w-4 ml-2" />
                עריכה
              </Button>
            </Link>
            <Link to={createPageUrl(`CancelSale?id=${sale.id}`)}>
              <Button variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50">
                <XCircle className="h-4 w-4 ml-2" />
                ביטול
              </Button>
            </Link>
            <Link to={createPageUrl(`DeleteSale?id=${sale.id}`)}>
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                <Trash2 className="h-4 w-4 ml-2" />
                מחיקה
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>פרטי העסקה</span>
              <Badge className={statusColors[sale.status]}>
                {statusLabels[sale.status]}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-accent rounded-lg">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">תאריך ושעה</p>
                  <p className="font-medium">
                    {format(new Date(sale.created_date), "dd/MM/yyyy HH:mm", { locale: he })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-accent rounded-lg">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">מוכר</p>
                  <p className="font-medium">{sale.seller_name || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-accent rounded-lg">
                <PaymentIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">אמצעי תשלום</p>
                  <p className="font-medium">
                    {paymentLabels[sale.payment_method]?.label || "מזומן"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg">
                <FileText className="h-5 w-5 text-indigo-500" />
                <div>
                  <p className="text-xs text-indigo-500">סכום כולל</p>
                  <p className="font-bold text-indigo-600 text-lg">
                    ₪{sale.total_amount?.toFixed(2) || "0.00"}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold text-foreground mb-4">פריטים בעסקה</h3>
              <div className="space-y-3">
                {sale.items?.length > 0 ? sale.items.map((item, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-4 bg-accent rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-foreground">{item.ticket_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} × ₪{item.unit_price?.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-bold text-indigo-600">
                      ₪{item.total?.toFixed(2) || (item.quantity * item.unit_price).toFixed(2)}
                    </p>
                  </div>
                )) : (
                  <p className="text-muted-foreground text-center py-4">אין פריטים להצגה</p>
                )}
              </div>
            </div>

            {sale.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold text-foreground mb-2">הערות</h3>
                  <p className="text-foreground bg-accent p-3 rounded-lg">{sale.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              היסטוריית שינויים
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length > 0 ? (
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="border-r-2 border-indigo-200 pr-4 pb-4">
                    <p className="text-sm font-medium text-foreground">
                      {log.action === 'create_sale' ? 'יצירת עסקה' :
                       log.action === 'edit_sale' ? 'עריכת עסקה' :
                       log.action === 'delete_sale' ? 'מחיקת עסקה' : log.action}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.actor_name} • {format(new Date(log.created_date), "dd/MM/yyyy HH:mm")}
                    </p>
                    {log.reason && (
                      <p className="text-sm text-foreground mt-1 bg-accent p-2 rounded">
                        סיבה: {log.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">אין היסטוריית שינויים</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}