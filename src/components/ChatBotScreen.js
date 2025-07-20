import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './ChatBotScreen.css';

const ChatBotScreen = ({ toggleSidebar }) => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const [showImagePreview, setShowImagePreview] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const { currentUser } = useAuth();

    useEffect(() => {
        // Add welcome message
        setMessages([{
            id: 1,
            text: "Hello! I'm your AI assistant. How can I help you today? You can ask me questions, upload images for analysis, or just have a conversation!",
            isUser: false,
            timestamp: new Date()
        }]);
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const sendMessage = async () => {
        if (!inputMessage.trim() && !selectedImage) return;

        const userMessage = {
            id: Date.now(),
            text: inputMessage.trim(),
            isUser: true,
            timestamp: new Date(),
            image: selectedImage
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setSelectedImage(null);
        setShowImagePreview(false);
        setIsLoading(true);

        try {
            // This is a mock AI response. In a real app, you'd integrate with an AI service
            const aiResponse = await generateAIResponse(userMessage.text, selectedImage);

            const botMessage = {
                id: Date.now() + 1,
                text: aiResponse,
                isUser: false,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error('Error getting AI response:', error);
            const errorMessage = {
                id: Date.now() + 1,
                text: "I'm sorry, I'm having trouble processing your request right now. Please try again later.",
                isUser: false,
                timestamp: new Date(),
                isError: true
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Mock AI response function - replace with actual AI service
    const generateAIResponse = async (text, image) => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        if (image) {
            return "I can see you've shared an image with me! While I can't actually analyze images in this demo, in a real implementation, I would be able to describe what I see, answer questions about the image, or help you with image-related tasks.";
        }

        // Simple response logic based on keywords
        const lowerText = text.toLowerCase();

        if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
            return `Hello ${currentUser?.displayName || 'there'}! Nice to meet you. What would you like to talk about today?`;
        }

        if (lowerText.includes('help') || lowerText.includes('what can you do')) {
            return "I can help you with a variety of tasks:\n\n• Answer questions on various topics\n• Analyze images you upload\n• Provide explanations and tutorials\n• Help with creative writing\n• Assist with problem-solving\n• Have casual conversations\n\nWhat would you like to explore?";
        }

        if (lowerText.includes('time') || lowerText.includes('date')) {
            const now = new Date();
            return `The current time is ${now.toLocaleTimeString()} and today's date is ${now.toLocaleDateString()}.`;
        }

        if (lowerText.includes('weather')) {
            return "I don't have access to real-time weather data in this demo, but I'd be happy to help you find weather information or discuss weather-related topics!";
        }

        if (lowerText.includes('joke') || lowerText.includes('funny')) {
            const jokes = [
                "Why don't scientists trust atoms? Because they make up everything!",
                "Why did the scarecrow win an award? He was outstanding in his field!",
                "Why don't eggs tell jokes? They'd crack each other up!",
                "What do you call a fake noodle? An impasta!"
            ];
            return jokes[Math.floor(Math.random() * jokes.length)];
        }

        // Default responses
        const responses = [
            "That's interesting! Could you tell me more about that?",
            "I understand what you're saying. How can I help you with this?",
            "Thanks for sharing that with me. What would you like to know?",
            "That's a great question! Let me think about that...",
            "I appreciate you bringing this up. How can I assist you further?"
        ];

        return responses[Math.floor(Math.random() * responses.length)];
    };

    const handleImageSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setSelectedImage({
                    file: file,
                    url: e.target.result,
                    name: file.name
                });
                setShowImagePreview(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeSelectedImage = () => {
        setSelectedImage(null);
        setShowImagePreview(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const formatTime = (timestamp) => {
        return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="chatbot-screen">
            <div className="chatbot-header">
                <div className="bot-info">
                    <div className="bot-avatar">🤖</div>
                    <div className="bot-details">
                        <h3>AI Assistant</h3>
                        <span className="bot-status">Online</span>
                    </div>
                </div>
                <div className="header-actions">
                    <button className="action-btn" title="Clear chat">
                        🗑️
                    </button>
                </div>
            </div>

            <div className="messages-container">
                {messages.map(message => (
                    <div key={message.id} className={`message ${message.isUser ? 'user' : 'bot'} ${message.isError ? 'error' : ''}`}>
                        <div className="message-avatar">
                            {message.isUser ? (
                                <img
                                    src={currentUser?.photoURL || '/default-avatar.png'}
                                    alt="User"
                                    onError={(e) => {
                                        e.target.src = '/default-avatar.png';
                                    }}
                                />
                            ) : (
                                <div className="bot-avatar-small">🤖</div>
                            )}
                        </div>
                        <div className="message-content">
                            {message.image && (
                                <div className="message-image">
                                    <img src={message.image.url} alt={message.image.name} />
                                </div>
                            )}
                            <div className="message-text">
                                {message.text.split('\n').map((line, index) => (
                                    <div key={index}>{line}</div>
                                ))}
                            </div>
                            <div className="message-time">
                                {formatTime(message.timestamp)}
                            </div>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="message bot">
                        <div className="message-avatar">
                            <div className="bot-avatar-small">🤖</div>
                        </div>
                        <div className="message-content">
                            <div className="typing-indicator">
                                <div className="typing-dots">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                                <span className="typing-text">AI is thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {showImagePreview && selectedImage && (
                <div className="image-preview">
                    <div className="preview-content">
                        <img src={selectedImage.url} alt={selectedImage.name} />
                        <button className="remove-image" onClick={removeSelectedImage}>×</button>
                    </div>
                </div>
            )}

            <div className="chat-input-container">
                <div className="input-wrapper">
                    <button
                        className="attach-btn"
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach image"
                    >
                        📎
                    </button>
                    <textarea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                        className="message-input"
                        rows="1"
                    />
                    <button
                        className="send-btn"
                        onClick={sendMessage}
                        disabled={!inputMessage.trim() && !selectedImage}
                    >
                        ➤
                    </button>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                />
            </div>

            <div className="chatbot-footer">
                <p>AI Assistant powered by advanced language models. Responses may not always be accurate.</p>
            </div>
        </div>
    );
};

export default ChatBotScreen;
