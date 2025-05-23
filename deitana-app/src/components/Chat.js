import React, { useState, useRef, useEffect } from 'react';

function Chat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Función para enviar mensaje de nueva conexión
    const sendNewConnectionMessage = async () => {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: 'NUEVA_CONEXION' }),
            });
            const data = await response.json();
            if (data.success) {
                setMessages([{
                    text: data.data.message,
                    isUser: false
                }]);
            }
        } catch (error) {
            console.error('Error al iniciar la conversación:', error);
        }
    };

    // Efecto para enviar mensaje de nueva conexión al montar el componente
    useEffect(() => {
        sendNewConnectionMessage();
    }, []);

    // ... resto del código existente ...
}

export default Chat; 