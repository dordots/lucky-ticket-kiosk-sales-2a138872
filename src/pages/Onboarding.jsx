import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { auth, TicketType, AuditLog } from "@/api/entities";
import { useKiosk } from "@/contexts/KioskContext";
import * as ticketTypesService from "@/firebase/services/ticketTypes";
import * as usersService from "@/firebase/services/users";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle, 
  Package, 
  ArrowRight, 
  ArrowLeft, 
  Loader2,
  AlertCircle,
  Sparkles,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

const STEPS = {
  WELCOME: 1,
  INVENTORY: 2,
  COMMISSION: 3,
  COMPLETE: 4
};

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(STEPS.WELCOME);
  const [user, setUser] = useState(null);
  const [inventoryData, setInventoryData] = useState({});
  const [commissionRate, setCommissionRate] = useState("");
  const [skipCommission, setSkipCommission] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentKiosk, isLoading: kioskLoading } = useKiosk();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await auth.me();
        setUser(userData);
        
        // If user already completed onboarding, redirect to dashboard
        if (userData?.onboarding_completed) {
          navigate('/Dashboard');
        }
      } catch (e) {
        console.log("User not logged in");
        navigate('/Login');
      }
    };
    loadUser();
  }, [navigate]);

  // Load all tickets for the kiosk
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets-onboarding', currentKiosk?.id],
    queryFn: async () => {
      if (!currentKiosk?.id) return [];
      try {
        const result = await ticketTypesService.getTicketTypesByKiosk(currentKiosk.id);
        return result;
      } catch (error) {
        console.error('Error loading tickets:', error);
        return [];
      }
    },
    enabled: !kioskLoading && !!currentKiosk?.id && currentStep === STEPS.INVENTORY,
  });

  // Initialize inventory data when tickets load
  useEffect(() => {
    if (tickets.length > 0 && Object.keys(inventoryData).length === 0) {
      const initialData = {};
      tickets.forEach(ticket => {
        initialData[ticket.id] = {
          quantity_counter: "",
          quantity_vault: "",
          is_opened: false,
        };
      });
      setInventoryData(initialData);
    }
  }, [tickets]);

  const updateInventoryData = (ticketId, field, value) => {
    setInventoryData(prev => ({
      ...prev,
      [ticketId]: {
        ...prev[ticketId],
        [field]: value,
      }
    }));
  };

  const saveInventoryMutation = useMutation({
    mutationFn: async () => {
      if (!currentKiosk?.id) {
        throw new Error('לא ניתן לשמור ללא קיוסק נבחר');
      }

      // Validate at least one ticket has inventory (only what was entered, not 0)
      const hasInventory = Object.values(inventoryData).some(data => {
        const counterStr = data.quantity_counter?.toString().trim() || "";
        const vaultStr = data.quantity_vault?.toString().trim() || "";
        // Only count if field was actually filled (not empty string)
        const counter = counterStr !== "" ? parseInt(counterStr) || 0 : 0;
        const vault = vaultStr !== "" ? parseInt(vaultStr) || 0 : 0;
        return counter > 0 || vault > 0;
      });

      if (!hasInventory) {
        throw new Error('יש להזין מלאי לפחות לכרטיס אחד');
      }

      // Update only tickets that were entered (not empty fields)
      const updates = [];
      for (const [ticketId, data] of Object.entries(inventoryData)) {
        const ticket = tickets.find(t => t.id === ticketId);
        if (!ticket) continue;
        
        // Only process if field was actually filled (not empty string)
        const counterStr = data.quantity_counter?.toString().trim() || "";
        const vaultStr = data.quantity_vault?.toString().trim() || "";
        
        // Skip if both fields are empty
        if (counterStr === "" && vaultStr === "") {
          continue;
        }
        
        // If default_quantity_per_package exists, multiply by it, otherwise use value directly
        const counterInput = counterStr !== "" ? (parseInt(counterStr) || 0) : 0;
        const vaultInput = vaultStr !== "" ? (parseInt(vaultStr) || 0) : 0;
        
        const counter = ticket.default_quantity_per_package 
          ? counterInput * ticket.default_quantity_per_package 
          : counterInput;
        const vault = ticket.default_quantity_per_package 
          ? vaultInput * ticket.default_quantity_per_package 
          : vaultInput;
        const isOpened = data.is_opened;

        // Only update if there's actual inventory (counter or vault > 0)
        if (counter > 0 || vault > 0) {
          updates.push(
            ticketTypesService.updateTicketType(ticketId, {
              quantity_counter: counter,
              quantity_vault: vault,
              is_opened: isOpened && counter > 0,
            }, currentKiosk.id)
          );
        }
      }

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets-onboarding', currentKiosk?.id] });
      queryClient.invalidateQueries({ queryKey: ['tickets-inventory', currentKiosk?.id] });
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('לא ניתן להשלים את התהליך ללא משתמש');
      }

      const updateData = {
        onboarding_completed: true,
        onboarding_completed_date: new Date().toISOString(),
      };

      // Add commission if provided
      if (!skipCommission && commissionRate) {
        const rate = parseFloat(commissionRate);
        if (rate >= 0 && rate <= 100) {
          updateData.commission_rate = rate;
          updateData.commission_set = true;
        }
      } else if (skipCommission) {
        updateData.commission_set = false;
      }

      await usersService.updateUser(user.id, updateData);

      // Count tickets with inventory
      const ticketsWithInventory = Object.values(inventoryData).filter(data => {
        const counter = parseInt(data.quantity_counter) || 0;
        const vault = parseInt(data.quantity_vault) || 0;
        return counter > 0 || vault > 0;
      }).length;

      // Log to audit
      await AuditLog.create({
        action: 'complete_onboarding',
        entity_type: 'user',
        entity_id: user.id,
        entity_name: user.full_name || user.email,
        details: {
          user_id: user.id,
          user_name: user.full_name || user.email,
          user_email: user.email,
          commission_rate: !skipCommission && commissionRate ? parseFloat(commissionRate) : null,
          commission_set: !skipCommission && commissionRate ? true : false,
          tickets_with_inventory: ticketsWithInventory,
          onboarding_completed_date: updateData.onboarding_completed_date,
          message: `השלמת תהליך און-בורדינג${!skipCommission && commissionRate ? ` עם עמלה של ${commissionRate}%` : ''}`
        },
        user_id: user.id,
        user_name: user.full_name || user.email,
      });
    },
    onSuccess: () => {
      // Refresh user data
      auth.me().then(setUser).catch(console.error);
      navigate('/Dashboard');
    },
  });

  const handleNext = async () => {
    if (currentStep === STEPS.INVENTORY) {
      try {
        await saveInventoryMutation.mutateAsync();
        setCurrentStep(STEPS.COMMISSION);
      } catch (error) {
        console.error('Error saving inventory:', error);
        alert(error.message || 'שגיאה בשמירת המלאי');
      }
    } else if (currentStep === STEPS.COMMISSION) {
      setCurrentStep(STEPS.COMPLETE);
    } else if (currentStep === STEPS.WELCOME) {
      setCurrentStep(STEPS.INVENTORY);
    }
  };

  const handleBack = () => {
    if (currentStep === STEPS.INVENTORY) {
      setCurrentStep(STEPS.WELCOME);
    } else if (currentStep === STEPS.COMMISSION) {
      setCurrentStep(STEPS.INVENTORY);
    } else if (currentStep === STEPS.COMPLETE) {
      setCurrentStep(STEPS.COMMISSION);
    }
  };

  const handleComplete = async () => {
    try {
      await completeOnboardingMutation.mutateAsync();
    } catch (error) {
      console.error('Error completing onboarding:', error);
      alert(error.message || 'שגיאה בהשלמת התהליך');
    }
  };

  // Filter and sort tickets for inventory step
  const filteredAndSortedTickets = useMemo(() => {
    if (currentStep !== STEPS.INVENTORY) return [];
    
    // Filter tickets by search term
    const filtered = tickets.filter(ticket => {
      if (!searchTerm.trim()) return true;
      const searchLower = searchTerm.toLowerCase();
      return ticket.name?.toLowerCase().includes(searchLower) ||
             ticket.code?.toLowerCase().includes(searchLower) ||
             ticket.nickname?.toLowerCase().includes(searchLower);
    });

    // Sort: first by price (low to high), then by name (A-Z)
    return filtered.sort((a, b) => {
      const priceA = a.price || 0;
      const priceB = b.price || 0;
      
      // First sort by price
      if (priceA !== priceB) {
        return priceA - priceB;
      }
      
      // If prices are equal, sort by name (A-Z)
      const nameA = a.name?.toLowerCase() || "";
      const nameB = b.name?.toLowerCase() || "";
      return nameA.localeCompare(nameB, 'he');
    });
  }, [tickets, searchTerm, currentStep]);

  const progress = ((currentStep - 1) / (Object.keys(STEPS).length - 1)) * 100;

  if (!user || kioskLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Only show onboarding to franchisees who haven't completed it
  if (user.role !== 'franchisee' || user.onboarding_completed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl"
      >
        <Card className="shadow-2xl border-0">
          <CardHeader className="text-center pb-4">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              ברוכים הבאים למערכת!
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              בואו נתחיל בהגדרה הראשונית של המערכת
            </p>
            <div className="mt-6">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                <span>שלב {currentStep} מתוך {Object.keys(STEPS).length}</span>
                <span>{Math.round(progress)}% הושלם</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {/* Step 1: Welcome */}
              {currentStep === STEPS.WELCOME && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-4">
                    <h2 className="text-2xl font-bold text-foreground">ברוכים הבאים!</h2>
                    <p className="text-muted-foreground text-lg">
                      אנו שמחים לראותכם כאן. לפני שנתחיל, בואו נגדיר כמה דברים בסיסיים.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                    <div className="text-center p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
                      <Package className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                      <h3 className="font-semibold mb-1">הגדרת מלאי</h3>
                      <p className="text-sm text-muted-foreground">
                        נגדיר את המלאי ההתחלתי שלכם
                      </p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                      <h3 className="font-semibold mb-1">הגדרת עמלה</h3>
                      <p className="text-sm text-muted-foreground">
                        נגדיר את גובה העמלה שלכם (אופציונלי)
                      </p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 text-green-600" />
                      <h3 className="font-semibold mb-1">מוכנים להתחיל</h3>
                      <p className="text-sm text-muted-foreground">
                        נתחיל לעבוד עם המערכת
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Inventory Setup */}
              {currentStep === STEPS.INVENTORY && (
                <motion.div
                  key="inventory"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-foreground mb-2">הגדרת מלאי התחלתי</h2>
                    <p className="text-muted-foreground">
                      הזינו את הכמויות ההתחלתיות של כל כרטיס. מה שלא מוזן לא נכנס למלאי.
                    </p>
                  </div>

                  {/* Search Bar */}
                  <div className="mb-4">
                    <div className="relative max-w-md mx-auto">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        placeholder="חיפוש לפי שם, קוד או כינוי..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pr-10"
                      />
                    </div>
                  </div>

                  {ticketsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : tickets.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        לא נמצאו כרטיסים. אנא צרו קשר עם מנהל המערכת.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                      {filteredAndSortedTickets.map((ticket) => {
                        const data = inventoryData[ticket.id] || {
                          quantity_counter: "",
                          quantity_vault: "",
                          is_opened: false,
                        };
                        const counter = parseInt(data.quantity_counter) || 0;
                        const vault = parseInt(data.quantity_vault) || 0;

                        return (
                          <Card key={ticket.id} className="p-4">
                            <div className="flex items-start gap-4">
                              {ticket.image_url && (
                                <img
                                  src={ticket.image_url}
                                  alt={ticket.name}
                                  className="w-16 h-16 object-cover rounded-lg"
                                  loading="lazy"
                                  width="64"
                                  height="64"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              )}
                              <div className="flex-1">
                                <h3 className="font-semibold text-foreground mb-1">
                                  {ticket.name}
                                </h3>
                                <p className="text-sm text-muted-foreground mb-3">
                                  מחיר: ₪{ticket.price}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">
                                      {ticket.default_quantity_per_package ? "מספר חבילות בדלפק" : "כמות בדלפק"}
                                    </Label>
                                    <Input
                                      type="number"
                                      value={data.quantity_counter}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "" || parseInt(val) >= 0) {
                                          updateInventoryData(ticket.id, 'quantity_counter', val);
                                        }
                                      }}
                                      placeholder="0"
                                      min="0"
                                      className="h-9"
                                    />
                                    {ticket.default_quantity_per_package && (
                                      <>
                                        <p className="text-xs text-muted-foreground">
                                          {ticket.default_quantity_per_package} כרטיסים בחבילה
                                        </p>
                                        {data.quantity_counter && parseInt(data.quantity_counter) > 0 && (
                                          <p className="text-xs text-green-600 font-medium">
                                            סה"כ: {parseInt(data.quantity_counter || 0) * ticket.default_quantity_per_package} כרטיסים
                                          </p>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">
                                      {ticket.default_quantity_per_package ? "מספר חבילות בכספת" : "כמות בכספת"}
                                    </Label>
                                    <Input
                                      type="number"
                                      value={data.quantity_vault}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === "" || parseInt(val) >= 0) {
                                          updateInventoryData(ticket.id, 'quantity_vault', val);
                                        }
                                      }}
                                      placeholder="0"
                                      min="0"
                                      className="h-9"
                                    />
                                    {ticket.default_quantity_per_package && (
                                      <>
                                        <p className="text-xs text-muted-foreground">
                                          {ticket.default_quantity_per_package} כרטיסים בחבילה
                                        </p>
                                        {data.quantity_vault && parseInt(data.quantity_vault) > 0 && (
                                          <p className="text-xs text-green-600 font-medium">
                                            סה"כ: {parseInt(data.quantity_vault || 0) * ticket.default_quantity_per_package} כרטיסים
                                          </p>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  {counter > 0 && (
                                    <div className="space-y-1">
                                      <Label className="text-xs">כרטיסים פתוחים</Label>
                                      <div className="flex items-center gap-2 h-9">
                                        <input
                                          type="checkbox"
                                          id={`opened-${ticket.id}`}
                                          checked={data.is_opened}
                                          onChange={(e) => updateInventoryData(ticket.id, 'is_opened', e.target.checked)}
                                          className="h-4 w-4"
                                        />
                                        <Label htmlFor={`opened-${ticket.id}`} className="text-xs cursor-pointer">
                                          הכרטיסים פתוחים
                                        </Label>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {saveInventoryMutation.isError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {saveInventoryMutation.error?.message || 'שגיאה בשמירת המלאי'}
                      </AlertDescription>
                    </Alert>
                  )}
                </motion.div>
              )}

              {/* Step 3: Commission Setup */}
              {currentStep === STEPS.COMMISSION && (
                <motion.div
                  key="commission"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-foreground mb-2">הגדרת עמלה</h2>
                    <p className="text-muted-foreground">
                      הגדירו את גובה העמלה שלכם (באחוזים) כדי לראות את הרווחים האישיים שלכם בדוחות.
                    </p>
                  </div>

                  <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="commission">גובה עמלה (אחוזים)</Label>
                        <Input
                          id="commission"
                          type="number"
                          value={commissionRate}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || (parseFloat(val) >= 0 && parseFloat(val) <= 100)) {
                              setCommissionRate(val);
                              setSkipCommission(false);
                            }
                          }}
                          placeholder="לדוגמה: 15"
                          min="0"
                          max="100"
                          disabled={skipCommission}
                          className="text-lg"
                        />
                        <p className="text-xs text-muted-foreground">
                          אם העמלה שלכם היא 15%, תקבלו 15% מכל מכירה
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          id="skipCommission"
                          checked={skipCommission}
                          onChange={(e) => {
                            setSkipCommission(e.target.checked);
                            if (e.target.checked) {
                              setCommissionRate("");
                            }
                          }}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="skipCommission" className="cursor-pointer">
                          דלג - אגדיר מאוחר יותר
                        </Label>
                      </div>
                    </div>
                  </Card>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      ניתן תמיד לעדכן את העמלה בהגדרות מאוחר יותר.
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}

              {/* Step 4: Complete */}
              {currentStep === STEPS.COMPLETE && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="space-y-6 text-center"
                >
                  <div className="flex items-center justify-center mb-4">
                    <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                      <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    כל הכבוד! ההגדרה הושלמה
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    המערכת מוכנה לשימוש. תוכלו להתחיל למכור כרטיסים ולהשתמש בכל התכונות.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <Package className="h-6 w-6 text-indigo-600" />
                        <div>
                          <p className="font-semibold">מלאי הוגדר</p>
                          <p className="text-sm text-muted-foreground">
                            {Object.values(inventoryData).filter(d => {
                              const c = parseInt(d.quantity_counter) || 0;
                              const v = parseInt(d.quantity_vault) || 0;
                              return c > 0 || v > 0;
                            }).length} כרטיסים במלאי
                          </p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-6 w-6 text-purple-600" />
                        <div>
                          <p className="font-semibold">עמלה</p>
                          <p className="text-sm text-muted-foreground">
                            {skipCommission ? 'לא הוגדרה' : commissionRate ? `${commissionRate}%` : 'לא הוגדרה'}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === STEPS.WELCOME || completeOnboardingMutation.isPending}
                className="flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                קודם
              </Button>

              {currentStep === STEPS.COMPLETE ? (
                <Button
                  onClick={handleComplete}
                  disabled={completeOnboardingMutation.isPending}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 flex items-center gap-2"
                >
                  {completeOnboardingMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      שומר...
                    </>
                  ) : (
                    <>
                      סיים והתחל לעבוד
                      <ArrowLeft className="h-4 w-4" />
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={
                    (currentStep === STEPS.INVENTORY && saveInventoryMutation.isPending) ||
                    (currentStep === STEPS.COMMISSION && !skipCommission && (!commissionRate || parseFloat(commissionRate) < 0 || parseFloat(commissionRate) > 100))
                  }
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 flex items-center gap-2"
                >
                  {saveInventoryMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      שומר...
                    </>
                  ) : (
                    <>
                      הבא
                      <ArrowLeft className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

