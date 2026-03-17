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

// User Pages
import Consultations from './pages/Consultations';
import ConsultationChat from './pages/Consultations/ConsultationChat';
import Pharmacy from './pages/Pharmacy';
import PaymentHistory from './pages/PaymentHistory';
import UserDashboard from './pages/user/Dashboard';
import Profile from './pages/user/Profile';
import BookingSlot from './pages/user/BookingSlot';
import PaymentResult from './pages/user/PaymentResult';
import UserAppointments from './pages/user/Appointments';

// ─── Doctor: SATU FILE untuk semua halaman dokter ─────────────────────────────
// Semua route /doctor/* dihandle di dalam komponen ini.
// Navbar & Footer tidak ditampilkan untuk dokter karena
// DoctorDashboard sudah punya sidebar navigasinya sendiri.
import DoctorDashboard from './pages/doctor/DoctorDashboard';

// Admin Pages
import AdminHome from './pages/Admin/Home';
import AdminDashboard from './pages/Admin/index';
import VerifyPayments from './pages/Admin/VerifyPayments';
import ManageDoctors from './pages/Admin/ManageDoctors';
import ManageUsers from './pages/Admin/ManageUsers';
import ManageConsultations from './pages/Admin/ManageConsultations';
import ManageAppointments from './pages/Admin/ManageAppointments';
import ManagePharmacy from './pages/Admin/ManagePharmacy';
import AdminManualPayment from './pages/Admin/ManualPayment';
import ClinicSettings from './pages/Admin/ClinicSettings';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { NotificationProvider } from './context/NotificationContext';

// ─── Route guard ───────────────────────────────────────────────────────────────
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/login" />;
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        if (user.role === 'admin')  return <Navigate to="/admin" />;
        if (user.role === 'doctor') return <Navigate to="/doctor" />;
        return <Navigate to="/dashboard" />;
    }
    return children;
};

// ─── Role-based home redirect ─────────────────────────────────────────────────
const HomeRouter = () => {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (user?.role === 'admin')  return <AdminHome />;
    if (user?.role === 'doctor') return <Navigate to="/doctor" replace />;
    return <Home />; // 'user' dan 'mahasiswa' → Home
};

// ─── Dashboard redirect ───────────────────────────────────────────────────────
const DashboardRouter = () => {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" />;
    if (user.role === 'admin')  return <Navigate to="/admin" />;
    if (user.role === 'doctor') return <Navigate to="/doctor" />;
    return <UserDashboard />; // 'user' dan 'mahasiswa'
};

// ─── App content ──────────────────────────────────────────────────────────────
function AppContent() {
    const { user } = useAuth();
    const isDoctor = user?.role === 'doctor';

    return (
        <div className="App">
            {/* Navbar & Footer disembunyikan untuk dokter —
                DoctorDashboard punya sidebar sendiri */}
            {!isDoctor && <Navbar />}

            <main style={{ minHeight: isDoctor ? '100vh' : '80vh' }}>
                <Routes>
                    {/* ===== PUBLIC ===== */}
                    <Route path="/" element={<HomeRouter />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/forgot-email" element={<ForgotEmail />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/health-check" element={<HealthCheck />} />
                    <Route path="/health-check/bmi" element={<BMICalculator />} />
                    <Route path="/health-check/calories" element={<CalorieCalculator />} />
                    <Route path="/health-check/blood-pressure" element={<BloodPressureChecker />} />

                    {/* ===== DASHBOARD ===== */}
                    <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                    {/* ===== USER ===== */}
                    <Route path="/consultations" element={<ProtectedRoute allowedRoles={['user','mahasiswa']}><Consultations /></ProtectedRoute>} />

                    {/* ⚠️ /book/:doctorId HARUS di atas /:id */}
                    <Route path="/consultations/book/:doctorId" element={
                        <ProtectedRoute allowedRoles={['user','mahasiswa']}><BookingSlot /></ProtectedRoute>
                    } />

                    {/* Route chat dipakai oleh user DAN dokter (tombol "Buka Chat" di DoctorDashboard) */}
                    <Route path="/consultations/:id" element={
                        <ProtectedRoute allowedRoles={['user', 'mahasiswa', 'doctor']}><ConsultationChat /></ProtectedRoute>
                    } />

                    <Route path="/payment/success" element={<ProtectedRoute><PaymentResult /></ProtectedRoute>} />
                    <Route path="/payment/failed"  element={<ProtectedRoute><PaymentResult /></ProtectedRoute>} />

                    <Route path="/pharmacy"    element={<ProtectedRoute allowedRoles={['user','mahasiswa']}><Pharmacy /></ProtectedRoute>} />
                    <Route path="/payments"    element={<ProtectedRoute allowedRoles={['user','mahasiswa']}><PaymentHistory /></ProtectedRoute>} />
                    <Route path="/appointments" element={<ProtectedRoute allowedRoles={['user','mahasiswa']}><UserAppointments /></ProtectedRoute>} />

                    {/* ===== DOCTOR — semua dihandle DoctorDashboard ===== */}
                    <Route path="/doctor" element={
                        <ProtectedRoute allowedRoles={['doctor']}><DoctorDashboard /></ProtectedRoute>
                    } />
                    {/* Semua sub-route lama /doctor/* redirect ke /doctor */}
                    <Route path="/doctor/*" element={<Navigate to="/doctor" replace />} />

                    {/* ===== ADMIN ===== */}
                    <Route path="/admin"                 element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
                    <Route path="/admin/verify-payments" element={<ProtectedRoute allowedRoles={['admin']}><VerifyPayments /></ProtectedRoute>} />
                    <Route path="/admin/doctors"         element={<ProtectedRoute allowedRoles={['admin']}><ManageDoctors /></ProtectedRoute>} />
                    <Route path="/admin/users"           element={<ProtectedRoute allowedRoles={['admin']}><ManageUsers /></ProtectedRoute>} />
                    <Route path="/admin/consultations"   element={<ProtectedRoute allowedRoles={['admin']}><ManageConsultations /></ProtectedRoute>} />
                    <Route path="/admin/appointments"    element={<ProtectedRoute allowedRoles={['admin']}><ManageAppointments /></ProtectedRoute>} />
                    <Route path="/admin/pharmacy"        element={<ProtectedRoute allowedRoles={['admin']}><ManagePharmacy /></ProtectedRoute>} />
                    <Route path="/admin/manual-payments" element={<ProtectedRoute allowedRoles={['admin']}><AdminManualPayment /></ProtectedRoute>} />
                    <Route path="/admin/clinic-settings" element={<ProtectedRoute allowedRoles={['admin']}><ClinicSettings /></ProtectedRoute>} />

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

            {!isDoctor && <Footer />}

            <Toaster
                position="top-right"
                toastOptions={{ duration: 4000, style: { background: '#363636', color: '#fff' } }}
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