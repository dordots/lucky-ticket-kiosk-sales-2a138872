import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { auth, Sale, TicketType, AuditLog } from "@/api/entities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useKiosk } from "@/contexts/KioskContext";
import * as ticketTypesService from "@/firebase/services/ticketTypes";
import { 
  ShoppingCart, 
  Search,
  Check,
  Package,
  ChevronUp,
  ChevronDown,
  Plus,
  Minus,
  Trash2,
  AlertTriangle
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SellerPOS() {
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [priceFilter, setPriceFilter] = useState("all"); // all, 5-25, 30-50, 50-100
  const [cartItems, setCartItems] = useState({});
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cartExpanded, setCartExpanded] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saleCompleted, setSaleCompleted] = useState(false);
  const [lowStockAlert, setLowStockAlert] = useState(null);
  const { currentKiosk, isLoading: kioskLoading } = useKiosk();
  const navigate = useNavigate();
  
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
          is_active: true
        }, currentKiosk.id);
        console.log('SellerPOS: Loaded tickets:', result.length, 'for kiosk:', currentKiosk.id);
        return result;
      } catch (error) {
        console.error('SellerPOS: Error loading tickets:', error);
        return [];
      }
    },
    enabled: !kioskLoading && !!currentKiosk?.id,
  });


  // Load sales to calculate demand (total sales count per ticket)
  const { data: allSales = [] } = useQuery({
    queryKey: ['sales-for-demand', currentKiosk?.id],
    queryFn: async () => {
      if (!currentKiosk?.id) return [];
      try {
        const { getSalesByKiosk } = await import('@/firebase/services/sales');
        return await getSalesByKiosk(currentKiosk.id);
      } catch (error) {
        console.error('Error loading sales for demand calculation:', error);
        return [];
      }
    },
    enabled: !kioskLoading && !!currentKiosk?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes - sales data doesn't change frequently
  });

  // Calculate sales count per ticket (demand)
  const ticketSalesCount = useMemo(() => {
    const counts = {};
    allSales
      .filter(sale => sale.status === 'completed') // Only count completed sales
      .forEach(sale => {
        sale.items?.forEach(item => {
          const ticketId = item.ticket_type_id;
          if (ticketId) {
            counts[ticketId] = (counts[ticketId] || 0) + (item.quantity || 0);
          }
        });
      });
    return counts;
  }, [allSales]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
    // Only show tickets that are available for sale:
    // - quantity_counter > 0 (has stock on counter)
    // - is_active === true (ticket type is active)
    const quantityCounter = t.quantity_counter ?? 0;
    
    if (quantityCounter <= 0 || !t.is_active) {
      return false;
    }
    
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
  }, [tickets, searchTerm, priceFilter]);

  // Sort tickets by demand (sales count) - highest first
  const sortedTickets = useMemo(() => {
    return [...filteredTickets].sort((a, b) => {
      const salesA = ticketSalesCount[a.id] || 0;
      const salesB = ticketSalesCount[b.id] || 0;
      return salesB - salesA; // Descending order (highest demand first)
    });
  }, [filteredTickets, ticketSalesCount]);

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

  const calculateTotal = useMemo(() => {
    return Object.values(cartItems).reduce(
      (sum, item) => sum + (item.quantity * item.unitPrice), 
      0
    );
  }, [cartItems]);

  const getItemsCount = useMemo(() => {
    return Object.values(cartItems).reduce((sum, item) => sum + item.quantity, 0);
  }, [cartItems]);

  const handleConfirmSale = async (paymentMethod, notes) => {
    // Save values before clearing cart
    const saleTotal = calculateTotal;
    const currentCartItems = { ...cartItems };
    
    // Prepare sale items
    const items = Object.entries(currentCartItems).map(([ticketId, item]) => ({
      ticket_type_id: ticketId,
      ticket_name: item.ticketName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));

    if (!currentKiosk?.id) {
      throw new Error('לא ניתן ליצור מכירה ללא קיוסק נבחר');
    }

    // Validate stock before proceeding (throw errors immediately if validation fails)
    let stockValidation;
    try {
      stockValidation = Object.entries(currentCartItems).map(([ticketId, item]) => {
        const ticket = tickets.find(t => t.id === ticketId);
        if (!ticket) {
          throw new Error(`כרטיס ${item.ticketName} לא נמצא`);
        }
        const currentQuantityCounter = ticket.quantity_counter ?? 0;
        if (currentQuantityCounter < item.quantity) {
          throw new Error(`לא מספיק מלאי עבור ${ticket.name}. זמין: ${currentQuantityCounter}, נדרש: ${item.quantity}`);
        }
        return { ticketId, ticket, item, currentQuantityCounter };
      });
    } catch (validationError) {
      // If validation fails, don't proceed with optimistic update
      setIsProcessing(false);
      throw validationError;
    }

    // Save current state for rollback
    const previousState = {
      cartItems: currentCartItems,
      tickets: tickets.map(t => ({
        id: t.id,
        quantity_counter: t.quantity_counter ?? 0,
        quantity_vault: t.quantity_vault ?? 0,
      })),
    };

    // OPTIMISTIC UPDATE: Update UI immediately
    // Update local tickets state optimistically
    const optimisticTickets = tickets.map(t => {
      const cartItem = currentCartItems[t.id];
      if (cartItem) {
        return {
          ...t,
          quantity_counter: (t.quantity_counter ?? 0) - cartItem.quantity,
        };
      }
      return t;
    });

    // Update React Query cache optimistically
    queryClient.setQueryData(['tickets-active', currentKiosk.id], optimisticTickets);
    
    // Clear cart immediately
    setCartItems({});
    setIsProcessing(false);
    setSaleCompleted(true);

    // Process sale in background (non-blocking)
    (async () => {
      try {
        // Create sale
        const sale = await Sale.create({
          seller_id: user?.id,
          seller_name: user?.full_name || user?.email,
          items,
          total_amount: saleTotal,
          payment_method: paymentMethod,
          notes,
          status: "completed",
          kiosk_id: currentKiosk.id,
        });

        // Update inventory in parallel for all tickets
        const inventoryUpdates = stockValidation.map(({ ticketId, ticket, item, currentQuantityCounter }) => {
          const newQuantityCounter = currentQuantityCounter - item.quantity;
          const currentQuantityVault = ticket.quantity_vault ?? 0;
          
          return TicketType.update(ticketId, {
            quantity_counter: newQuantityCounter,
            quantity_vault: currentQuantityVault,
          }, currentKiosk.id);
        });


        // Execute all operations in parallel
        await Promise.all([
          ...inventoryUpdates,
          // Create audit log (non-blocking)
          AuditLog.create({
            action: "create_sale",
            actor_id: user?.id,
            actor_name: user?.full_name || user?.email,
            target_id: sale.id,
            target_type: "Sale",
            details: { items, total: saleTotal, payment_method: paymentMethod },
            kiosk_id: currentKiosk?.id,
          }).catch(auditError => {
            console.error("Error creating audit log:", auditError);
          }),
        ]);

        // Check for low stock or out of stock after sale
        const lowStockTickets = [];
        for (const { ticket, item, currentQuantityCounter } of stockValidation) {
          const newQuantityCounter = currentQuantityCounter - item.quantity;
          const threshold = ticket.min_threshold || 10;
          
          if (newQuantityCounter === 0) {
            lowStockTickets.push({
              name: ticket.name,
              quantity: newQuantityCounter,
              threshold: threshold,
              type: 'out_of_stock'
            });
          } else if (newQuantityCounter <= threshold) {
            lowStockTickets.push({
              name: ticket.name,
              quantity: newQuantityCounter,
              threshold: threshold,
              type: 'low_stock'
            });
          }
        }

        if (lowStockTickets.length > 0) {
          setLowStockAlert(lowStockTickets);
        } else {
          // If no low stock alert, reset filter immediately after successful sale
          setPriceFilter("all");
        }

        // Refresh data in background
        queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
        queryClient.invalidateQueries({ queryKey: ['tickets-inventory'] });
        queryClient.invalidateQueries({ queryKey: ['tickets-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['sales-for-demand'] });

      } catch (error) {
        console.error("Error processing sale in background:", error);
        
        // ROLLBACK: Restore previous state on error
        setCartItems(previousState.cartItems);
        queryClient.setQueryData(['tickets-active', currentKiosk.id], previousState.tickets);
        queryClient.invalidateQueries({ queryKey: ['tickets-active'] });
        
        // Show error to user (you might want to add a toast here)
        alert(`שגיאה בעיבוד המכירה: ${error.message}`);
        setSaleCompleted(false);
      }
    })();

    return true;
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
              <div>
                <h1 className="text-lg font-bold text-foreground">דף מכירה</h1>
                <p className="text-xs text-muted-foreground">מכירה מהירה</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col lg:flex-row gap-6 ${getItemsCount > 0 ? 'pb-24 lg:pb-0' : ''}`}>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="bg-card rounded-2xl p-4 animate-pulse">
                  <div className="h-20 bg-accent rounded-xl mb-3" />
                  <div className="h-4 bg-accent rounded mb-2" />
                  <div className="h-6 bg-accent rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : sortedTickets.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium text-foreground mb-2">אין כרטיסים זמינים</p>
                <p className="text-sm text-muted-foreground">אין כרטיסים פעילים בקיוסק זה</p>
              </div>
            </div>
          ) : (
            <TicketGrid
              tickets={sortedTickets}
              onSelect={handleTicketSelect}
              selectedItems={cartItems}
            />
          )}
        </div>

        {/* Cart Section - Desktop */}
        <div className="hidden lg:block w-96 bg-card border-r border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">עגלת קניות</h2>
            {getItemsCount > 0 && (
              <Badge variant="secondary" className="text-primary bg-primary/10">
                {getItemsCount} פריטים
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
              total={calculateTotal}
            />
          </div>

          {/* Confirm Button */}
          {getItemsCount > 0 && (
            <Button
              onClick={() => setPaymentOpen(true)}
              className="w-full h-14 text-lg bg-theme-gradient hover:opacity-90 shadow-lg transition-opacity"
            >
              <Check className="h-5 w-5 ml-2" />
              אשר מכירה - ₪{calculateTotal.toFixed(2)}
            </Button>
          )}
        </div>

        {/* Cart Section - Mobile */}
        {getItemsCount > 0 && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-30">
            <Collapsible open={cartExpanded} onOpenChange={setCartExpanded}>
              {/* Cart Details - Expandable */}
              <CollapsibleContent className="overflow-hidden">
                <div className="max-h-[50vh] overflow-y-auto p-4 border-b border-border">
                  <div className="space-y-3">
                    {Object.entries(cartItems).map(([ticketId, item]) => {
                      const ticket = tickets.find(t => t.id === ticketId);
                      if (!ticket) return null;

                      return (
                        <div key={ticketId} className="bg-accent rounded-xl p-3">
                          <div className="flex items-start justify-between mb-2">
                            <button
                              onClick={() => handleRemoveItem(ticketId)}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <div className="text-right flex-1 mr-2">
                              <h4 className="font-medium text-foreground">{ticket.name}</h4>
                              <p className="text-sm text-muted-foreground">₪{item.unitPrice} ליחידה</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="font-bold text-primary">
                              ₪{(item.quantity * item.unitPrice).toFixed(2)}
                            </span>
                            <div className="flex items-center gap-2 bg-background rounded-lg p-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleUpdateQuantity(ticketId, item.quantity + 1)}
                                disabled={item.quantity >= (ticket.quantity_counter ?? 0)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center font-semibold">
                                {item.quantity}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleUpdateQuantity(ticketId, item.quantity - 1)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xl font-bold text-primary">₪{calculateTotal.toFixed(2)}</span>
                      <span className="text-foreground font-medium">סה"כ לתשלום</span>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleClearCart}
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 ml-2" />
                      נקה עגלה
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>

              {/* Expand/Collapse Trigger & Confirm Button */}
              <div className="p-4">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full mb-2 h-10 text-muted-foreground hover:text-foreground"
                  >
                    {cartExpanded ? (
                      <>
                        <ChevronDown className="h-4 w-4 ml-2" />
                        הסתר פרטי עגלה
                      </>
                    ) : (
                      <>
                        <ChevronUp className="h-4 w-4 ml-2" />
                        הצג פרטי עגלה ({getItemsCount} פריטים)
                      </>
                    )}
                  </Button>
                </CollapsibleTrigger>
                <Button
                  onClick={() => setPaymentOpen(true)}
                  className="w-full h-14 text-lg bg-theme-gradient"
                >
                  <Check className="h-5 w-5 ml-2" />
                  אשר מכירה - ₪{calculateTotal.toFixed(2)}
                </Button>
              </div>
            </Collapsible>
          </div>
        )}
      </div>

      {/* Quantity Dialog */}
      <QuantityDialog
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        ticket={selectedTicket}
        currentQty={1}
        existingQtyInCart={selectedTicket ? (cartItems[selectedTicket.id]?.quantity || 0) : 0}
        onConfirm={handleAddToCart}
      />

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentOpen}
        onClose={() => {
          setPaymentOpen(false);
          setCartExpanded(false);
          // Don't reset saleCompleted here - let it be reset after low stock alert is closed
        }}
        onConfirm={handleConfirmSale}
        total={calculateTotal}
        itemsCount={getItemsCount}
        isProcessing={isProcessing}
      />

      {/* Low Stock Alert Dialog */}
      <AlertDialog open={!!lowStockAlert} onOpenChange={(open) => {
        if (!open) {
          setLowStockAlert(null);
          setSaleCompleted(false); // Reset sale completed state to return to ticket grid
          setPriceFilter("all"); // Reset price filter to show all tickets
        }
      }}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              התראת מלאי
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              {lowStockAlert?.map((ticket, index) => (
                <div key={index} className={`p-3 rounded-lg ${
                  ticket.type === 'out_of_stock' 
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{ticket.name}</span>
                    <span className={`text-sm font-bold ${
                      ticket.type === 'out_of_stock' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {ticket.type === 'out_of_stock' ? 'אזל מהמלאי!' : 'מלאי נמוך'}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1">
                    {ticket.type === 'out_of_stock' 
                      ? 'המלאי בדלפק אזל לחלוטין' 
                      : `המלאי בדלפק: ${ticket.quantity} יחידות (סף: ${ticket.threshold})`}
                  </p>
                </div>
              ))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setLowStockAlert(null);
              setSaleCompleted(false); // Reset sale completed state to return to ticket grid
              setPriceFilter("all"); // Reset price filter to show all tickets
            }}>
              הבנתי
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}