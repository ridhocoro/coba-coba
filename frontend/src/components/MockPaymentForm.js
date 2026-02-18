import React, { useState } from "react";
import axios from "axios";
import { Button, Alert } from "react-bootstrap";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const MockPaymentForm = ({ consultation, amount, onSuccess, onClose }) => {
    const [processing, setProcessing] = useState(false);
    const { user } = useAuth();

    const handleMockPayment = async (status) => {
        setProcessing(true);
        try {
            const token = localStorage.getItem("token");
            if (status === "success") {
                toast.success("✅ Pembayaran berhasil (Mock)");
                onSuccess();
                onClose();
            } else {
                toast.error("❌ Pembayaran gagal");
            }
        } catch (err) {
            toast.error("Terjadi kesalahan");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="text-center p-3">
            <Alert variant="warning">
                <strong>DEV MODE</strong> – Pembayaran testing
            </Alert>

            <Button onClick={() => handleMockPayment("success")}>
                Bayar Sekarang
            </Button>
        </div>
    );
};

export default MockPaymentForm;
