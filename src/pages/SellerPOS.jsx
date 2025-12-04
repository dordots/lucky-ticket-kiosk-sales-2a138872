import React, { useState, useEffect } from "react";
import { auth, Sale, TicketType, Notification, AuditLog } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useKiosk } from "@/contexts/KioskContext";
import * as ticketTypesService from "@/firebase/services/ticketTypes";
import { 
  ShoppingCart, 
  Search,
  Check,
  Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
// Toast notifications removed
// Toaster removed

import TicketGrid from "@/components/pos/TicketGrid";
import Cart from "@/components/pos/Cart";
import PaymentDialog from "@/components/pos/PaymentDialog";
import QuantityDialog from "@/components/pos/QuantityDialog";

export default function SellerPOS() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [priceFilter, setPriceFilter] = useState("all"); // all, 5-25, 30-50, 50-100
  const [cartItems, setCartItems] = useState({});
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { currentKiosk, isLoading: kioskLoading } = useKiosk();
  
  const queryClient = useQueryClient();

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

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets-active', currentKiosk?.id],
    queryFn: async () => {
      if (!currentKiosk?.id) {
        console.warn('SellerPOS: No currentKiosk available');
        return [];
      }
      try {
        const result = await ticketTypesService.getTicketTypesByFilter({ 
          is_active: true, 
          kiosk_id: currentKiosk.id 
        });
        console.log('SellerPOS: Loaded tickets:', result.length, 'for kiosk:', currentKiosk.id);
        return result;
      } catch (error) {
        console.error('SellerPOS: Error loading tickets:', error);
        return [];
      }
    },
    enabled: !kioskLoading && !!currentKiosk?.id,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => Notification.filter({ is_read: false }),
  });

  const filteredTickets = tickets.filter(t => {
    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      t.name?.toLowerCase().includes(searchLower) || 
      t.code?.toLowerCase().includes(searchLower) ||
      t.nickname?.toLowerCase().includes(searchLower);
    if (!matchesSearch) return false;
    
    // Price filter
    if (priceFilter !== "all") {
      const price = t.price || 0;
      if (priceFilter === "5-25" && (price < 5 || price > 25)) return false;
      if (priceFilter === "30-50" && (price < 30 || price > 50)) return false;
      if (priceFilter === "50-100" && (price < 50 || price > 100)) return false;
    }
    
    return true;
  });

  const handleTicketSelect = (ticket) => {
    setSelectedTicket(ticket);
  };

  const handleAddToCart = (quantity) => {
    if (!selectedTicket) return;
    
    setCartItems(prev => ({
      ...prev,
      [selectedTicket.id]: {
        quantity: (prev[selectedTicket.id]?.quantity || 0) + quantity,
        unitPrice: selectedTicket.price,
        ticketName: selectedTicket.name,
      }
    }));
    
    // Toast notification removed
  };

  const handleUpdateQuantity = (ticketId, newQuantity) => {
    if (newQuantity <= 0) {
      handleRemoveItem(ticketId);
      return;
    }
    
    setCartItems(prev => ({
      ...prev,
      [ticketId]: {
        ...prev[ticketId],
        quantity: newQuantity,
      }
    }));
  };

  const handleRemoveItem = (ticketId) => {
    setCartItems(prev => {
      const newItems = { ...prev };
      delete newItems[ticketId];
      return newItems;
    });
  };

  const handleClearCart = () => {
    setCartItems({});
  };

  const calculateTotal = () => {
    return Object.values(cartItems).reduce(
      (sum, item) => sum + (item.quantity * item.unitPrice), 
      0
    );
  };

  const getItemsCount = () => {
    return Object.values(cartItems).reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleConfirmSale = async (paymentMethod, notes) => {
    setIsProcessing(true);
    
    try {
      // Prepare sale items
      const items = Object.entries(cartItems).map(([ticketId, item]) => ({
        ticket_type_id: ticketId,
        ticket_name: item.ticketName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.quantity * item.unitPrice,
      }));

      // Create sale
      if (!currentKiosk?.id) {
        throw new Error('לא ניתן ליצור מכירה ללא קיוסק נבחר');
      }
      
      const sale = await Sale.create({
        seller_id: user?.id,
        seller_name: user?.full_name || user?.email,
        items,
        total_amount: calculateTotal(),
        payment_method: paymentMethod,
        notes,
        status: "completed",
        kiosk_id: currentKiosk.id,
      });

      // Update inventory for each ticket
      for (const [ticketId, item] of Object.entries(cartItems)) {
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket) {
          const newQuantity = ticket.quantity - item.quantity;
          await TicketType.update(ticketId, {
            quantity: newQuantity,
          });

          // Check for stock notifications (wrap in try-catch to not fail the sale)
          try {
            // Check for out of stock notification (quantity = 0)
            if (newQuantity === 0) {
              const existingOutOfStockNotifs = await Notification.filter({
                ticket_type_id: ticketId,
                is_read: false,
                notification_type: "out_of_stock",
              });
              
              if (existingOutOfStockNotifs.length === 0) {
                await Notification.create({
                  ticket_type_id: ticketId,
                  ticket_name: ticket.name,
                  current_quantity: 0,
                  threshold: ticket.min_threshold,
                  notification_type: "out_of_stock",
                });
                queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
                queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
              }
            }
            // Check for low stock notification (quantity > 0 but <= threshold)
            else if (newQuantity <= ticket.min_threshold && newQuantity > 0) {
              // Check if notification already exists
              const existingLowStockNotifs = await Notification.filter({
                ticket_type_id: ticketId,
                is_read: false,
                notification_type: "low_stock",
              });
              
              if (existingLowStockNotifs.length === 0) {
                await Notification.create({
                  ticket_type_id: ticketId,
                  ticket_name: ticket.name,
                  current_quantity: newQuantity,
                  threshold: ticket.min_threshold,
                  notification_type: "low_stock",
                });
                queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
                queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
              }
            }
          } catch (notificationError) {
            // Log error but don't fail the sale
            console.error("Error creating stock notification:", notificationError);
          }
        }
      }

      // Create audit log (wrap in try-catch to not fail the sale)
      try {
        await AuditLog.create({
          action: "create_sale",
          actor_id: user?.id,
          actor_name: user?.full_name || user?.email,
          target_id: sale.id,
          target_type: "Sale",
          details: { items, total: calculateTotal(), payment_method: paymentMethod },
          kiosk_id: currentKiosk?.id,
        });
      } catch (auditError) {
        // Log error but don't fail the sale
        console.error("Error creating audit log:", auditError);
      }

      // Clear cart and refresh data
      setCartItems({});
      queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-all'] });
      
      setIsProcessing(false);
      return true;
    } catch (error) {
      console.error("Error creating sale:", error);
      console.error("Error creating sale:", error);
      setIsProcessing(false);
      return false;
    }
  };

  const isOwner = user?.position === 'owner' || user?.role === 'admin';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      
      {/* Header */}
      <header className="bg-background border-b border-border px-4 py-3 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-theme-gradient flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-foreground">דף מכירה</h1>
                <p className="text-xs text-muted-foreground">מכירה מהירה</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6">
        {/* Tickets Section */}
        <div className="flex-1 p-4 lg:p-6 lg:pl-0">
          {/* Price Filter Tabs */}
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              variant={priceFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setPriceFilter("all")}
              className={priceFilter === "all" ? "bg-primary hover:bg-primary/90" : ""}
            >
              כל הכרטיסים
            </Button>
            <Button
              variant={priceFilter === "5-25" ? "default" : "outline"}
              size="sm"
              onClick={() => setPriceFilter("5-25")}
              className={priceFilter === "5-25" ? "bg-primary hover:bg-primary/90" : ""}
            >
              ₪5-25
            </Button>
            <Button
              variant={priceFilter === "30-50" ? "default" : "outline"}
              size="sm"
              onClick={() => setPriceFilter("30-50")}
              className={priceFilter === "30-50" ? "bg-primary hover:bg-primary/90" : ""}
            >
              ₪30-50
            </Button>
            <Button
              variant={priceFilter === "50-100" ? "default" : "outline"}
              size="sm"
              onClick={() => setPriceFilter("50-100")}
              className={priceFilter === "50-100" ? "bg-primary hover:bg-primary/90" : ""}
            >
              ₪50-100
            </Button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="חיפוש כרטיס..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 bg-background"
              />
            </div>
          </div>

          {/* Ticket Grid */}
          {kioskLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">טוען נתוני קיוסק...</p>
              </div>
            </div>
          ) : !currentKiosk ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium text-foreground mb-2">לא נמצא קיוסק</p>
                <p className="text-sm text-muted-foreground">אנא פנה למנהל המערכת</p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="bg-card rounded-2xl p-4 animate-pulse">
                  <div className="h-20 bg-accent rounded-xl mb-3" />
                  <div className="h-4 bg-accent rounded mb-2" />
                  <div className="h-6 bg-accent rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium text-foreground mb-2">אין כרטיסים זמינים</p>
                <p className="text-sm text-muted-foreground">אין כרטיסים פעילים בקיוסק זה</p>
              </div>
            </div>
          ) : (
            <TicketGrid
              tickets={filteredTickets}
              onSelect={handleTicketSelect}
              selectedItems={cartItems}
            />
          )}
        </div>

        {/* Cart Section - Desktop */}
        <div className="hidden lg:block w-96 bg-card border-r border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">עגלת קניות</h2>
            {getItemsCount() > 0 && (
              <Badge variant="secondary" className="text-primary bg-primary/10">
                {getItemsCount()} פריטים
              </Badge>
            )}
          </div>
          
          <div className="h-[calc(100vh-280px)]">
            <Cart
              items={cartItems}
              tickets={tickets}
              onUpdateQuantity={handleUpdateQuantity}
              onRemove={handleRemoveItem}
              onClear={handleClearCart}
              total={calculateTotal()}
            />
          </div>

          {/* Confirm Button */}
          {getItemsCount() > 0 && (
            <Button
              onClick={() => setPaymentOpen(true)}
              className="w-full h-14 text-lg bg-theme-gradient hover:opacity-90 shadow-lg transition-opacity"
            >
              <Check className="h-5 w-5 ml-2" />
              אשר מכירה - ₪{calculateTotal().toFixed(2)}
            </Button>
          )}
        </div>

        {/* Cart Section - Mobile */}
        {getItemsCount() > 0 && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 shadow-lg">
            <Button
              onClick={() => setPaymentOpen(true)}
              className="w-full h-14 text-lg bg-theme-gradient"
            >
              <ShoppingCart className="h-5 w-5 ml-2" />
              {getItemsCount()} פריטים - ₪{calculateTotal().toFixed(2)}
            </Button>
          </div>
        )}
      </div>

      {/* Quantity Dialog */}
      <QuantityDialog
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        ticket={selectedTicket}
        currentQty={selectedTicket ? (cartItems[selectedTicket.id]?.quantity || 0) : 0}
        onConfirm={handleAddToCart}
      />

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onConfirm={handleConfirmSale}
        total={calculateTotal()}
        itemsCount={getItemsCount()}
        isProcessing={isProcessing}
      />
    </div>
  );
}