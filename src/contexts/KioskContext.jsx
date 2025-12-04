import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser } from '@/firebase/services/auth';
import { getKioskForUser, getKioskById } from '@/firebase/services/kiosks';
import { getAllKiosks } from '@/firebase/services/kiosks';

const KioskContext = createContext(null);

export const useKiosk = () => {
  const context = useContext(KioskContext);
  if (!context) {
    throw new Error('useKiosk must be used within KioskProvider');
  }
  return context;
};

export const KioskProvider = ({ children }) => {
  const [currentKiosk, setCurrentKiosk] = useState(null);
  const [allKiosks, setAllKiosks] = useState([]);
  const [selectedKioskId, setSelectedKioskId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadKioskData = async () => {
      try {
        setIsLoading(true);
        
        // Wait a bit for auth to initialize
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Try to get current user with retry
        let currentUser = await getCurrentUser();
        
        // Retry once if user not found
        if (!currentUser) {
          console.warn("KioskContext: No user found, retrying...");
          await new Promise(resolve => setTimeout(resolve, 500));
          currentUser = await getCurrentUser();
        }
        
        console.log("KioskContext - Current user:", currentUser); // Debug log
        
        if (!currentUser) {
          console.warn("KioskContext: Still no user after retry");
          setCurrentKiosk(null);
          setAllKiosks([]);
          setUser(null);
          setIsLoading(false);
          return;
        }

        setUser(currentUser);
        
        // Clear old selected kiosk if user changed
        const savedUserId = localStorage.getItem('lastUserId');
        if (savedUserId !== currentUser.uid) {
          localStorage.removeItem('selectedKioskId');
          localStorage.setItem('lastUserId', currentUser.uid);
        }

        // System managers can see all kiosks
        if (currentUser.role === 'system_manager') {
          const kiosks = await getAllKiosks();
          setAllKiosks(kiosks);
          
          // If a kiosk is already selected (from localStorage), use it
          const savedKioskId = localStorage.getItem('selectedKioskId');
          if (savedKioskId && kiosks.find(k => k.id === savedKioskId)) {
            const selectedKiosk = await getKioskById(savedKioskId);
            setCurrentKiosk(selectedKiosk);
            setSelectedKioskId(savedKioskId);
          } else if (kiosks.length > 0) {
            // Default to first kiosk if none selected
            setCurrentKiosk(kiosks[0]);
            setSelectedKioskId(kiosks[0].id);
            localStorage.setItem('selectedKioskId', kiosks[0].id);
          }
        } 
        // Franchisees see their kiosks
        else if (currentUser.role === 'franchisee') {
          // If user has kiosk_ids array, get all those kiosks
          if (currentUser.kiosk_ids && currentUser.kiosk_ids.length > 0) {
            const kiosks = await Promise.all(
              currentUser.kiosk_ids.map(id => getKioskById(id))
            );
            setAllKiosks(kiosks.filter(k => k !== null));
            
            // Default to first kiosk
            if (kiosks.length > 0 && kiosks[0]) {
              setCurrentKiosk(kiosks[0]);
              setSelectedKioskId(kiosks[0].id);
            }
          } 
          // If user has single kiosk_id
          else if (currentUser.kiosk_id) {
            const kiosk = await getKioskById(currentUser.kiosk_id);
            setCurrentKiosk(kiosk);
            setSelectedKioskId(currentUser.kiosk_id);
            setAllKiosks(kiosk ? [kiosk] : []);
          }
        }
        // Assistants see only their kiosk
        else if (currentUser.role === 'assistant') {
          console.log('KioskContext: Loading kiosk for assistant, kiosk_id:', currentUser.kiosk_id);
          if (currentUser.kiosk_id) {
            const kiosk = await getKioskById(currentUser.kiosk_id);
            console.log('KioskContext: Loaded kiosk for assistant:', kiosk);
            if (kiosk) {
              setCurrentKiosk(kiosk);
              setSelectedKioskId(currentUser.kiosk_id);
              setAllKiosks([kiosk]);
            } else {
              console.error('KioskContext: Kiosk not found for assistant:', currentUser.kiosk_id);
              setCurrentKiosk(null);
              setAllKiosks([]);
            }
          } else {
            console.error('KioskContext: Assistant has no kiosk_id');
            setCurrentKiosk(null);
            setAllKiosks([]);
          }
        }
      } catch (error) {
        console.error('Error loading kiosk data:', error);
        setCurrentKiosk(null);
        setAllKiosks([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadKioskData();
  }, []);

  const selectKiosk = async (kioskId) => {
    try {
      const kiosk = await getKioskById(kioskId);
      if (kiosk) {
        setCurrentKiosk(kiosk);
        setSelectedKioskId(kioskId);
        localStorage.setItem('selectedKioskId', kioskId);
      }
    } catch (error) {
      console.error('Error selecting kiosk:', error);
    }
  };

  const refreshKiosks = async () => {
    try {
      if (user?.role === 'system_manager') {
        const kiosks = await getAllKiosks();
        setAllKiosks(kiosks);
      } else if (user?.role === 'franchisee') {
        if (user.kiosk_ids && user.kiosk_ids.length > 0) {
          const kiosks = await Promise.all(
            user.kiosk_ids.map(id => getKioskById(id))
          );
          setAllKiosks(kiosks.filter(k => k !== null));
        } else if (user.kiosk_id) {
          const kiosk = await getKioskById(user.kiosk_id);
          setAllKiosks(kiosk ? [kiosk] : []);
        }
      }
    } catch (error) {
      console.error('Error refreshing kiosks:', error);
    }
  };

  const value = {
    currentKiosk,
    allKiosks,
    selectedKioskId,
    isLoading,
    selectKiosk,
    refreshKiosks,
    user,
    canSelectKiosk: user?.role === 'system_manager' || (user?.role === 'franchisee' && allKiosks.length > 1)
  };

  return (
    <KioskContext.Provider value={value}>
      {children}
    </KioskContext.Provider>
  );
};

