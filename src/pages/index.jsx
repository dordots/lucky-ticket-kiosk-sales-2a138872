import React, { lazy, Suspense } from 'react';
import Layout from "./Layout.jsx";
import Login from "./Login";

// Lazy load pages for better performance
const SellerPOS = lazy(() => import("./SellerPOS"));
const Dashboard = lazy(() => import("./Dashboard"));
const Inventory = lazy(() => import("./Inventory"));
const SalesHistory = lazy(() => import("./SalesHistory"));
const UsersManagement = lazy(() => import("./UsersManagement"));
const Reports = lazy(() => import("./Reports"));
const Notifications = lazy(() => import("./Notifications"));
const SaleDetails = lazy(() => import("./SaleDetails"));
const EditSale = lazy(() => import("./EditSale"));
const DeleteSale = lazy(() => import("./DeleteSale"));
const CancelSale = lazy(() => import("./CancelSale"));
const AuditLog = lazy(() => import("./AuditLog"));
const Settings = lazy(() => import("./Settings"));
const KiosksManagement = lazy(() => import("./KiosksManagement"));
const KiosksDashboard = lazy(() => import("./KiosksDashboard"));
const FranchiseesManagement = lazy(() => import("./FranchiseesManagement"));
const KioskDetails = lazy(() => import("./KioskDetails"));
const KioskSelfCreate = lazy(() => import("./KioskSelfCreate"));
const Onboarding = lazy(() => import("./Onboarding"));
const TicketTypesManagement = lazy(() => import("./TicketTypesManagement"));

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

// Loading component for lazy loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
  </div>
);

const PAGES = {
    SellerPOS: SellerPOS,
    Dashboard: Dashboard,
    Inventory: Inventory,
    SalesHistory: SalesHistory,
    UsersManagement: UsersManagement,
    Reports: Reports,
    Notifications: Notifications,
    SaleDetails: SaleDetails,
    EditSale: EditSale,
    DeleteSale: DeleteSale,
    CancelSale: CancelSale,
    AuditLog: AuditLog,
    Settings: Settings,
    KiosksManagement: KiosksManagement,
    KiosksDashboard: KiosksDashboard,
    FranchiseesManagement: FranchiseesManagement,
    KioskDetails: KioskDetails,
    KioskSelfCreate: KioskSelfCreate,
    Onboarding: Onboarding,
    TicketTypesManagement: TicketTypesManagement,
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/Login" element={<Login />} />
                    
                    <Route path="/" element={<SellerPOS />} />
                    
                    <Route path="/SellerPOS" element={<SellerPOS />} />
                    
                    <Route path="/Dashboard" element={<Dashboard />} />
                    
                    <Route path="/Inventory" element={<Inventory />} />
                    
                    <Route path="/SalesHistory" element={<SalesHistory />} />
                    
                    <Route path="/UsersManagement" element={<UsersManagement />} />
                    
                    <Route path="/Reports" element={<Reports />} />
                    
                    <Route path="/Notifications" element={<Notifications />} />
                    
                    <Route path="/SaleDetails" element={<SaleDetails />} />
                    
                    <Route path="/EditSale" element={<EditSale />} />
                    
                    <Route path="/DeleteSale" element={<DeleteSale />} />
                    
                    <Route path="/CancelSale" element={<CancelSale />} />
                    
                    <Route path="/AuditLog" element={<AuditLog />} />
                    
                    <Route path="/Settings" element={<Settings />} />
                    
                    <Route path="/KiosksManagement" element={<KiosksManagement />} />
                    
                    <Route path="/KiosksDashboard" element={<KiosksDashboard />} />
                    
                    <Route path="/FranchiseesManagement" element={<FranchiseesManagement />} />
                    
                    <Route path="/KioskDetails" element={<KioskDetails />} />
                    
                    <Route path="/KioskSelfCreate" element={<KioskSelfCreate />} />
                    
                    <Route path="/Onboarding" element={<Onboarding />} />
                    
                    <Route path="/TicketTypesManagement" element={<TicketTypesManagement />} />
                    
                </Routes>
            </Suspense>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}