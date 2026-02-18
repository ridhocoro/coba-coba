import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
    FaMapMarkerAlt,
    FaPhone,
    FaEnvelope,
    FaClock,
    FaFacebook,
    FaTwitter,
    FaInstagram,
    FaYoutube
} from 'react-icons/fa';

const Footer = () => {
    return (
        <footer className="bg-dark text-light mt-5 py-5">
            <Container>
                <Row>
                    {/* BRAND */}
                    <Col md={4} className="mb-4">
                        <h5 className="mb-3 text-white">Klinik Pratama IPB</h5>
                        <p className="text-white-50">
                            Melayani kesehatan sivitas akademika IPB dan masyarakat umum
                            dengan pelayanan profesional dan teknologi terkini.
                        </p>

                        <div className="d-flex gap-3 mt-3">
                            <a href="#" className="text-light fs-5">
                                <FaFacebook />
                            </a>
                            <a href="#" className="text-light fs-5">
                                <FaTwitter />
                            </a>
                            <a href="#" className="text-light fs-5">
                                <FaInstagram />
                            </a>
                            <a href="#" className="text-light fs-5">
                                <FaYoutube />
                            </a>
                        </div>
                    </Col>

                    {/* LAYANAN */}
                    <Col md={2} className="mb-4">
                        <h5 className="mb-3 text-white">Layanan</h5>
                        <ul className="list-unstyled">
                            {[
                                ['Cek Kesehatan', '/health-check'],
                                ['Konsultasi Online', '/consultations'],
                                ['Farmasi', '/pharmacy'],
                                ['Surat Sakit', '/sick-letters'],
                                ['Janji Temu', '/appointments'],
                            ].map(([label, path]) => (
                                <li key={path} className="mb-2">
                                    <Link
                                        to={path}
                                        className="text-white-50 text-decoration-none footer-link"
                                    >
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </Col>

                    {/* KONTAK */}
                    <Col md={3} className="mb-4">
                        <h5 className="mb-3 text-white">Kontak</h5>
                        <ul className="list-unstyled">
                            <li className="mb-3 d-flex">
                                <FaMapMarkerAlt className="me-2 mt-1 text-primary" />
                                <span className="text-white-50">
                                    Jl. Raya Darmaga, Kampus IPB, Bogor 16680
                                </span>
                            </li>
                            <li className="mb-3 d-flex">
                                <FaPhone className="me-2 mt-1 text-primary" />
                                <span className="text-white-50">(0251) 8621234</span>
                            </li>
                            <li className="mb-3 d-flex">
                                <FaEnvelope className="me-2 mt-1 text-primary" />
                                <span className="text-white-50">info@klinikipb.ac.id</span>
                            </li>
                            <li className="mb-3 d-flex">
                                <FaClock className="me-2 mt-1 text-primary" />
                                <span className="text-white-50">
                                    24 Jam (IGD) · 08:00–20:00 (Poli)
                                </span>
                            </li>
                        </ul>
                    </Col>

                    {/* JAM PRAKTEK */}
                    <Col md={3} className="mb-4">
                        <h5 className="mb-3 text-white">Jam Praktek Dokter</h5>
                        <ul className="list-unstyled text-white-50">
                            <li className="mb-2">Senin - Jumat: 08:00 - 16:00</li>
                            <li className="mb-2">Sabtu: 08:00 - 14:00</li>
                            <li className="mb-2">Minggu & Libur Nasional: 09:00 - 12:00</li>
                            <li className="mb-2 mt-3 text-warning fw-semibold">
                                IGD: 24 Jam Non-stop
                            </li>
                        </ul>
                    </Col>
                </Row>

                <hr className="border-secondary my-4" />

                <Row>
                    <Col className="text-center text-white-50">
                        <small>
                            &copy; {new Date().getFullYear()} Klinik Pratama IPB.  
                            All rights reserved. Developed for RPL Project.
                        </small>
                    </Col>
                </Row>
            </Container>
        </footer>
    );
};

export default Footer;
