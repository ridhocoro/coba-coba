import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import 'bootstrap/dist/css/bootstrap.min.css';

// Layout Components
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import HealthCheck from './pages/HealthCheck';
import BMICalculator from './pages/HealthCheck/BMICalculator';
import CalorieCalculator from './pages/HealthCheck/CalorieCalculator';
import BloodPressureChecker from './pages/HealthCheck/BloodPressureChecker';
import Consultations from './pages/Consultations';
import ConsultationChat from './pages/Consultations/ConsultationChat';
import SickLetters from './pages/SickLetters';
import Pharmacy from './pages/Pharmacy';
import Appointments from './pages/Appointments';
import PaymentHistory from './pages/PaymentHistory';
import AdminDashboard from './pages/Admin';

// Context
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

// HAPUS semua import Stripe
// import { loadStripe } from '@stripe/stripe-js';
// import { Elements } from '@stripe/react-stripe-js';
// const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function App() {
    return (
        <Router>
            <AuthProvider>
                <CartProvider>
                    {/* HAPUS Elements wrapper */}
                    <div className="App">
                        <Navbar />
                        <main style={{ minHeight: '80vh' }}>
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                <Route path="/health-check" element={<HealthCheck />} />
                                <Route path="/health-check/bmi" element={<BMICalculator />} />
                                <Route path="/health-check/calories" element={<CalorieCalculator />} />
                                <Route path="/health-check/blood-pressure" element={<BloodPressureChecker />} />
                                <Route path="/consultations" element={<Consultations />} />
                                <Route path="/consultations/:id" element={<ConsultationChat />} />
                                <Route path="/sick-letters" element={<SickLetters />} />
                                <Route path="/pharmacy" element={<Pharmacy />} />
                                <Route path="/appointments" element={<Appointments />} />
                                <Route path="/payments" element={<PaymentHistory />} />
                                <Route path="/admin/*" element={<AdminDashboard />} />
                            </Routes>
                        </main>
                        <Footer />
                        <Toaster position="top-right" />
                    </div>
                    {/* HAPUS /Elements */}
                </CartProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;