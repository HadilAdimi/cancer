import { useEffect, useState, useRef } from "react";

export default function MessageModal({ patient, token, onClose, onMessageSent }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    fetchMessages();
  }, [patient._id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`http://localhost:5000/patients/messages/doctor/${patient._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages(data);
      
      // Mark messages as read
      await fetch(`http://localhost:5000/patients/messages/doctor/${patient._id}/read`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setLoading(false);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const res = await fetch(`http://localhost:5000/patients/messages/doctor/${patient._id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: newMessage })
      });

      const data = await res.json();
      setMessages([...messages, data.data]);
      setNewMessage("");
      
      if (onMessageSent) onMessageSent();
    } catch (err) {
      console.log(err);
      alert("Failed to send message");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="message-modal">
        <div className="message-modal-header">
          <h2>Messages with {patient.name}</h2>
          <button className="closebtn" onClick={onClose}>✕</button>
        </div>

        <div className="message-modal-body">
          {loading ? (
            <div className="loading-messages">Loading messages...</div>
          ) : (
            <div className="message-list">
              {messages.length === 0 ? (
                <div className="empty-messages">
                  <p>No messages yet.</p>
                  <small>Send a message to start the conversation.</small>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message._id}
                    className={`message-item ${message.sender === "doctor" ? "doctor-msg" : "patient-msg"}`}
                  >
                    <div className="message-sender">
                      {message.sender === "doctor" ? "You (Doctor)" : patient.name}
                    </div>
                    <div className="message-text">{message.text}</div>
                    <div className="message-time">
                      {new Date(message.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <form onSubmit={sendMessage} className="message-modal-footer">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="message-input"
          />
          <button type="submit" className="send-btn">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}