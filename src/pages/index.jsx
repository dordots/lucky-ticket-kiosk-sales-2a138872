import Layout from "./Layout.jsx";

import SellerPOS from "./SellerPOS";

import Dashboard from "./Dashboard";

import Inventory from "./Inventory";

import SalesHistory from "./SalesHistory";

import UsersManagement from "./UsersManagement";

import Reports from "./Reports";

import Notifications from "./Notifications";

import SaleDetails from "./SaleDetails";

import EditSale from "./EditSale";

import DeleteSale from "./DeleteSale";

import AuditLog from "./AuditLog";

import Settings from "./Settings";

import KiosksManagement from "./KiosksManagement";

import KiosksDashboard from "./KiosksDashboard";

import FranchiseesManagement from "./FranchiseesManagement";

import KioskDetails from "./KioskDetails";

import KioskSelfCreate from "./KioskSelfCreate";
import Login from "./Login";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

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
    
    AuditLog: AuditLog,
    
    Settings: Settings,
    
    KiosksManagement: KiosksManagement,
    
    KiosksDashboard: KiosksDashboard,
    
    FranchiseesManagement: FranchiseesManagement,
    
    KioskDetails: KioskDetails,
    
    KioskSelfCreate: KioskSelfCreate,
    
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
                
                <Route path="/AuditLog" element={<AuditLog />} />
                
                <Route path="/Settings" element={<Settings />} />
                
                <Route path="/KiosksManagement" element={<KiosksManagement />} />
                
                <Route path="/KiosksDashboard" element={<KiosksDashboard />} />
                
                <Route path="/FranchiseesManagement" element={<FranchiseesManagement />} />
                
                <Route path="/KioskDetails" element={<KioskDetails />} />
                
                <Route path="/KioskSelfCreate" element={<KioskSelfCreate />} />
                
            </Routes>
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