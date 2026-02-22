import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import 'bootstrap/dist/css/bootstrap.min.css';

// Layout Components
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';

// Pages - Public
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import HealthCheck from './pages/HealthCheck';
import BMICalculator from './pages/HealthCheck/BMICalculator';
import CalorieCalculator from './pages/HealthCheck/CalorieCalculator';
import BloodPressureChecker from './pages/HealthCheck/BloodPressureChecker';

// Pages - Protected (User)
import Consultations from './pages/Consultations';
import ConsultationChat from './pages/Consultations/ConsultationChat';
import Pharmacy from './pages/Pharmacy';
import Appointments from './pages/Appointments';
import PaymentHistory from './pages/PaymentHistory';
import UserDashboard from './pages/user/Dashboard';

// Pages - Doctor
import DoctorDashboard from './pages/doctor/Dashboard';
import DoctorSickLetters from './pages/doctor/SickLetters';
import DoctorAppointments from './pages/doctor/Appointments';

// Pages - Admin
import AdminDashboard from './pages/Admin/Dashboard';
import VerifyPayments from './pages/Admin/VerifyPayments';

// Context
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user } = useAuth();
    
    if (!user) {
        return <Navigate to="/login" />;
    }
    
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect ke dashboard sesuai role
        if (user.role === 'admin') return <Navigate to="/admin" />;
        if (user.role === 'doctor') return <Navigate to="/doctor" />;
        return <Navigate to="/dashboard" />;
    }
    
    return children;
};

// Dashboard Router berdasarkan role
const DashboardRouter = () => {
    const { user } = useAuth();
    
    if (!user) return <Navigate to="/login" />;
    
    switch(user.role) {
        case 'admin':
            return <Navigate to="/admin" />;
        case 'doctor':
            return <Navigate to="/doctor" />;
        default:
            return <UserDashboard />;
    }
};

function AppContent() {
    return (
        <div className="App">
            <Navbar />
            <main style={{ minHeight: '80vh' }}>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/health-check" element={<HealthCheck />} />
                    <Route path="/health-check/bmi" element={<BMICalculator />} />
                    <Route path="/health-check/calories" element={<CalorieCalculator />} />
                    <Route path="/health-check/blood-pressure" element={<BloodPressureChecker />} />
                    
                    {/* Dashboard Route - otomatis sesuai role */}
                    <Route 
                        path="/dashboard" 
                        element={
                            <ProtectedRoute>
                                <DashboardRouter />
                            </ProtectedRoute>
                        } 
                    />
                    
                    {/* User Routes */}
                    <Route 
                        path="/consultations" 
                        element={
                            <ProtectedRoute allowedRoles={['user']}>
                                <Consultations />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/consultations/:id" 
                        element={
                            <ProtectedRoute allowedRoles={['user', 'doctor']}>
                                <ConsultationChat />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/doctor/appointments" 
                        element={
                            <ProtectedRoute allowedRoles={['doctor']}>
                                <DoctorAppointments />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/pharmacy" 
                        element={
                            <ProtectedRoute allowedRoles={['user']}>
                                <Pharmacy />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/appointments" 
                        element={
                            <ProtectedRoute allowedRoles={['user']}>
                                <Appointments />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/payments" 
                        element={
                            <ProtectedRoute allowedRoles={['user']}>
                                <PaymentHistory />
                            </ProtectedRoute>
                        } 
                    />
                    
                    {/* Doctor Routes */}
                    <Route 
                        path="/doctor" 
                        element={
                            <ProtectedRoute allowedRoles={['doctor']}>
                                <DoctorDashboard />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/doctor/sick-letters" 
                        element={
                            <ProtectedRoute allowedRoles={['doctor']}>
                                <DoctorSickLetters />
                            </ProtectedRoute>
                        } 
                    />
                    
                    {/* Admin Routes */}
                    <Route 
                        path="/admin" 
                        element={
                            <ProtectedRoute allowedRoles={['admin']}>
                                <AdminDashboard />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/admin/verify-payments" 
                        element={
                            <ProtectedRoute allowedRoles={['admin']}>
                                <VerifyPayments />
                            </ProtectedRoute>
                        } 
                    />

                    {/* 404 Page */}
                    <Route path="*" element={<h1 className="text-center mt-5">404 - Halaman Tidak Ditemukan</h1>} />
                </Routes>
            </main>
            <Footer />
            <Toaster 
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: '#363636',
                        color: '#fff',
                    },
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
                    <NotificationProvider>  {/* ✅ HARUS ADA DI SINI! */}
                        <AppContent />
                    </NotificationProvider>
                </CartProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;