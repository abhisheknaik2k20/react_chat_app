import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
    return (
        <div className="landing-page">
            <header className="landing-header">
                <nav className="landing-nav">
                    <div className="nav-logo">
                        <h2>ChatApp</h2>
                    </div>
                    <div className="nav-links">
                        <Link to="/auth" className="nav-link">Get Started</Link>
                    </div>
                </nav>
            </header>

            <main className="landing-main">
                <section className="hero-section">
                    <div className="hero-content">
                        <h1 className="hero-title">
                            Professional messaging
                            <br />
                            <span className="hero-highlight">for modern teams</span>
                        </h1>
                        <p className="hero-description">
                            ChatApp is an enterprise-grade, real-time messaging platform built with React and Firebase.
                            Streamline communication and enhance collaboration with advanced features and robust security.
                        </p>
                        <div className="hero-buttons">
                            <Link to="/auth" className="btn btn-primary">
                                Get Started
                            </Link>
                            <a href="#features" className="btn btn-secondary">
                                Learn More
                            </a>
                        </div>
                    </div>
                    <div className="hero-visual">
                        <div className="chat-preview">
                            <div className="chat-window">
                                <div className="chat-header">
                                    <div className="chat-title">General Chat</div>
                                    <div className="chat-status">
                                        <span className="status-dot"></span>
                                        3 online
                                    </div>
                                </div>
                                <div className="chat-messages">
                                    <div className="message">
                                        <div className="message-avatar">A</div>
                                        <div className="message-content">
                                            <div className="message-bubble">
                                                Hey everyone! Welcome to the team.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="message">
                                        <div className="message-avatar">B</div>
                                        <div className="message-content">
                                            <div className="message-bubble">
                                                Hello Alice! How's your day going?
                                            </div>
                                        </div>
                                    </div>
                                    <div className="message">
                                        <div className="message-avatar">C</div>
                                        <div className="message-content">
                                            <div className="message-bubble">
                                                Great to see you all here! Ready for the project kickoff.</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="chat-input">
                                    <input type="text" placeholder="Type a message..." />
                                    <button>Send</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>


            </main>

            <footer className="landing-footer">
                <div className="footer-content">
                    <p>&copy; 2025 ChatApp. Enterprise messaging solution built with React and Firebase.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
