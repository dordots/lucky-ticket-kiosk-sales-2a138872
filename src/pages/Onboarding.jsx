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
  SUMMARY: 4,
  COMPLETE: 5
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
          counter_units: "",
          counter_packages: "",
          vault_units: "",
          vault_packages: "",
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
        const counterUnits = data.counter_units?.toString().trim() || "";
        const counterPackages = data.counter_packages?.toString().trim() || "";
        const vaultUnits = data.vault_units?.toString().trim() || "";
        const vaultPackages = data.vault_packages?.toString().trim() || "";
        return counterUnits !== "" || counterPackages !== "" || vaultUnits !== "" || vaultPackages !== "";
      });

      if (!hasInventory) {
        throw new Error('יש להזין מלאי לפחות לכרטיס אחד');
      }

      // Update only tickets that were entered (not empty fields)
      const updates = [];
      for (const [ticketId, data] of Object.entries(inventoryData)) {
        const ticket = tickets.find(t => t.id === ticketId);
        if (!ticket) continue;
        
        // Get values from mutually exclusive fields
        const counterUnitsStr = data.counter_units?.toString().trim() || "";
        const counterPackagesStr = data.counter_packages?.toString().trim() || "";
        const vaultUnitsStr = data.vault_units?.toString().trim() || "";
        const vaultPackagesStr = data.vault_packages?.toString().trim() || "";
        
        // Skip if all fields are empty
        if (counterUnitsStr === "" && counterPackagesStr === "" && vaultUnitsStr === "" && vaultPackagesStr === "") {
          continue;
        }
        
        // Calculate counter quantity (units or packages * default_quantity_per_package)
        let counter = 0;
        if (counterUnitsStr !== "") {
          counter = parseInt(counterUnitsStr) || 0;
        } else if (counterPackagesStr !== "" && ticket.default_quantity_per_package) {
          counter = (parseInt(counterPackagesStr) || 0) * ticket.default_quantity_per_package;
        }
        
        // Calculate vault quantity (units or packages * default_quantity_per_package)
        let vault = 0;
        if (vaultUnitsStr !== "") {
          vault = parseInt(vaultUnitsStr) || 0;
        } else if (vaultPackagesStr !== "" && ticket.default_quantity_per_package) {
          vault = (parseInt(vaultPackagesStr) || 0) * ticket.default_quantity_per_package;
        }
        
        // Only update if there's actual inventory (counter or vault > 0)
        if (counter > 0 || vault > 0) {
          updates.push(
            ticketTypesService.updateTicketType(ticketId, {
              quantity_counter: counter,
              quantity_vault: vault,
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
        const counterUnits = parseInt(data.counter_units) || 0;
        const counterPackages = parseInt(data.counter_packages) || 0;
        const vaultUnits = parseInt(data.vault_units) || 0;
        const vaultPackages = parseInt(data.vault_packages) || 0;
        return counterUnits > 0 || counterPackages > 0 || vaultUnits > 0 || vaultPackages > 0;
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
        setCurrentStep(STEPS.SUMMARY);
      } catch (error) {
        console.error('Error saving inventory:', error);
        alert(error.message || 'שגיאה בשמירת המלאי');
      }
    } else if (currentStep === STEPS.SUMMARY) {
      setCurrentStep(STEPS.COMMISSION);
    } else if (currentStep === STEPS.COMMISSION) {
      setCurrentStep(STEPS.COMPLETE);
    } else if (currentStep === STEPS.WELCOME) {
      setCurrentStep(STEPS.INVENTORY);
    }
  };

  const handleBack = () => {
    if (currentStep === STEPS.INVENTORY) {
      setCurrentStep(STEPS.WELCOME);
    } else if (currentStep === STEPS.SUMMARY) {
      setCurrentStep(STEPS.INVENTORY);
    } else if (currentStep === STEPS.COMMISSION) {
      setCurrentStep(STEPS.SUMMARY);
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

  // Calculate progress based on actual step order: WELCOME -> INVENTORY -> SUMMARY -> COMMISSION -> COMPLETE
  const getProgress = (step) => {
    const stepOrder = [STEPS.WELCOME, STEPS.INVENTORY, STEPS.SUMMARY, STEPS.COMMISSION, STEPS.COMPLETE];
    const stepIndex = stepOrder.indexOf(step);
    return stepIndex >= 0 ? (stepIndex / (stepOrder.length - 1)) * 100 : 0;
  };
  const progress = getProgress(currentStep);

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
              !ברוכים הבאים למערכת
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

                  <div className="grid grid-cols-3 gap-1 sm:gap-4 mt-8">
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
                        נגדיר את גובה העמלה שלכם (לא חובה)
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
                    <div className="grid grid-cols-3 gap-0.5 sm:gap-4 max-h-[500px] overflow-y-auto pr-1 sm:pr-2">
                      {filteredAndSortedTickets.map((ticket) => {
                        const data = inventoryData[ticket.id] || {
                          counter_units: "",
                          counter_packages: "",
                          vault_units: "",
                          vault_packages: "",
                        };

                        return (
                          <Card key={ticket.id} className="p-1 sm:p-3 relative overflow-hidden">
                            {/* Price Badge on Image */}
                            {ticket.image_url && (
                              <div className="relative w-full mb-1">
                                <img
                                  src={ticket.image_url}
                                  alt={ticket.name}
                                  className="w-full h-16 sm:h-24 object-cover rounded"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                                <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[8px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                                  ₪{ticket.price}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex flex-col gap-0.5 sm:gap-1">
                              <h3 className="font-semibold text-foreground text-[9px] sm:text-sm truncate text-center">
                                {ticket.name}
                              </h3>
                              
                              {/* Counter Section - Compact */}
                              <div className="space-y-0.5">
                                <Label className="text-[7px] sm:text-[9px] leading-tight block text-center font-semibold">
                                  דלפק
                                </Label>
                                <div className="grid grid-cols-2 gap-0.5">
                                  <div className="space-y-0">
                                    <Label className="text-[6px] sm:text-[8px] leading-tight block text-center">
                                      יחידות
                                    </Label>
                                    <Input
                                      type="number"
                                      value={data.counter_units}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const numVal = parseInt(val) || 0;
                                        updateInventoryData(ticket.id, 'counter_units', val);
                                        if (numVal > 0) {
                                          updateInventoryData(ticket.id, 'counter_packages', "");
                                        }
                                      }}
                                      placeholder="0"
                                      min="0"
                                      className="h-4 sm:h-6 text-[9px] sm:text-[10px] p-0.5"
                                      disabled={!!data.counter_packages && parseInt(data.counter_packages) > 0}
                                    />
                                  </div>
                                  {ticket.default_quantity_per_package && (
                                    <div className="space-y-0">
                                      <Label className="text-[6px] sm:text-[8px] leading-tight block text-center">
                                       חבילות
                                      </Label>
                                      <Input
                                        type="number"
                                        value={data.counter_packages}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const numVal = parseInt(val) || 0;
                                          updateInventoryData(ticket.id, 'counter_packages', val);
                                          if (numVal > 0) {
                                            updateInventoryData(ticket.id, 'counter_units', "");
                                          }
                                        }}
                                        placeholder="0"
                                        min="0"
                                        className="h-4 sm:h-6 text-[9px] sm:text-[10px] p-0.5"
                                        disabled={!!data.counter_units && parseInt(data.counter_units) > 0}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Vault Section - Compact */}
                              <div className="space-y-0.5">
                                <Label className="text-[7px] sm:text-[9px] leading-tight block text-center font-semibold">
                                  כספת
                                </Label>
                                <div className="grid grid-cols-2 gap-0.5">
                                  <div className="space-y-0">
                                    <Label className="text-[6px] sm:text-[8px] leading-tight block text-center">
                                      יחידות
                                    </Label>
                                    <Input
                                      type="number"
                                      value={data.vault_units}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const numVal = parseInt(val) || 0;
                                        updateInventoryData(ticket.id, 'vault_units', val);
                                        if (numVal > 0) {
                                          updateInventoryData(ticket.id, 'vault_packages', "");
                                        }
                                      }}
                                      placeholder="0"
                                      min="0"
                                      className="h-4 sm:h-6 text-[9px] sm:text-[10px] p-0.5"
                                      disabled={!!data.vault_packages && parseInt(data.vault_packages) > 0}
                                    />
                                  </div>
                                  {ticket.default_quantity_per_package && (
                                    <div className="space-y-0">
                                      <Label className="text-[6px] sm:text-[8px] leading-tight block text-center">
                                        חבילות
                                      </Label>
                                      <Input
                                        type="number"
                                        value={data.vault_packages}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const numVal = parseInt(val) || 0;
                                          updateInventoryData(ticket.id, 'vault_packages', val);
                                          if (numVal > 0) {
                                            updateInventoryData(ticket.id, 'vault_units', "");
                                          }
                                        }}
                                        placeholder="0"
                                        min="0"
                                        className="h-4 sm:h-6 text-[9px] sm:text-[10px] p-0.5"
                                        disabled={!!data.vault_units && parseInt(data.vault_units) > 0}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Total Summary */}
                              {(() => {
                                const counterUnits = parseInt(data.counter_units) || 0;
                                const counterPackages = parseInt(data.counter_packages) || 0;
                                const vaultUnits = parseInt(data.vault_units) || 0;
                                const vaultPackages = parseInt(data.vault_packages) || 0;
                                const defaultQtyPerPackage = ticket.default_quantity_per_package || 1;
                                
                                const counterTotal = counterUnits + (counterPackages * defaultQtyPerPackage);
                                const vaultTotal = vaultUnits + (vaultPackages * defaultQtyPerPackage);
                                const grandTotal = counterTotal + vaultTotal;
                                const totalPackages = counterPackages + vaultPackages;
                                
                                if (grandTotal > 0) {
                                  return (
                                    <div className="mt-1 pt-1 border-t border-border/50">
                                      <p className="text-[7px] sm:text-[9px] text-center text-muted-foreground">
                                        סה"כ: <span className="font-semibold text-foreground">{grandTotal} יחידות</span>
                                        {totalPackages > 0 && defaultQtyPerPackage > 1 && (
                                          <span className="block mt-0.5 text-[6px] sm:text-[8px]">
                                            ({totalPackages} × {defaultQtyPerPackage})
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
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

              {/* Step 3: Summary */}
              {currentStep === STEPS.SUMMARY && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-foreground mb-2">סיכום המלאי</h2>
                    <p className="text-muted-foreground">
                      בדקו את הפרטים שהזנתם לפני המשך ההגדרה
                    </p>
                  </div>

                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 sm:pr-2">
                    {(() => {
                      // Get all tickets with inventory
                      const ticketsWithInventory = tickets.filter(ticket => {
                        const data = inventoryData[ticket.id];
                        if (!data) return false;
                        
                        const counterUnits = parseInt(data.counter_units) || 0;
                        const counterPackages = parseInt(data.counter_packages) || 0;
                        const vaultUnits = parseInt(data.vault_units) || 0;
                        const vaultPackages = parseInt(data.vault_packages) || 0;
                        
                        return counterUnits > 0 || counterPackages > 0 || vaultUnits > 0 || vaultPackages > 0;
                      });

                      if (ticketsWithInventory.length === 0) {
                        return (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              לא הוזן מלאי לכרטיסים
                            </AlertDescription>
                          </Alert>
                        );
                      }

                      return ticketsWithInventory.map(ticket => {
                        const data = inventoryData[ticket.id] || {};
                        const defaultQtyPerPackage = ticket.default_quantity_per_package || 1;
                        
                        // Counter calculations
                        const counterUnits = parseInt(data.counter_units) || 0;
                        const counterPackages = parseInt(data.counter_packages) || 0;
                        const counterUnitsFromPackages = counterPackages * defaultQtyPerPackage;
                        const counterTotalUnits = counterUnits + counterUnitsFromPackages;
                        
                        // Vault calculations
                        const vaultUnits = parseInt(data.vault_units) || 0;
                        const vaultPackages = parseInt(data.vault_packages) || 0;
                        const vaultUnitsFromPackages = vaultPackages * defaultQtyPerPackage;
                        const vaultTotalUnits = vaultUnits + vaultUnitsFromPackages;
                        
                        // Total calculations
                        const totalUnits = counterTotalUnits + vaultTotalUnits;
                        const totalIndividualUnits = counterUnits + vaultUnits;
                        const totalPackages = counterPackages + vaultPackages;

                        return (
                          <Card key={ticket.id} className="p-4">
                            <div className="flex items-start gap-4 flex-row-reverse">
                              {ticket.image_url && (
                                <img
                                  src={ticket.image_url}
                                  alt={ticket.name}
                                  className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded flex-shrink-0"
                                  loading="lazy"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              )}
                              <div className="flex-1 min-w-0 text-right">
                                <h3 className="font-bold text-lg text-foreground mb-1">{ticket.name}</h3>
                                {ticket.nickname && (
                                  <p className="text-sm text-muted-foreground mb-2">"{ticket.nickname}"</p>
                                )}
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                                  {/* Counter Summary */}
                                  {(counterTotalUnits > 0) && (
                                    <div className="space-y-2 text-right">
                                      <p className="font-semibold text-sm text-muted-foreground">דלפק</p>
                                      <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                          <span className="font-semibold">{counterTotalUnits}</span>
                                          <span>סה"כ יחידות</span>
                                        </div>
                                        {counterUnits > 0 && (
                                          <div className="flex justify-between text-muted-foreground">
                                            <span>{counterUnits}</span>
                                            <span>בודדים</span>
                                          </div>
                                        )}
                                        {counterPackages > 0 && (
                                          <div className="flex justify-between text-muted-foreground">
                                            <span>{counterPackages} × {defaultQtyPerPackage} = {counterPackages * defaultQtyPerPackage}</span>
                                            <span>חבילות</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Vault Summary */}
                                  {(vaultTotalUnits > 0) && (
                                    <div className="space-y-2 text-right">
                                      <p className="font-semibold text-sm text-muted-foreground">כספת</p>
                                      <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                          <span className="font-semibold">{vaultTotalUnits}</span>
                                          <span>סה"כ יחידות</span>
                                        </div>
                                        {vaultUnits > 0 && (
                                          <div className="flex justify-between text-muted-foreground">
                                            <span>{vaultUnits}</span>
                                            <span>בודדים</span>
                                          </div>
                                        )}
                                        {vaultPackages > 0 && (
                                          <div className="flex justify-between text-muted-foreground">
                                            <span>{vaultPackages} × {defaultQtyPerPackage} = {vaultPackages * defaultQtyPerPackage}</span>
                                            <span>חבילות</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Total Summary */}
                                <div className="mt-4 pt-3 border-t text-right">
                                  <div className="space-y-1">
                                    <div className="font-bold text-lg">
                                      סה"כ יחידות: {totalUnits}
                                      {totalPackages > 0 && defaultQtyPerPackage > 1 && (
                                        <span className="text-sm font-normal text-muted-foreground mr-2">
                                          ({totalPackages} × {defaultQtyPerPackage})
                                        </span>
                                      )}
                                    </div>
                                    {totalIndividualUnits > 0 && (
                                      <div className="text-sm text-muted-foreground">בודדים: {totalIndividualUnits}</div>
                                    )}
                                    {totalPackages > 0 && (
                                      <div className="text-sm text-muted-foreground">חבילות: {totalPackages}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      });
                    })()}
                  </div>
                </motion.div>
              )}

              {/* Step 4: Commission Setup */}
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
                            {Object.entries(inventoryData).filter(([ticketId, d]) => {
                              const counterUnits = parseInt(d.counter_units) || 0;
                              const counterPackages = parseInt(d.counter_packages) || 0;
                              const vaultUnits = parseInt(d.vault_units) || 0;
                              const vaultPackages = parseInt(d.vault_packages) || 0;
                              return counterUnits > 0 || counterPackages > 0 || vaultUnits > 0 || vaultPackages > 0;
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

