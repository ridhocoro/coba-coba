import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import {
    FaMapMarkerAlt,
    FaPhone,
    FaEnvelope,
    FaWhatsapp,
    FaInstagram,
    FaYoutube
} from 'react-icons/fa';

const Footer = () => {
    return (
        <footer className="bg-dark text-light pt-5 pb-5">
            <Container>
                <Row className="g-4">
                    {/* INFORMASI KONTAK */}
                    <Col lg={5} md={6} className="mb-4">
                        <h5 className="text-white mb-4 fw-bold border-bottom border-primary pb-2">
                            Informasi Kontak
                        </h5>
                        
                        {/* Alamat */}
                        <div className="d-flex mb-3">
                            <div className="me-3 mt-1">
                                <FaMapMarkerAlt className="text-primary" size={20} />
                            </div>
                            <div>
                                <span className="text-white-50">
                                    Jl. Raya Dramaga, Babakan, Kecamatan Dramaga, Kabupaten Bogor, Jawa Barat 16680<br />
                                    
                                </span>
                            </div>
                        </div>
                        
                        {/* Telepon */}
                        <div className="d-flex mb-3">
                            <div className="me-3 mt-1">
                                <FaPhone className="text-primary" size={18} />
                            </div>
                            <div>
                                <span className="text-white-50">(62251) 8422094</span>
                            </div>
                        </div>
                        
                        {/* WhatsApp */}
                        <div className="d-flex mb-3">
                            <div className="me-3 mt-1">
                                <FaWhatsapp className="text-primary" size={20} />
                            </div>
                            <div>
                                <a 
                                    href="https://wa.me/62087775692881" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-white-50 text-decoration-none hover-link"
                                >
                                    wa.me/62087775692881
                                </a>
                            </div>
                        </div>
                        
                        {/* Email */}
                        <div className="d-flex mb-3">
                            <div className="me-3 mt-1">
                                <FaEnvelope className="text-primary" size={18} />
                            </div>
                            <div>
                                <a 
                                    href="mailto:unitkesehatan@apps.ipb.ac.id"
                                    className="text-white-50 text-decoration-none hover-link"
                                >
                                    unitkesehatan@apps.ipb.ac.id
                                </a>
                            </div>
                        </div>
                        
                       
                        
                        {/* Google Maps Link */}
                        <div className="d-flex mt-4">
                            <div className="me-3">
                                <FaMapMarkerAlt className="text-primary" size={18} />
                            </div>
                            <div>
                                <a 
                                    href="https://maps.app.goo.gl/wwn2wrBvhZ4pz6GZA" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary text-decoration-none fw-semibold hover-link"
                                >
                                    🗺️ Buka di Google Maps
                                </a>
                            </div>
                        </div>
                    </Col>

                    {/* SOSIAL MEDIA */}
                    <Col lg={4} md={6} className="mb-4">
                        <h5 className="text-white mb-4 fw-bold border-bottom border-primary pb-2">
                            Ikuti Kami
                        </h5>
                        
                        {/* Instagram */}
                        <div className="d-flex align-items-center mb-4">
                            <div 
                                className="bg-gradient rounded-circle p-3 me-3 d-flex align-items-center justify-content-center"
                                style={{ 
                                    background: 'linear-gradient(45deg, #f09433, #d62976, #962fbf)',
                                    width: '50px',
                                    height: '50px'
                                }}
                            >
                                <FaInstagram className="text-white" size={24} />
                            </div>
                            <div>
                                <a 
                                    href="https://www.instagram.com/klinikipbdramaga/" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-white-50 text-decoration-none hover-link"
                                >
                                    @klinikipbdramaga
                                </a>
                                <div className="text-white-50 small">Instagram</div>
                            </div>
                        </div>
                        
                        {/* YouTube */}
                        <div className="d-flex align-items-center">
                            <div 
                                className="bg-danger rounded-circle p-3 me-3 d-flex align-items-center justify-content-center"
                                style={{ width: '50px', height: '50px' }}
                            >
                                <FaYoutube className="text-white" size={24} />
                            </div>
                            <div>
                                <a 
                                    href="https://www.youtube.com/channel/UCAwWzV9hjGZuSZjyk-gSw_Q" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-white-50 text-decoration-none hover-link"
                                >
                                    Klinik IPB Dramaga
                                </a>
                                <div className="text-white-50 small">YouTube Channel</div>
                            </div>
                        </div>
                        
                        {/* Google Maps Embed Kecil (opsional) */}
                        <div className="mt-4 pt-3">
                            <div className="rounded-3 overflow-hidden border border-secondary" style={{ height: '120px' }}>
                                <iframe
                                    title="Lokasi Klinik IPB Dramaga"
                                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3963.487519438755!2d106.726537!3d-6.559501!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69c3d1b3b3b3b3%3A0x3b3b3b3b3b3b3b3b!2sKampus%20IPB%20Dramaga!5e0!3m2!1sid!2sid!4v1234567890!5m2!1sid!2sid"
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    allowFullScreen=""
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                />
                            </div>
                        </div>
                    </Col>

                    {/* JAM OPERASIONAL (RINGKASAN) */}
                    <Col lg={3} md={12} className="mb-4">
                        <h5 className="text-white mb-4 fw-bold border-bottom border-primary pb-2">
                            Jam Pelayanan
                        </h5>
                        
                        <div className="bg-secondary bg-opacity-10 p-4 rounded-4">
                            <div className="mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="text-white">Senin - Jumat</span>
                                    <span className="text-primary fw-semibold">08.00 - 20.00</span>
                                </div>
                                <div className="progress" style={{ height: '4px' }}>
                                    <div className="progress-bar bg-primary" style={{ width: '100%' }}></div>
                                </div>
                            </div>
                            
                            <div className="mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="text-white">Sabtu</span>
                                    <span className="text-primary fw-semibold">08.00 - 18.00</span>
                                </div>
                                <div className="progress" style={{ height: '4px' }}>
                                    <div className="progress-bar bg-primary" style={{ width: '85%' }}></div>
                                </div>
                            </div>
                            
                            <div className="mt-4 p-3 bg-primary bg-opacity-25 rounded-3">
                                <small className="text-white fw-semibold d-block text-center">
                                    🕒 Hari Minggu & Libur Nasional: Tutup
                                </small>
                            </div>
                        </div>
                        
                        {/* Kontak Darurat */}
                        <div className="mt-3 text-center">
                            <small className="text-white-50">
                                <FaPhone className="text-primary me-1" size={12} />
                                Darurat: 087775692881
                            </small>
                        </div>
                    </Col>
                </Row>

                <hr className="border-secondary my-4" />

                <Row>
                    <Col className="text-center">
                        <small className="text-white-50">
                            © 2026 Klinik IPB Dramaga. All Rights Reserved.
                        </small>
                    </Col>
                </Row>
            </Container>

            <style jsx="true">{`
                @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
                * { font-family: 'Poppins', sans-serif !important; }
                                .hover-link {
                    transition: color 0.3s ease;
                }
                .hover-link:hover {
                    color: #0d6efd !important;
                    text-decoration: underline !important;
                }
                .bg-gradient {
                    background: linear-gradient(45deg, #f09433, #d62976, #962fbf);
                }
                .progress {
                    background-color: rgba(255,255,255,0.1);
                }
            `}</style>
        </footer>
    );
};

export default Footer;