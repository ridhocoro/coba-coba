import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button } from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { 
    FaCheckCircle,  // ✅ TAMBAHKAN INI!
} from 'react-icons/fa';

const Appointments = () => {
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const { user } = useAuth();

    useEffect(() => {
        fetchDoctors();
    }, []);

    const fetchDoctors = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/doctors');
            setDoctors(res.data);
        } catch (error) {
            toast.error('Gagal memuat data dokter');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Logic booking janji temu + payment
    };

    return (
        <Container className="py-5">
            <h2>Buat Janji Temu</h2>
            {/* Form booking */}
        </Container>
    );
};

export default Appointments;