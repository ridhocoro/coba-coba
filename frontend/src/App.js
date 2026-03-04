// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import 'bootstrap/dist/css/bootstrap.min.css';

// Layout
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';

// Public Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import HealthCheck from './pages/HealthCheck';
import BMICalculator from './pages/HealthCheck/BMICalculator';
import CalorieCalculator from './pages/HealthCheck/CalorieCalculator';
import BloodPressureChecker from './pages/HealthCheck/BloodPressureChecker';

// User Pages
import Consultations from './pages/Consultations';           // ← HANYA SATU IMPORT
import ConsultationChat from './pages/Consultations/ConsultationChat';
import Pharmacy from './pages/Pharmacy';
import Appointments from './pages/Appointments';
import PaymentHistory from './pages/PaymentHistory';
import UserDashboard from './pages/user/Dashboard';
import Profile from './pages/user/Profile';

// Doctor Pages
import DoctorDashboard from './pages/doctor/Dashboard';
import DoctorSickLetters from './pages/doctor/SickLetters';
import DoctorAppointments from './pages/doctor/Appointments';
import DoctorPatients from './pages/doctor/Patients';
import DoctorConsultations from './pages/doctor/Consultations';

// Role-specific Home Pages
import AdminHome from './pages/Admin/Home';
import DoctorHome from './pages/doctor/Home';
import DoctorSettings from './pages/doctor/Settings';

// Admin Pages
import AdminDashboard from './pages/Admin/index';
import VerifyPayments from './pages/Admin/VerifyPayments';
import ManageDoctors from './pages/Admin/ManageDoctors';
import ManageUsers from './pages/Admin/ManageUsers';
import ManageConsultations from './pages/Admin/ManageConsultations';
import ManageAppointments from './pages/Admin/ManageAppointments';
import ManagePharmacy from './pages/Admin/ManagePharmacy';
import AdminManualPayment from './pages/Admin/ManualPayment';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();
    
    // Tunggu fetch user selesai dulu — jangan redirect sebelum tahu status auth
    if (loading) return null;
    
    if (!user) return <Navigate to="/login" />;
    
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        if (user.role === 'admin') return <Navigate to="/admin" />;
        if (user.role === 'doctor') return <Navigate to="/doctor" />;
        return <Navigate to="/dashboard" />;
    }
    
    return children;
};

// Home router - tampilkan halaman relevan per role
const HomeRouter = () => {
    const { user, loading } = useAuth();
    if (loading) return null;
    
    if (user?.role === 'admin') return <AdminHome />;
    if (user?.role === 'doctor') return <DoctorHome />;
    return <Home />;
};

// Dashboard redirect berdasarkan role
const DashboardRouter = () => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" />;
    
    if (user.role === 'admin') return <Navigate to="/admin" />;
    if (user.role === 'doctor') return <Navigate to="/doctor" />;
    return <UserDashboard />;
};

function AppContent() {
    return (
        <div className="App">
            <Navbar />
            <main style={{ minHeight: '80vh' }}>
                <Routes>
                    {/* ===== PUBLIC ROUTES ===== */}
                    <Route path="/" element={<HomeRouter />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/health-check" element={<HealthCheck />} />
                    <Route path="/health-check/bmi" element={<BMICalculator />} />
                    <Route path="/health-check/calories" element={<CalorieCalculator />} />
                    <Route path="/health-check/blood-pressure" element={<BloodPressureChecker />} />

                    {/* ===== DASHBOARD (semua role) ===== */}
                    <Route path="/dashboard" element={
                        <ProtectedRoute>
                            <DashboardRouter />
                        </ProtectedRoute>
                    } />
                    <Route path="/profile" element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    } />

                    {/* ===== USER ROUTES ===== */}
                    <Route path="/consultations" element={
                        <ProtectedRoute allowedRoles={['user']}>
                            <Consultations />
                        </ProtectedRoute>
                    } />
                    <Route path="/consultations/:id" element={
                        <ProtectedRoute allowedRoles={['user', 'doctor']}>
                            <ConsultationChat />
                        </ProtectedRoute>
                    } />
                    <Route path="/pharmacy" element={
                        <ProtectedRoute allowedRoles={['user']}>
                            <Pharmacy />
                        </ProtectedRoute>
                    } />
                    <Route path="/appointments" element={
                        <ProtectedRoute allowedRoles={['user']}>
                            <Appointments />
                        </ProtectedRoute>
                    } />
                    <Route path="/payments" element={
                        <ProtectedRoute allowedRoles={['user']}>
                            <PaymentHistory />
                        </ProtectedRoute>
                    } />

                    {/* ===== DOCTOR ROUTES ===== */}
                    <Route path="/doctor" element={
                        <ProtectedRoute allowedRoles={['doctor']}>
                            <DoctorDashboard />
                        </ProtectedRoute>
                    } />
                    <Route path="/doctor/settings" element={
                        <ProtectedRoute allowedRoles={['doctor']}>
                            <DoctorSettings />
                        </ProtectedRoute>
                    } />
                    <Route path="/doctor/sick-letters" element={
                        <ProtectedRoute allowedRoles={['doctor']}>
                            <DoctorSickLetters />
                        </ProtectedRoute>
                    } />
                    <Route path="/doctor/consultations" element={
                        <ProtectedRoute allowedRoles={['doctor']}>
                            <DoctorConsultations />
                        </ProtectedRoute>
                    } />
                    <Route path="/doctor/appointments" element={
                        <ProtectedRoute allowedRoles={['doctor']}>
                            <DoctorAppointments />
                        </ProtectedRoute>
                    } />
                    <Route path="/doctor/patients" element={
                        <ProtectedRoute allowedRoles={['doctor']}>
                            <DoctorPatients />
                        </ProtectedRoute>
                    } />

                    {/* ===== ADMIN ROUTES ===== */}
                    <Route path="/admin" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AdminDashboard />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/verify-payments" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <VerifyPayments />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/doctors" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <ManageDoctors />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/users" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <ManageUsers />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/consultations" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <ManageConsultations />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/appointments" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <ManageAppointments />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/pharmacy" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <ManagePharmacy />
                        </ProtectedRoute>
                    } />
                    <Route path="/admin/manual-payments" element={
                        <ProtectedRoute allowedRoles={['admin']}>
                            <AdminManualPayment />
                        </ProtectedRoute>
                    } />

                    {/* ===== 404 NOT FOUND ===== */}
                    <Route path="*" element={
                        <div className="text-center mt-5 py-5">
                            <h1 className="display-1 text-muted">404</h1>
                            <p className="lead">Halaman tidak ditemukan</p>
                            <a href="/" className="btn btn-primary">Kembali ke Beranda</a>
                        </div>
                    } />
                </Routes>
            </main>
            <Footer />
            <Toaster 
                position="top-right" 
                toastOptions={{ 
                    duration: 4000, 
                    style: { background: '#363636', color: '#fff' } 
                }} 
            />
        </div>
    );
}

function App() {
    return (
        <Router>
            <AuthProvider>
                <CartProvider>
                    <NotificationProvider>
                        <AppContent />
                    </NotificationProvider>
                </CartProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;