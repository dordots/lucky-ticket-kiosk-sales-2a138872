import React, { useState, useEffect } from "react";
import { auth, Sale, TicketType, AuditLog } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useKiosk } from "@/contexts/KioskContext";
import * as ticketTypesService from "@/firebase/services/ticketTypes";
import { 
  ArrowRight, 
  XCircle,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CancelSale() {
  const [user, setUser] = useState(null);
  
  const urlParams = new URLSearchParams(window.location.search);
  const saleId = urlParams.get('id');
  const queryClient = useQueryClient();
  const { currentKiosk } = useKiosk();

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
    queryKey: ['sale-cancel', saleId],
    queryFn: async () => {
      if (!saleId) {
        console.log('CancelSale: No saleId provided');
        return null;
      }
      console.log('CancelSale: Fetching sale with ID:', saleId, 'Type:', typeof saleId);
      
      // Try using getSaleById directly from service (searches by document ID)
      try {
        const { getSaleById } = await import('@/firebase/services/sales');
        const result = await getSaleById(saleId);
        console.log('CancelSale: Sale fetched via getSaleById (doc ID):', result ? 'Found' : 'Not found');
        if (result) {
          console.log('CancelSale: Sale data:', { id: result.id, status: result.status, kiosk_id: result.kiosk_id });
          return result;
        }
        
        // If not found by doc ID, try searching in all sales (maybe ID is stored differently)
        console.log('CancelSale: Not found by doc ID, trying to search in all sales...');
        const { getSalesByKiosk } = await import('@/firebase/services/sales');
        const allSales = currentKiosk?.id 
          ? await getSalesByKiosk(currentKiosk.id, 1000)
          : await Sale.list();
        console.log('CancelSale: Total sales in list:', allSales.length);
        const found = allSales.find(s => s.id === saleId);
        console.log('CancelSale: Found in list:', found ? 'Yes' : 'No');
        if (found) {
          console.log('CancelSale: Found sale:', { id: found.id, status: found.status });
        }
        return found || null;
      } catch (error) {
        console.error('CancelSale: Error fetching sale:', error);
        throw error;
      }
    },
    enabled: !!saleId,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      // Create audit log before cancelling
      await AuditLog.create({
        action: "cancel_sale",
        actor_id: user?.id,
        actor_name: user?.full_name || user?.email,
        target_id: saleId,
        target_type: "Sale",
        details: sale,
        kiosk_id: sale?.kiosk_id || currentKiosk?.id,
      });

      // Restore inventory (add back to quantity_counter)
      if (sale?.items && currentKiosk?.id) {
        for (const item of sale.items) {
          try {
            const ticket = await ticketTypesService.getTicketTypeById(item.ticket_type_id, currentKiosk.id);
            if (ticket) {
              const currentQuantityCounter = ticket.quantity_counter ?? 0;
              const currentQuantityVault = ticket.quantity_vault ?? 0;
              
              await TicketType.update(item.ticket_type_id, {
                quantity_counter: currentQuantityCounter + item.quantity,
                quantity_vault: currentQuantityVault,
              }, currentKiosk.id);
            }
          } catch (error) {
            console.error(`Error restoring inventory for ticket ${item.ticket_type_id}:`, error);
          }
        }
      }

      // Update sale status to cancelled
      await Sale.update(saleId, {
        status: "cancelled",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
      queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
      window.location.href = createPageUrl("SalesHistory");
    },
    onError: (error) => {
      console.error("Error cancelling sale:", error);
    },
  });

  const handleCancel = () => {
    cancelMutation.mutate();
  };

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
        <Link to={createPageUrl("SalesHistory")}>
          <Button>חזרה להיסטוריית מכירות</Button>
        </Link>
      </div>
    );
  }

  if (sale.status === 'cancelled') {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-foreground mb-2">העסקה כבר בוטלה</h2>
        <Link to={createPageUrl(`SaleDetails?id=${saleId}`)}>
          <Button>חזרה לפרטי העסקה</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={createPageUrl(`SaleDetails?id=${saleId}`)}>
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-amber-600">ביטול עסקה</h1>
          <p className="text-muted-foreground">העסקה תועבר לסטטוס "בוטל" והמלאי יוחזר</p>
        </div>
      </div>

      <Card className="border-amber-200">
        <CardHeader className="bg-amber-50">
          <CardTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            ביטול עסקה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Sale Summary */}
          <div className="p-4 bg-accent rounded-lg space-y-2">
            <p className="text-sm"><strong>תאריך:</strong> {format(new Date(sale.created_date), "dd/MM/yyyy HH:mm", { locale: he })}</p>
            <p className="text-sm"><strong>מוכר:</strong> {sale.seller_name}</p>
            <p className="text-sm"><strong>סכום:</strong> ₪{sale.total_amount?.toFixed(2)}</p>
            <p className="text-sm"><strong>פריטים:</strong></p>
            <ul className="text-sm mr-4 list-disc">
              {sale.items?.map((item, i) => (
                <li key={i}>{item.quantity}× {item.ticket_name} (₪{item.total?.toFixed(2)})</li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <Link to={createPageUrl(`SaleDetails?id=${saleId}`)} className="flex-1">
              <Button variant="outline" className="w-full">ביטול</Button>
            </Link>
            <Button 
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="flex-1 bg-amber-600 hover:bg-amber-700"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="h-4 w-4 ml-2" />
                  בטל עסקה
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
