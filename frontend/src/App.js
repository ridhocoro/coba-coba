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
import ForgotEmail from './pages/ForgotEmail';
import ResetPassword from './pages/ResetPassword';
import HealthCheck from './pages/HealthCheck';
import BMICalculator from './pages/HealthCheck/BMICalculator';
import CalorieCalculator from './pages/HealthCheck/CalorieCalculator';
import BloodPressureChecker from './pages/HealthCheck/BloodPressureChecker';
import VitalScanPage from './pages/HealthCheck/VitalScanPage';
import CekPoli from './pages/HealthCheck/CekPoli';
import PoliUmum from './pages/services/PoliUmum';
import PoliGigi from './pages/services/PoliGigi';
import LayananKIA from './pages/services/LayananKIA';
import PoliGizi from './pages/services/PoliGizi';
import MedicalCheckUp from './pages/services/MedicalCheckUp';
import Laboratorium from './pages/services/Laboratorium';
import PelayananKefarmasian from './pages/services/PelayananKefarmasian';
import Ambulance from './pages/services/Ambulance';

// User Pages
import Consultations from './pages/Consultations';
import ConsultationChat from './pages/Consultations/ConsultationChat';
import Pharmacy from './pages/Pharmacy';
import PaymentHistory from './pages/PaymentHistory';
import Profile from './pages/user/Profile';
import BookingSlot from './pages/user/BookingSlot';
import PaymentResult from './pages/user/PaymentResult';
import UserAppointments from './pages/user/Appointments';

// Doctor
import DoctorDashboard from './pages/doctor/DoctorDashboard';

// Admin — satu entry point, semua tab dihandle di dalam AdminIndex
import AdminIndex from './pages/Admin/index';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';
import { useLocation } from 'react-router-dom';

// AI Chatbot
import AIChatbot from './components/AIChatbot/AIChatbot';

// ─── Route guard ───────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" />;
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        if (user.role === 'admin')  return <Navigate to="/admin" />;
        if (user.role === 'doctor') return <Navigate to="/doctor" />;
        return <Navigate to="/" />;
    }
    return children;
};

// ─── Role-based home redirect ─────────────────────────────────────────────────
const HomeRouter = () => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (user?.role === 'admin')  return <Navigate to="/admin" replace />;
    if (user?.role === 'doctor') return <Navigate to="/doctor" replace />;
    return <Home />;
};

// ─── App content ──────────────────────────────────────────────────────────────
function AppContent() {
    const { user } = useAuth();
    const location = useLocation();
    const isDoctor = user?.role === 'doctor';
    const isAdmin  = user?.role === 'admin';

    // Sembunyikan Navbar & Footer untuk: admin, dokter, dan halaman chat konsultasi
    const isChatPage = /^\/consultations\/[^/]+$/.test(location.pathname) && location.pathname !== '/consultations';
    const hideLayout = isDoctor || isAdmin || isChatPage;

    return (
        <div className="App">
            {!hideLayout && <Navbar />}

            <main style={{ minHeight: hideLayout ? '100vh' : '80vh', height: isChatPage ? '100vh' : 'auto', overflow: isChatPage ? 'hidden' : 'auto' }}>
                <Routes>
                    {/* ===== PUBLIC ===== */}
                    <Route path="/"                         element={<HomeRouter />} />
                    <Route path="/login"                    element={<Login />} />
                    <Route path="/register"                 element={<Register />} />
                    <Route path="/forgot-password"          element={<ForgotPassword />} />
                    <Route path="/forgot-email"             element={<ForgotEmail />} />
                    <Route path="/reset-password"           element={<ResetPassword />} />
                    <Route path="/health-check"             element={<HealthCheck />} />
                    <Route path="/health-check/bmi"         element={<BMICalculator />} />
                    <Route path="/health-check/calories"    element={<CalorieCalculator />} />
                    <Route path="/health-check/blood-pressure" element={<BloodPressureChecker />} />
                    <Route path="/health-check/vital-scan"     element={<VitalScanPage />} />
                    <Route path="/health-check/cek-poli"       element={<CekPoli />} />
                    <Route path="/services/general"          element={<PoliUmum />} />
                    <Route path="/services/dental"           element={<PoliGigi />} />
                    <Route path="/services/mch"              element={<LayananKIA />} />
                    <Route path="/services/nutrition"        element={<PoliGizi />} />
                    <Route path="/services/medical-checkup"  element={<MedicalCheckUp />} />
                    <Route path="/services/laboratory"       element={<Laboratorium />} />
                    <Route path="/services/pharmacy"         element={<PelayananKefarmasian />} />
                    <Route path="/services/ambulance"        element={<Ambulance />} />

                    {/* ===== USER PROFILE ===== */}
                    <Route path="/profile"   element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                    {/* ===== USER ===== */}
                    <Route path="/consultations" element={<Consultations />} />
                    {/* /book/:doctorId HARUS di atas /:id */}
                    <Route path="/consultations/book/:doctorId" element={
                        <ProtectedRoute allowedRoles={['user','mahasiswa']}><BookingSlot /></ProtectedRoute>
                    } />
                    <Route path="/consultations/:id" element={
                        <ProtectedRoute allowedRoles={['user','mahasiswa','doctor']}><ConsultationChat /></ProtectedRoute>
                    } />

                    <Route path="/payment/success" element={<ProtectedRoute><PaymentResult /></ProtectedRoute>} />
                    <Route path="/payment/failed"  element={<ProtectedRoute><PaymentResult /></ProtectedRoute>} />

                    <Route path="/pharmacy"     element={<Pharmacy />} />
                    <Route path="/payments"     element={<ProtectedRoute allowedRoles={['user','mahasiswa']}><PaymentHistory /></ProtectedRoute>} />
                    <Route path="/appointments" element={<UserAppointments />} />

                    {/* ===== DOCTOR ===== */}
                    <Route path="/doctor"   element={<ProtectedRoute allowedRoles={['doctor']}><DoctorDashboard /></ProtectedRoute>} />
                    <Route path="/doctor/*" element={<Navigate to="/doctor" replace />} />

                    {/* ===== ADMIN — satu route, semua tab dihandle di AdminIndex ===== */}
                    <Route path="/admin"   element={<ProtectedRoute allowedRoles={['admin']}><AdminIndex /></ProtectedRoute>} />
                    <Route path="/admin/*" element={<ProtectedRoute allowedRoles={['admin']}><AdminIndex /></ProtectedRoute>} />

                    {/* ===== 404 ===== */}
                    <Route path="*" element={
                        <div className="text-center mt-5 py-5">
                            <h1 className="display-1 text-muted">404</h1>
                            <p className="lead">Halaman tidak ditemukan</p>
                            <a href="/" className="btn btn-primary">Kembali ke Beranda</a>
                        </div>
                    } />
                </Routes>
            </main>

            {!hideLayout && <Footer />}

            <Toaster
                position="top-right"
                toastOptions={{ duration: 4000, style: { background: '#363636', color: '#fff' } }}
            />

            {/* AI Chatbot — tampil untuk guest & user biasa, sembunyikan untuk admin/dokter/halaman chat */}
            {!isAdmin && !isDoctor && !isChatPage && <AIChatbot />}
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