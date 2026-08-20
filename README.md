# 🎙️ Verova Voice Agent • Hinglish AI Receptionist

An AI voice receptionist web application inspired by **Sarvam AI**, designed with a natural, conversational **Hinglish** (Hindi + English mix) persona. The agent follows strict appointment booking rules with step-by-step slot verification and booking tools, powered by **Groq (Llama 3.1)** and **Microsoft Edge-TTS (Swara & Madhur Neural Voices)**.

---

## 🌟 Key Features

1. **Sarvam AI Visual Theme & 3D Voice Orb**:
   - Modern dark glassmorphism interface with deep slate `#060911`, Saffron amber glow `#f59e0b`, and neon indigo `#6366f1`.
   - Real-time **Canvas 3D Voice Orb** with dynamic audio wave ripples and orbiting particle fields that respond to microphone audio frequencies and speech synthesis.
   - Animated Soundwave Equalizer bars synchronized with voice output.

2. **Strict Hinglish Conversational Receptionist Workflow**:
   - **Rule 1 (Concise):** Spoken audio format (maximum 1–2 short sentences per turn).
   - **Rule 2 (No Markdown):** Zero bold (`*`), hashtags (`#`), or bullet points in spoken responses.
   - **Rule 3 (One at a time):** Asks for one piece of missing information at a time.
   - **Rule 4 (No assumptions):** Strictly calls `CheckAvailability` before asking for user name.
   - **7-Step Workflow**: Greet $\rightarrow$ Collect Date $\rightarrow$ Collect Time $\rightarrow$ Check Availability $\rightarrow$ Collect Name $\rightarrow$ Book Appointment $\rightarrow$ Confirmation & Goodbye.

3. **Tool Calling Integration**:
   - 🛠️ `CheckAvailability({ date, time })`: Verifies slot availability against doctor schedule (e.g. 1:00 PM lunch break is unavailable, 2:00 PM is available).
   - 📝 `BookAppointment({ name, date, time })`: Generates reference number (e.g. `BK-8942`), adds to live schedule, and creates a booking confirmation badge.

4. **Dual TTS & Voice Engine**:
   - **Edge-TTS Backend:** Microsoft Azure / Edge Neural Voices (`hi-IN-SwaraNeural` warm female receptionist and `hi-IN-MadhurNeural` clear male receptionist).
   - **Browser Fallback:** Zero-configuration Indian English / Hindi voice synthesis with Web Speech API.

5. **Built-in Smart Offline Engine**:
   - Runs out-of-the-box immediately without needing an external API key, using intelligent Hinglish NLP entity parsing for dates (*kal, aaj, 21 August, Monday*), times (*2 baje, 10 am, dopahar 2 baje*), and names (*Rahul, Amit, Pooja*).
   - Optional **Groq API Key** integration for high-speed Llama 3.1 70B/8B intelligence.

---

## 🚀 How to Run

### Option 1: Run with Python Server (Recommended for High-Fidelity Neural Voices)
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Start the async server:
   ```bash
   python server.py
   ```
3. Open your browser at:
   👉 **`http://localhost:8000`**

### Option 2: Standalone Browser Launch (Zero Installation)
Simply open `index.html` directly in Google Chrome, Microsoft Edge, or Brave:
👉 Double click `index.html`

---

## 📁 Project Structure

```
Verova-voice-agent/
│
├── index.html        # Glassmorphic Sarvam UI layout, Voice Orb, Transcript & Drawer
├── style.css         # Dark futuristic styling, animations, and responsive layout
├── app.js            # Audio visualizer, STT, Groq Llama 3.1 + Tool Calling, and TTS Player
├── server.py         # Async Python server with Microsoft Edge-TTS streaming endpoint
├── requirements.txt  # Python package dependencies (aiohttp, edge-tts)
├── .gitignore        # Standard ignore file
└── README.md         # Documentation and setup instructions
```

---

## 📄 License
MIT License
