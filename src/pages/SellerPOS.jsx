import React, { useState, useEffect } from "react";
import { auth, Sale, TicketType, Notification, AuditLog } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ShoppingCart, 
  Search,
  Check
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
  const [cartItems, setCartItems] = useState({});
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
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
    queryKey: ['tickets-active'],
    queryFn: () => TicketType.filter({ is_active: true }),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => Notification.filter({ is_read: false }),
  });

  const filteredTickets = tickets.filter(t => 
    t.name.includes(searchTerm) || t.code?.includes(searchTerm)
  );

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
      const sale = await Sale.create({
        seller_id: user?.id,
        seller_name: user?.full_name || user?.email,
        items,
        total_amount: calculateTotal(),
        payment_method: paymentMethod,
        notes,
        status: "completed",
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-slate-800">כרטיסי מזל</h1>
                <p className="text-xs text-slate-500">מכירה מהירה</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Tickets Section */}
        <div className="flex-1 p-4 lg:p-6 lg:pl-0">
          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="חיפוש כרטיס..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 bg-white"
              />
            </div>
          </div>

          {/* Ticket Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                  <div className="h-20 bg-slate-200 rounded-xl mb-3" />
                  <div className="h-4 bg-slate-200 rounded mb-2" />
                  <div className="h-6 bg-slate-200 rounded w-1/2" />
                </div>
              ))}
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
        <div className="hidden lg:block w-96 bg-white border-r border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800">עגלת קניות</h2>
            {getItemsCount() > 0 && (
              <Badge variant="secondary" className="text-indigo-600 bg-indigo-50">
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
              className="w-full h-14 text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg"
            >
              <Check className="h-5 w-5 ml-2" />
              אשר מכירה - ₪{calculateTotal().toFixed(2)}
            </Button>
          )}
        </div>

        {/* Cart Section - Mobile */}
        {getItemsCount() > 0 && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-lg">
            <Button
              onClick={() => setPaymentOpen(true)}
              className="w-full h-14 text-lg bg-gradient-to-r from-indigo-500 to-purple-600"
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