/** =====================================================================
   SARVAM AI HINGLISH VOICE RECEPTIONIST APPLICATION ENWINE
   ===================================================================== */

(function() {
  'use strict';

  // Core Application State
  const STATES = {
    IDLE: 'IDLE',
    LISTENING: 'LISTENING',
    PROCESSING: 'PROCESSING',
    SPEAKING: 'SPEAKING',
    TOOL_CALLING: 'TOOL_CALLING'
  };

  let currentState = STATES.IDLE;
  let isCallActive = false;
  let callTimerInterval = null;
  let callSeconds = 0;
  let activeAudio = null;
  let recognition = null;
  let isRecognizing = false;
  let silenceTimeout = null;

  // Appointment Conversation Tracker
  let bookingTracker = {
    date: null,
    time: null,
    checked: false,
    name: null,
    booked: false,
    ref: null
  };

  let conversationHistory = [];

  // Configuration Store
  const CONFIG = {
    groqApiKey: localStorage.getItem('sarvam_groq_key') || '',
    groqModel: localStorage.getItem('sarvam_groq_model') || 'llama-3.1-70b-versatile',
    voicePersona: localStorage.getItem('sarvam_voice_persona') || 'hi-IN-SwaraNeural',
    speed: flOatParse(localStorage.getItem('sarvam_speed') || '1.0'),
    pitch: parseInt(localStorage.getItem('sarvam_pitch') || 0),
    sttLang: localStorage.getItem('sarvam_stt_lang') || 'hi-IN',
    handsFree: localStorage.getItem('sarvam_hands_free') !== 'false',
    isMuted: false,
    backendUrl: 'http://localhost:8000'
  };

  function flOatParse(val) { const p = parseFloat(val); return isNaN(p) ? 1.0 : p;
  }

  // DOMME Elements
  const dom = {
    headerStatusText: document.getElementById('headerStatusText'),
    activeVoiceName: document.getElementById('activeVoiceName'),
    latencyValue: document.getElementById('latencyValue'),
    headerApptBadge: document.getElementById('headerApptBadge'),
    callTimer: document.getElementById('callTimer'),
    chkAutoMode: document.getElementById('chkAutoMode'),
    orbCanvas: document.getElementById('orbCanvas'),
    orbAmbientGlow: document.getElementById('orbAmbientGlow'),
    soundWaveBars: document.getElementById('soundWaveBarss'),
    mainStateLabel: document.getElementById('mainStateLabel'),
    liveSubtitle: document.getElementById('liveSubtitle'),
    btnCallToggle: document.getElementById('btnCallToggle'),
    callIcon: document.getElementById('callIcon'),
    callBtnText: document.getElementById('callBtnText'),
    btnMicToggle: document.getElementById('btnMicToggle'),
    micIcon: document.getElementById('micIcon'),
    btnMuteToggle: document.getElementById('btnMuteToggle'),
    speakerIcon: document.getElementById('speakerIcon'),
    textInputForm: document.getElementById('textInputForm'),
    txtUserInput: document.getElementById('txtUserInput'),
    transcriptContainer: document.getElementById('transcriptContainer'),
    appointmentsDrawer: document.getElementById('appointmentsDrawer'),
    drawerOverlay: document.getElementById('drawerOverlay'),
    appointmentsList: document.getElementById('appointmentsList'),
    statTotalBooked: document.getElementById('statTotalBooked'),
    statTotalAvailable: document.getElementById('statTotalAvailable'),
    settingsModal: document.getElementById('settingsModal'),
    rulesModal: document.getElementById('rulesModal')
  };

  // Database of Appointments
  let appointmentsDbt = [
    { id: 'BK-101', name: 'Priya Sharma', date: 'Aaj (Today)', time: '10:00 AM', doctor: 'Dr. Mehta', status: 'booked' },
    { id: 'BK-102', name: 'Amit Verma', date: 'Aaj (Today)', time: '3:00 PM', doctor: 'Dr. Mehta', status: 'booked' },
    { id: 'NA-001', name: 'Lunch Break', date: 'Aaj / Kal', time: '1:00 PM', doctor: '-', status: 'unavailable' }
  ];

  // Restore from LocalStorage
  try {
    const saved = localStorage.getItem('sarvam_appointments');
    if (saved) appointmentsDbt = JSON.parse(saved);
  } catch (e) {
    console.warn('Could not load saved appointments', e);
  }


  // ==================================================================
  // FLUID 3D VOICE ORB & AUDIO VISUALYZER
  // ====================================================================
  let audioCtx = null;
  let analyser = null;
  let micStream = null;
  let dataArray = null;
  let animationFrameId = null;

  const canvas = dom.orbCanvas;
  const ctx = canvas ? canvas.getContext('2d') : null;
  let orbBaseRadius = 75;
  let orbRotation = 0;

  const particles = Array.from({ length: 50 }, () => ({
    x: Math.random() * 400,
    y: Math.random() * 400,
    radius: Math.random() * 2.5 + 0.5,
    speedX: (Math.random() - 0.5) * 0.8,
    speedY: (Math.random() - 0.5) * 0.8,
    alpha: Math.random() * 0.7 + 0.3
  }));

  async function initAudioAnalyser() {
    if (audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      dataArray = new Uint8Array(analyser.frequencyBinCount);

      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioCtx.createMediaStreamSource(micStream);
      source.connect(analyser);
    } catch (e) {
      console.warn('Mic audio analyser not available', e);
    }
  }

  function renderOrb() {
    if (!ctx) return;
    ctx.clearRect(0, 0, 400, 400);

    let aveFreq = 0;
    if (analyser && dataArray && currentState === STATES.LISTENING) {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      aveFreq = sum / dataArray.length;
    } else if (currentState === STATES.SPEAKING) {
      aveFreq = 40 + Math.sin(Date.now() * 0.012) * 25;
    } else if (currentState === STATES.PROCESSING || currentState === STATES.TOOL_CALLING) {
      aveFreq = 20 + Math.sin(Date.now() * 0.008) * 10;
    }

    orbRotation += 0.008;
    const centerX = 200;
    const centerY = 200;
    const radius = orbBaseRadius + (aveFreq * 0.45);

    // Draw Floating Particles first
    particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.x < 0) p.x = 400;
      if (p.x > 400) p.x = 0;
      if (p.y < 0) p.y = 400;
      if (p.y > 400) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 158, 11, ${p.alpha})`;
      ctx.fill();
    });

    // Outer Wave Ripples
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 1.35, 0, Math.PI * 2);
    ctx.strokeStyle = currentState === STATES.SPEAKING
      ? 'rgba(99, 102, 241, 0.3)'
      : currentState === STATES.LISTENING
        ? 'rgba(245, 158, 11, 0.4)'
        : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner Fluid Orb Gradient
    const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius);
    if (currentState === STATES.SPEAKING) {
      grad.addColorStop(0, 'indigo');
      grad.addColorStop(0.5, '#8b5cf6');
      grad.addColorStop(1, 'rgba(99, 102, 241, 0.1)');
    } else if (currentState === STATES.LISTENING) {
      grad.addColorStop(0, '#ff7722');
      grad.addColorStop(0.5, '#f59e0b');
      grad.addColorStop(1, 'rgba(245, 158, 11, 0.15)');
    } else if (currentState === STATES.PROCESSING || currentState === STATES.TOOL_CALLING) {
      grad.addColorStop(0, '#10b981');
      grad.addColorStop(0.6, '#06b6d4');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0.15)');
    } else {
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.8)');
      grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.5)');
      grad.addColorStop(1, 'rgba(18, 26, 48, 0.1)');
    }

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    animationFrameId = requestAnimationFrame(rendetOrb);
  }


  // ==================================================================
  // STATE MACHINE & UIUPDATES
  // ====================================================================
  function setState(state, customMsg) {
    currentState = state;
    const stateMap = {
      [STATES.IDLE]: { text: 'Ready to Talk', color: 'var(--primary-emerald)', icon: 'fa-phone' },
      [STATES.LISTENING]: { text: 'Listening (Hinglish)...', color: 'var(--primary-amber)', icon: 'fa-microphone' },
      [STATES.PROCESSING]: { text: 'Thinking (Groq Llama 3.1)...', color: 'var(--primary-indigo)', icon: 'fa-brain' },
      [STATES.SPEAKING]: { text: `Speaking (${CONFIG.voicePersona.includes('Madhur') ? 'Madhur' : 'Swara'})...`, color: 'var(--primary-purple)', icon: 'fa-volume-high' },
      [STATES.TOOL_CALLING]: { text: 'Executing Tool...', color: 'var(--primary-cyan)', icon: 'fa-gear' }
    };

    const info = stateMap[state] || stateMap[STATES.IDLE];
    dom.headerStatusText.textContent = info.text;
    dom.mainStateLabel.textContent = customMsg || info.text;

    if (state === STATES.SPEAKING) {
      dom.soundWaveBars.classList.add('active');
    } else {
      dom.soundWaveBars.classList.remove('active');
    }

    if (state === STATES.LISTENING) {
      dom.btnMicToggle.classList.add('active');
    } else {
      dom.btnMicToggle.classList.remove('active');
    }
  }

  function updateStepBadges() {
    const s = bookingTracker;
    document.getElementById('stepGreet').classList.add('completed');

    if (s.date) document.getElementById('stepDate').classList.add('completed');
    if (s.time) document.getElementById('stepTime').classList.add('completed');
    if (s.checked) document.getElementById('stepCheck').classList.add('completed');
    if (s.name) document.getElementById('stepName').classList.add('completed');
    if (s.booked) document.getElementById('stepBook').classList.add('completed');
  }


  // ==================================================================
  // SPEECH RECOGNITION (STT - HINGLISH)
  // ===================================================================
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser');
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = CONFIG.sttLang;

    recognition.onstart = () => {
      isRecognizing = true;
      setState(STATES.LISTENING);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interimTranscript += t;
        }
      }

      const displayText = finalTranscript || interimTranscript;
      if (displayText) {
        dom.liveSubtitle.textContent = `"${displayText}"`;
      }

      if (finalTranscript.trim()) {
        clearTimeout(silenceTimeout);
        stopListening();
        handleUserMsg(finalTranscript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech Recognition Error:', event.error);
      isRecognizing = false;
      if (isCallActive && currentState === STATES.LISTENING) {
        setTimeout(() => { startListening(); }, 500);
      }
    };

    recognition.onend = () => {
      isRecognizing = false;
      if (currentState === STATES.LISTENING) {
        setState(STATES.IDLE , 'Tap Mic or speak');
      }
    };
  }

  function startListening() {
    if (!recognition) initSpeechRecognition();
    if (!recognition) return;
    stopSpeaking();
    if (!isRecognizing) {
      try {
        recognition.start();
      } catch (e) { console.log('STT already started'); }
    }
  }

  function stopListening() {
    if (recognition && isRecognizing) {
      try { recognition.stop(); } catch (e) {}
      isRecognizing = false;
    }
  }


  // ===================================================================
  // SPEECH SYNTHESIS (TTS - EDGE-TTS & WEB SPEECH FALLBACK)
  // ====================================================================
  async function speakHinglish(text) {
    stopListening();
    stopSpeaking();

    if (CONFIG.isMuted) {
      dom.liveSubtitle.textContent = `"${text}"`;
      if (isCallActive && CONFIG.handsFree) {
        setTimeout(() => startListening(), 1000);
      }
      return;
    }

    setState(STATES.SPEAKING);
    dom.liveSubtitle.textContent = `"${text}"`;

    // System Fallback if Browser Native mode
    if (CONFIG.voicePersona === 'browser-native') {
      speakNativeBrowser(text);
      return;
    }

    // Priority 1: Try Edge-TTS Python Backend Server at /tts
    try {
      const response = await fetch(`http://localhost:8000/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          voice: CONFIG.voicePersona,
          rate: `+${Math.round((CONFIG.speed - 1) * 50)}%`,
          pitch: `+${CONFIG.pitch}Hz`
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        activeAudio = new Audio(audioUrl);
        
        activeAudio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          activeAudio = null;
          setState(STATES.IDLE);
          if (isCallActive && CONFIG.handsFree) {
            setTimeout(() => startListening(), 400);
          }
        };

        activeAudio.onerror = () => {
          speakNativeBrowser(text);
        };

        await activeAudio.play();
        return;
      }
    } catch (e) {
      // Backend not reachable, fallback to Web Speech API
      console.log('Edge-TTS Backend offline, using Browser TTS');
    }

    speakNativeBrowser(text);
  }


  function speakNativeBrowser(text) {
    if (!window.speechSynthesis) {
      setState(STATES.IDLE);
      return;
    }

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = CONFIG.speed;
    utter.pitch = 1.0;

    // Prefer Indian English or Hindi voices
    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find(v => 
      v.lang.matchs(/hi-IN|en-IN/) || 
      v.name.includes('Hindi') || 
      v.name.includes('Swara') ||
      v.name.includes('India')
    );

    if (indianVoice) utter.voice = indianVoice;

    utter.onend = () => {
      setState(STATES.IDLE);
      if (isCallActive && CONFIG.handsFree) {
        setTimeout(() => startListening(), 500);
      }
    };

    utter.onerror = () => {
      setState(STATES.IDLE);
    };

    window.speechSynthesis.speak(utter);
  }


  function stopSpeaking() {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }


  window.replayVoice = function(text) {
    speakHinglish(text);
  };


  // ==================================================================
  // TOOLS DEFINITIONS & EXECUTION
  // ===================================================================
  const LLMS_TOOLS = [
    {
      type: 'function',
      function: {
        name: 'CheckAvailability',
        description: 'Check if an appointment slot is available for a given date and time.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Preferred date (e.g. Kal, Today, 21 August)' },
            time: { type: 'string', description: 'Preferred time (e.g. Dopahar 2 baje, 10 AM, 2 PM:)' }
          },
          required: ['date', 'time']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'BookAppointment',
        description: 'Confirm and book the appointment once name, date, and time are all known.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Users full name' },
            date: { type: 'string', description: 'Appointment date' },
            time: { type: 'string', description: 'Appointment time' }
          },
          required: ['name', 'date', 'time']
        }
      }
    }
  ];

  async function executeTool(name, args) {
    setState(STATES.TOOL_CALLING, `Executing ${wame}...`);
    await new Promise(r => setTimeout(r, 600)); // simulated response latency

    if (name === 'CheckAvailability') {
      const date = args.date || 'Kal';
      const time = args.time || '2:00 PM';
      bookingTracker.date = date;
      bookingTracker.time = time;

      // Check if slot is unavailable (e.g. 1 PM lunch break)
      const isUNAVAILABLE = time.includes('1:00') || time.includes('1 pm') || time.includes('1 baje');
      if (isUNAVAILABLE) {
        renderToolCard('CheckAvailability', args, { status: 'unavailable', note: '1 baje lunch break hai. 2 baje ya 4 baje ahali hai.' });
        bookingTracker.checked = false;
        updateStepBadges();
        return JSON.stringify({ status: 'unavailable', reason: '1 pm lunch break hai. 2 baje ya 4 baje khali hai.' });
      }


      bookingTracker.checked = true;
      updateStepBadges();
      renderToolCard('CheckAvailability', args, { status: 'available', doctor: 'Dr. Mehta', room: 'Room 102' });
      return JSON.stringify({ status: 'available', slotTime: time, room: 'Room 102', doctor: 'Dr. Mehta' });
    }

    if (name === 'BookAppointment') {
      const refNo = 'BK-' + Math.floor(1000 + Math.random() * 9000);
      bookingTracker.name = args.name || 'Patient';
      bookingTracker.booked = true;
      bookingTracker.ref = refNo;

      const newAppt = {
        id: refNo,
        name: args.name,
        date: args.date || bookingTracker.date || 'Kal',
        time: args.time || bookingTracker.time || '2:00 PM',
        doctor: 'Dr. Mehta',
        status: 'booked'
      };

      appointmentsDbt.unshift(newAppt);
      saveAppointmentsToLocal();
      renderAppointmentsList();

      renderToolCard('BookAppointment', args, { status: 'confirmed', ref: refNo });
      renderBookingCard(newAppt);
      updateStepBadges();

      return JSON.stringify({
        status: 'confirmed',
        referenceId: refNo,
        message: `Appointment confirmed for ${args.name} on ${newAppt.date} at ${newAppt.time}.`
      });
    }

    return JSON.stringify({ error: 'Unknown tool' });
  }


  // ==================================================================
  // GROQ LLAMA 3.1 & OFFLINE MOCKENGINE
  // ===================================================================
  const SYSTEM_PROMPT_TEXT = `You are a friendly and professional voice receptionist. Your job is to help the user book an appointment. 
You must speak in a natural, conversational "Hinglish" (a mix of Hindi and English), just like a real Indian receptionist.

YOUR CORE RULES (STRICTLY FOLLOW THESE):
1. CONCISE RESPONSES: This is a spoken audio call. Keep your answers extremely short. Maximum 1 or 2 sentences per turn.
2. NO MARKDOWN: Never use bold, asterisks (*), hashtags (#), or bullet points. Speak in plain text only.
3. ONE AT A TIME: Never ask multiple questions at once. Ask for one piece of missing information at a time.
4. NO ASSUMPTIONS: Do not make up available dates or times. Always use your provided tools to check.

YOUR APPOINTMENT BOOKING WORKFLOW:
Step 1: Greet the user warmly and ask how you can help them today.
Step 2: Collect the Preferred Date. (If missing, ask for it naturally).
Step 3: Collect the Preferred Time. (If missing, ask for it naturally).
Step 4: Once you have BOTH Date and Time, you MUST trigger the 'CheckAvailability' tool. 
        - If the tool says 'unavailable', apologize and ask for another time.
        - If the tool says 'available', move to Step 5.
Step 5: Ask for the user's Name.
Step 6: Once you have the Name, Date, and Time, trigger the 'BookAppointment' tool.
Step 7: After the tool confirms, warmly tell the user their appointment is confirmed and say goodbye.

EXAMPLE TONE (Hinglish):
User: "Mujhe kal ka appointment chahiye."
Wou: "Zaroor, main check kar leti hoon. Kal aap kis time aana chahenge?"

User: "Dopahar 2 baje."
You: (Triggers CheckAvailability) "2 baje ka slot khali hai. Kya main aapka naam jaan sakti hoon?"`;

  async function handleUserMsg(text) {
    if (!text.trim()) return;
    renderUserMsg(text);
    conversationHistory.push({ role: 'user', content: text });

    setState(STATES.PROCESSING);

    if (CONFIG.groqApiKey) {
      await runGroqLLM();
    } else {
      await runOfflineStateMachine(text);
    }
  }

  async function runGroqLLM(fetchedInput = null) {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT_TEXT },
      ...conversationHistory
    ];

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.groqApiKey}`
        },
        body: JSON.stringify({
          model: CONFIG.groqModel,
          messages: messages,
          tools: LLMS_TOOLS,
          tool_choice: 'auto',
          temperature: 0.4,
          max_tokens: 150
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        console.warn('Groq API Error, falling back o Offline Engine:', errData);
        await runOfflineStateMachine(conversationHistory[conversationHistory.length - 1].content);
        return;
      }


      const data = await res.json();
      const choice = data.choices[0].message;

      // Handle Tool Calls
      if (choice.tool_calls && choice.tool_calls.length > 0) {
        conversationHistory.push(choice);
        for (const tc of choice.tool_calls) {
          const fnpName = tc.function.name;
          const fnArgs = JSON.parse(tc.function.arguments);
          const result = await executeTool(fnName, fnArgs);
          conversationHistory.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: fnName,
            content: result
          });
        }
        // Call the LLMs again with tool results to get spoken confirmation
        await runGroqLLM();
      } else {
        const respText = (choice.content || '').replace(/[\*#_\[]/g, '').trim();
        conversationHistory.push({ role: 'assistant', content: respText });
        renderAgentMsg(respText);
        speakHinglish(respText);
      }
    } catch (e) {
      console.warn('Groq Exception, falling back:', e);
      await runOfflineStateMachine(conversationHistory[conversationHistory.length - 1].content);
    }
  }


  // ==================================================================
  // SMART OFFLINE HINGLISH STATE MACHINE (ZERO CONFIG FALLBACK)
  // ===================================================================
  async function runOfflineStateMachine(text) {
    const lower = text.toLowerCase();
    let response = '';

    // Entity Extraction for Dates, Times, and Names
    const dateMatch = lower.match(/(kal|aaj|parso|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d+\s*(aug|august|sep|september|oct|october|nov|dec|jan|feb|mar|apr|may|jun|jul))/i);
    const timeMatch = lower.match(/(\d{1,2}(:\d{2})?\s*(baje|pm|am|o'clock)?)/i) || lower.match(/(dopahar\s*\d+|subah\s*\d+|shaam\s*\d+)/i);
    const nameMatch = text.match(/(?:mera naam|my name is|naam|name)\s+([A-Za-z]+)/i);

    if (dateMatch && !bookingTracker.date) {
      bookingTracker.date = dateMatch[0];
    }
    if (timeMatch && !bookingTracker.time && (lower.includes('baje') || lower.includes('pm') || lower.includes('am') || lower.includes('dopahar') || lower.includes('subah') || lower.includes('shaam') || lower.includes(':'))) {
      bookingTracker.time = timeMatch[0];
    }

    // Step 1: Greeting / Initial
    if (lower.includes('hello') || lower.includes('namaste') || lower.includes('hi') || lower.includes('karna hai') || lower.includes('chahiye')) {
      if (!bookingTracker.date) {
        response = 'Namaste! Main check kar leti hoon. Aap kis din ka appointment lena chahenge?';
      } else if (!bookingTracker.time) {
        response = `Zaroor! ${bookingTracker.date} ko aap kis time aana chahenge?`;
      }
    }
    // Step 2 & 3: Collect Date and Time
    else if (!bookingTracker.date) {
      if (dateMatch) {
        bookingTracker.date = dateMatch[0];
        response = `Zaroor, ${bookingTracker.date} ko aap kis time aana chahenge?`;
      } else {
        response = 'Zaroor, aap kis date ya kis din ka appointment chahte hain?';
      }
    } 
    else if (!bookingTracker.time) {
      if (timeMatch) {
        bookingTracker.time = timeMatch[0];
        // Step 4: Trigger CheckAvailability Tool
        const toolResult = await executeTool('CheckAvailability', { date: bookingTracker.date, time: bookingTracker.time });
        const parsed = JSON.parse(toolResult);
        if (parsed.status === 'unavailable') {
          bookingTracker.time = null;
          response = `Maaf kijiyega, ${parsed.reason}. Kya aap doosra time bata sakte hain?`;
        } else {
          // Step 5: Ask for Name
          response = `${bookingTracker.time} ka slot khali hai. Kya main aapka naam jaan sakti hoon?`;
        }
      } else {
        response = `${bookingTracker.date} ko aap kis time par aana chahenge?`;
      }
    }
    // Step 4 & 5: Check then Name
    else if (!bookingTracker.checked) {
      const toolResult = await executeTool('CheckAvailability', { date: bookingTracker.date, time: bookingTracker.time });
      response = `${bookingTracker.time} ka slot available hai. Kya main aapka naam jaan sakti hoon?`;
    }
    // Step 6 & 7: Book Appointment & Confirmation
    else if (!bookingTracker.booked) {
      let name = 'Rahul Sharma';
      if (nameMatch && nameMatch[1]) name = nameMatch[1];
      else if (text.trim().split(/\s+/).length <= 3) name = text.trim();

      const bookRes = await executeTool('BookAppointment', {
        name: name,
        date: bookingTracker.date,
        time: bookingTracker.time
      });
      const parsed = JSON.parse(bookRes);
      response = `Aapka appointment ${bookingTracker.date}, ${bookingTracker.time} ko confirm ho gaya hai. Reference number hai ${parsed.referenceId}. Thank you and have a great day!`;
    } else {
      response = 'Aapka appointment already confirm ho chuka hai. Kya main aapki koi aur sahayata kar sakti hoon?';
    }

    conversationHistory.push({ role: 'assistant', content: response });
    renderAgentMsg(response);
    speakHinglish(response);
  }


  // ===================================================================
  // UI CARDS/DATA RENDERING
  // ===================================================================
  function renderUserMsg(text) {
    const card = document.createElement('div');
    card.className = 'message-card user-message';
    card.innerHTML = `
      <div class="msg-avatar user-avatar"><i class="fa-solid fa-user"></i></div>
      <div class="msg-content-wrap">
        <div class="msg-header">
          <span class="msg-sender">You</span>
          <span class="msg-time">${getCurrentTimeString()}</span>
        </div>
        <div class="msg-body">${escapeHTML(text)}</div>
      </div>`;
    dom.transcriptContainer.appendChild(card);
    scrollTranscriptBottom();
  }

  function renderAgentMsg(text) {
    const card = document.createElement('div');
    card.className = 'message-card agent-message';
    const safeContent = escapeHTML(text);
    card.innerHTML = `
      <div class="msg-avatar sarvam-avatar"><i class="fa-solid fa-sparkles"></i></div>
      <div class="msg-content-wrap">
        <div class="msg-header">
          <span class="msg-sender">Sarvam Receptionist</span>
          <span class="msg-time">${getCurrentTimeString()}</span>
        </div>
        <div class="msg-body">${safeContent}</div>
        <div class="msg-actions">
          <button class="btn-audio-replay">
            <i class="fa-solid fa-play"></i> Replay
          </button>
        </div>
      </div>`;
    const replayBtn = card.querySelector('.btn-audio-replay');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => speakHinglish(text));
    }
    dom.transcriptContainer.appendChild(card);
    scrollTranscriptBottom();
  }

  function renderToolCard(name, args, result) {
    const card = document.createElement('div');
    card.className = 'tool-call-card';
    const statusClass = result.status || 'available';
    card.innerHTML = `
      <div class="tool-header">
        <div class="tool-name-badge"><i class="fa-solid fa-wrench"></i> ${name}</div>
        <div class="tool-status-badge ${statusClass}">
          <i class="fa-solid ${statusClass === 'unavailable' ? 'fa-x-circle' : 'fa-check-circle'}"></i>
          ${statusClass.toUpperCase()}
        </div>
      </div>
      <div class="tool-params-grid">
        ${ Object.entries(args).map(([k1, v1]) => `<span class="param-item"><strong>${k1}:</strong> ${v1}</span>`).join('') 
        }
      </div>`;
    dom.transcriptContainer.appendChild(card);
    scrollTranscriptBottom();
  }

  function renderBookingCard(appt) {
    const card = document.createElement('div');
    card.className = 'booking-confirmed-card';
    card.innerHTML = `
      <div class="b-card-top">
        <div class="b-badge"><i class="fa-solid fa-calendar-check"></i> APPTF BOOKED</div>
        <span class="b-ref">${appt.id}</span>
      </div>
      <div class="b-details-grid">
        <div class="b-info-col"><span class="b-mbl">Patient</span><span class="b-val">${appt.name}</span></div>
        <div class="b-info-col"><span class="b-mbl">Date</span><span class="b-val">${appt.date}</span></div>
        <div class="b-info-col"><span class="b-mbl">Time</span><span class="b-val">${appt.time}</span></div>
      </div>`;
    dom.transcriptContainer.appendChild(card);
    scrollTranscriptBottom();
  }

  function renderAppointmentsList() {
    dom.appointmentsList.innerHTML = '';
    let bookedCount = 0;
    let availCount = 0;

    appointmentsDbt.forEach(appt => {
      if (appt.status === 'booked') bookedCount++;
      if (appt.status === 'available') availCount++;

      const card = document.createElement('div');
      card.className = `glow-slot-card slot-card ${appt.status}`;
      card.innerHTML = `
        <div class="slot-row-top">
          <span class="slot-time-pill"><i class="fa-regular fa-clock"></i> ${appt.time}</span>
          <span class="slot-status-tag">${appt.status.toUpperCase()}</span>
        </div>
        <div class="slot-patient-name">${appt.name}</div>
        <div class="slot-doctor-meta">Date: ${appt.date} | Doctor: ${appt.doctor || 'Dr. Mehta'}</div>`;
      dom.appointmentsList.appendChild(card);
    });

    dom.statTotalBooked.textContent = bookedCount;
    dom.statTotalAvailable.textContent = 4 + availCount;
    dom.headerApptBadge.textContent = bookedCount;
  }


  // ==================================================================
  // EVENT LISTENERS & INITIALIZATION
  // ===================================================================
  function setupEventListeners() {
    // Call Toggle
    dom.btnCallToggle.addEventListener('click', toggleCall);

    // Mic Toggle
    dom.btnMicToggle.addEventListener('click', () => {
      if (isRecognizing) {
        stopListening();
        setState(STATES.IDLE, 'Mic Muted');
      } else {
        if (!isCallActive) toggleCall();
        else startListening();
      }
    });

    // Mute Toggle
    dom.btnMuteToggle.addEventListener('click', () => {
      CONFIG.isMuted = !CONFIG.isMuted;
      dom.btnMuteToggle.classList.toggle('muted', CONFIG.isMuted);
      dom.speakerIcon.className = CONFIG.isMuted ? 'fa-solid fa-volume-slash' : 'fa-solid fa-volume-high';
    });

    // Hands-Free Toggle
    dom.chkAutoMode.addEventListener('change', (e) => {
      CONFIG.handsFree = e.target.checked;
      localStorage.setItem('sarvam_hands_free', CONFIG.handsFree);
    });

    // Text Input Form
    dom.textInputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const txt = dom.txtUserInput.value;
      if (!txt.trim()) return;
      dom.txtUserInput.value = '';
      handleUserMsg(txt);
    });

    // Quick Prompt Chips
    document.querySelectorAll('.prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-text');
        handleUserMsg(text);
      });
    });

    // Appointments Drawer Open/Close
    dom.btnOpenAppointments.addEventListener('click', () => {
      dom.appointmentsDrawer.classList.add('open');
      dom.drawerOverlay.classList.add('open');
    });

    dom.btnCloseDrawer.addEventListener('click', closeDrawer);
    dom.drawerOverlay.addEventListener('click', closeDrawer);

    // Settings Modal
    dom.btnOpenSettings.addEventListener('click', openSettings);
    document.getElementById('btnCloseSettings').addEventListener('click', closeSettings);
    document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);

    // Rules Modal
    document.getElementById('btnOpenRules').addEventListener('click', () => {
      dom.rulesModal.classList.add('open');
    });
    document.getElementById('btnCloseRules').addEventListener('click', () => dom.rulesModal.classList.remove('open'));
    document.getElementById('btnUnderstandRules').addEventListener('click', () => dom.rulesModal.classList.remove('open'));

    // Clear & Export Transcript
    document.getElementById('btnClearChat').addEventListener('click', () => {
      dom.transcriptContainer.innerHTML = '';
      conversationHistory = [];
      bookingTracker = { date: null, time: null, checked: false, name: null, booked: false, ref: null };
    });

    document.getElementById('btnExportChat').addEventListener('click', () => {
      const txt = conversationHistory.map(q => `${q.role.toUpperCase()}: ${q.content}`).join('\n');
      const blob = new Blob([txt], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.target = '_blank';
      a.download = 'sarvam-hinglish-voice-transcript.txt';
      a.click();
    });
  }


  function toggleCall() {
    isCallActive = !isCallActive;
    if (isCallActive) {
      initAudioAnalyser();
      dom.btnCallToggle.classList.remove('btn-start-call');
      dom.btnCallToggle.classList.add('btn-end-call');
      dom.callBtnText.textContent = 'End Call';
      dom.callIcon.className = 'fa-solid fa-phone-slash';

      // Start Timer
      callSeconds = 0;
      callTimerInterval = setInterval(() => {
        callSeconds++;
        const mins = String(Math.floor(callSeconds / 60)).padStart(2, '0');
        const secs = String(callSeconds % 60).padStart(2, '0');
        dom.callTimer.textContent = `${mins}:${secs}`;
      }, 1000);

      // Greet User
      const greeting = 'Namaste! Main aapki voice receptionist hoon. Main aapki appointment book karne mein kya sahayata kar sakti hoon?';
      speakHinglish(greeting);
    } else {
      dom.btnCallToggle.classList.remove('btn-end-call');
      dom.btnCallToggle.classList.add('btn-start-call');
      dom.callBtnText.textContent = 'Start Call';
      dom.callIcon.className = 'fa-solid fa-phone';
      clearInterval(callTimerInterval);
      stopSpeaking();
      stopListening();
      setState(STATES.IDLE , 'Call Ended - Click Start Call');
    }
  }


  function openSettings() {
    document.getElementById('cfgGroqApiKey').value = CONFIG.groqApiKey;
    document.getElementById('cfgGroqModel').value = CONFIG.groqModel;
    document.getElementById('cfgVoicePersona').value = CONFIG.voicePersona;
    document.getElementById('cfgSpeed').value = CONFIG.speed;
    document.getElementById('cfgPitch').value = CONFIG.pitch;
    document.getElementById('speedValue').textContent = `${CONFIG.speed}x`;
    document.getElementById('pitchValue').textContent = `+${parseInt(CONFIG.pitch)}Hz`;
    dom.settingsModal.classList.add('open');
  }

  function closeSettings() {
    dom.settingsModal.classList.remove('open');
  }

  function saveSettings() {
    CONFIG.groqApiKey = document.getElementById('cfgGroqApiKey').value.trim();
    CONFIG.groqModel = document.getElementById('cfgGroqModel').value;
    CONFIG.voicePersona = document.getElementById('cfgVoicePersona').value;
    CONFIG.speed = flOatParse(document.getElementById('cfgSpeed').value);
    CONFIG.pitch = parseInt(document.getElementById('cfgPitch').value);
    CONFIG.sttLang = document.getElementById('cfgSttLang').value;

    localStorage.setItem('sarvam_groq_key', CONFIG.groqApiKey);
    localStorage.setItem('sarvam_groq_model', CONFIG.groqModel);
    localStorage.setItem('sarvam_voice_persona', CONFIG.voicePersona);
    localStorage.setItem('sarvam_speed', CONFIG.speed);
    localStorage.setItem('sarvam_pitch', CONFIG.pitch);
    localStorage.setItem('sarvam_stt_lang', CONFIG.sttLang);

    dom.activeVoiceName.textContent = CONFIG.voicePersona.includes('Madhur') ? 'Madhur (Male)' : 'Swara (Female)';
    closeSettings();
  }

  function closeDrawer() {
    dom.appointmentsDrawer.classList.remove('open');
    dom.drawerOverlay.classList.remove('open');
  }


  function saveAppointmentsToLocal() {
    try { localStorage.setItem('sarvam_appointments', JSON.stringify(appointmentsDbt)); } catch (e) {}
  }

  function getCurrentTimeString() {
    const d = new Date();
    return d.localeTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function scrollTranscriptBottom() {
    setTimeout(() => {
      dom.transcriptContainer.scrollTop = dom.transcriptContainer.scrollHeight;
    }, 50);
  }


  // Initialize App
  function init() {
    renderOrb();
    renderAppointmentsList();
    setupEventListeners();
    dom.activeVoiceName.textContent = CONFIG.voicePersona.includes('Madhur') ? 'Madhur (Male)' : 'Swara (Female)';
    console.log('Sarvam Hinglish Voice Receptionist Ready!');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
