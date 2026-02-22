import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Modal, Form, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
    FaFileMedical, FaDownload, FaCheckCircle, 
    FaTimesCircle, FaClock, FaUpload, FaEye,
    FaStethoscope
} from 'react-icons/fa';

const DoctorSickLetters = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [letters, setLetters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedLetter, setSelectedLetter] = useState(null);
    const [pdfFile, setPdfFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!user || user.role !== 'doctor') {
            navigate('/');
            return;
        }
        fetchLetters();
    }, []);

    const fetchLetters = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                'http://localhost:5000/api/consultations/doctor/pending',
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setLetters(response.data.letters || []);
        } catch (error) {
            toast.error('Gagal memuat data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className="py-4">
            <h2>Kelola Surat Sakit</h2>
            <p>Halaman ini sedang dalam pengembangan</p>
        </Container>
    );
};

export default DoctorSickLetters;