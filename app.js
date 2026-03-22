// Grammar Rules for basic correction
const grammarRules = [
    { regex: /\b(I has)\b/i, correct: "I have", explanation: "Use 'have' with the pronoun 'I'." },
    { regex: /\b(he don't)\b/i, correct: "he doesn't", explanation: "Use 'doesn\\'t' with third-person singular (he, she, it)." },
    { regex: /\b(she don't)\b/i, correct: "she doesn't", explanation: "Use 'doesn\\'t' with third-person singular (he, she, it)." },
    { regex: /\b(it don't)\b/i, correct: "it doesn't", explanation: "Use 'doesn\\'t' with third-person singular (he, she, it)." },
    { regex: /\b(I am agree)\b/i, correct: "I agree", explanation: "'Agree' is a verb, so you don't need 'am'." },
    { regex: /\b(look forward to see)\b/i, correct: "look forward to seeing", explanation: "'Look forward to' is followed by a gerund (verb + -ing)." }
];

// Daily Office Scenarios Pool
const dailyChallengesPool = [
    { id: 1, title: "Ask for a day off", desc: "You have a family event tomorrow. Ask your manager for a day off.", botIntro: "Hi there. Did you want to speak with me about something?" },
    { id: 2, title: "Report project progress", desc: "Give a quick update on the Q3 Marketing Campaign.", botIntro: "Let's catch up on the Q3 Marketing Campaign. How are things looking?" },
    { id: 3, title: "Invite colleague to lunch", desc: "Ask your coworker if they want to grab Japanese food for lunch.", botIntro: "Hey! I'm starving. Do you have any plans for lunch?" },
    { id: 4, title: "Discuss a pay raise", desc: "You feel you've taken on more responsibility and want to discuss salary.", botIntro: "Thanks for setting up this meeting. What's on your mind?" },
    { id: 5, title: "Calling in sick", desc: "Call your manager to tell them you are sick and can't come to work.", botIntro: "Hello, this is your manager speaking." },
    { id: 6, title: "Apologizing for a mistake", desc: "You sent an email to the wrong client. Explain and apologize.", botIntro: "I saw your message. Did something happen with the email?" },
    { id: 7, title: "Welcoming a new member", desc: "Introduce yourself and welcome a new colleague to the team.", botIntro: "Hi, I'm the new member joining the team today." },
    { id: 8, title: "Clarifying instructions", desc: "You didn't understand the assignment. Ask your boss to clarify.", botIntro: "Do you have any questions about the assignment I gave you?" },
    { id: 9, title: "Rescheduling a meeting", desc: "You have a conflict and need to push a meeting back by 1 hour.", botIntro: "Hi, we have a meeting scheduled soon. Is everything alright?" }
];

// App State
let currentVisibleChallenges = [];
let currentChallenge = null;
let isRecording = false;
let recognition;
let apiKey = localStorage.getItem('speakup_gemini_api_key') || '';
let conversationHistory = [];

// DOM Elements
const challengeList = document.getElementById('challengeList');
const addScenarioBtn = document.getElementById('addScenarioBtn');
const refreshScenariosBtn = document.getElementById('refreshScenariosBtn');
const genCustomBtn = document.getElementById('genCustomBtn');
const geminiApiKeyInput = document.getElementById('geminiApiKey');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
const apiKeyStatus = document.getElementById('apiKeyStatus');
const currentContextDisplay = document.getElementById('currentContextDisplay');
const messagesContainer = document.getElementById('messagesContainer');
const textInput = document.getElementById('textInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const recordingStatus = document.getElementById('recordingStatus');
const toastContainer = document.getElementById('toastContainer');

// Initialization
function init() {
    refreshScenarios();
    setupSpeechRecognition();
    setupEventListeners();
    
    // Load API Key visually
    if (geminiApiKeyInput && apiKey) {
        geminiApiKeyInput.value = apiKey;
        if (apiKeyStatus) {
            apiKeyStatus.textContent = "Key loaded ✓";
            apiKeyStatus.style.color = "#4ade80";
        }
    }
}

function refreshScenarios() {
    // Pick 3 random scenarios from the pool
    const shuffled = [...dailyChallengesPool].sort(() => 0.5 - Math.random());
    currentVisibleChallenges = shuffled.slice(0, 3);
    renderChallenges();
}

function renderChallenges() {
    challengeList.innerHTML = '';
    currentVisibleChallenges.forEach(challenge => {
        const div = document.createElement('div');
        div.className = 'challenge-card';
        if (currentChallenge && currentChallenge.id === challenge.id) {
            div.classList.add('active');
        }
        div.innerHTML = `
            <h4>${challenge.title}</h4>
            <p>${challenge.desc}</p>
        `;
        div.onclick = () => selectChallenge(challenge, div);
        challengeList.appendChild(div);
    });
}

function selectChallenge(challenge, element) {
    document.querySelectorAll('.challenge-card').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    currentChallenge = challenge;
    currentContextDisplay.textContent = `Scenario: ${challenge.title}`;
    
    // Clear chat and output intro
    messagesContainer.innerHTML = '';
    
    // Initialize AI Conversation History
    conversationHistory = [
        { role: "user", parts: [{ text: `You are an English teacher doing a roleplay practice. Scenario: "${challenge.title}". Context: "${challenge.desc}". Stay in character. Your first message should be: "${challenge.botIntro}". Keep your replies brief (no more than a few sentences), friendly, and natural. If the user makes any grammar mistakes, gently correct them alongside your reply. If the user inputs Chinese context, translate it to English and roleplay in English.` }] },
        { role: "model", parts: [{ text: challenge.botIntro }] }
    ];

    setTimeout(() => {
        appendMessage(challenge.botIntro, 'ai');
        speakText(challenge.botIntro);
    }, 400);
}

function setupEventListeners() {
    sendBtn.addEventListener('click', handleSend);
    textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
    
    micBtn.addEventListener('click', toggleRecording);
    
    if (addScenarioBtn) {
        addScenarioBtn.addEventListener('click', handleAddScenario);
    }
    
    if (refreshScenariosBtn) {
        refreshScenariosBtn.addEventListener('click', refreshScenarios);
    }

    if (genCustomBtn) {
        genCustomBtn.addEventListener('click', handleGenCustomForm);
    }

    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener('click', () => {
            const key = geminiApiKeyInput.value.trim();
            if (key) {
                localStorage.setItem('speakup_gemini_api_key', key);
                apiKey = key;
                apiKeyStatus.textContent = "Saved ✓";
                apiKeyStatus.style.color = "#4ade80";
                showToast("Success", "API Key saved in your browser!");
            }
        });
    }
}

async function handleGenCustomForm() {
    let prof = document.getElementById('userProf').value.trim() || 'Professional';
    const levelEl = document.getElementById('userLevel');
    const levelVal = levelEl.value;
    const levelText = levelVal ? levelEl.options[levelEl.selectedIndex].text : "中級 (Intermediate)";
    let scenario = document.getElementById('userScenario').value.trim();
    
    if(!scenario) {
        showToast("Notice", "請輸入您想練習的場景！(Please enter a scenario)");
        return;
    }

    const genBtn = document.getElementById('genCustomBtn');
    const originalBtnText = genBtn.innerText;
    genBtn.innerText = "Translating...";
    genBtn.disabled = true;

    // Check if there are Chinese characters to translate
    const hasChinese = /[\u4e00-\u9fa5]/;
    try {
        if (hasChinese.test(prof) && prof !== 'Professional') {
            const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(prof)}&langpair=zh-TW|en`);
            const data = await res.json();
            if (data.responseData.translatedText) prof = data.responseData.translatedText;
        }
        if (hasChinese.test(scenario)) {
            const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(scenario)}&langpair=zh-TW|en`);
            const data = await res.json();
            if (data.responseData.translatedText) scenario = data.responseData.translatedText;
        }
    } catch (e) {
        console.error("Translation form error:", e);
    }
    
    genBtn.innerText = originalBtnText;
    genBtn.disabled = false;
    
    const displayLevel = levelText.split(' ')[0];
    
    // Update the bottom user profile display
    const userNameEl = document.querySelector('.user-name');
    const userLevelEl = document.querySelector('.user-level');
    if (userNameEl) userNameEl.textContent = prof;
    if (userLevelEl) userLevelEl.textContent = displayLevel;
    
    const newChallenge = {
        id: Date.now(),
        title: scenario,
        desc: `[${prof}] - Level: ${displayLevel}`,
        botIntro: `Hi! Let's practice the scenario: "${scenario}". I see you are a ${prof} at an ${levelVal || 'Intermediate'} level. Let's begin!`
    };
    
    currentVisibleChallenges.unshift(newChallenge);
    if(currentVisibleChallenges.length > 4) currentVisibleChallenges.pop();
    renderChallenges();
    
    const cards = challengeList.querySelectorAll('.challenge-card');
    selectChallenge(newChallenge, cards[0]);
}

function handleAddScenario() {
    const title = prompt("Enter a title for your custom scenario (e.g. 'Job Interview'):");
    if (!title) return;
    const desc = prompt("Enter a short description:");
    
    const newChallenge = {
        id: Date.now(),
        title: title,
        desc: desc || "Custom user practice scenario",
        botIntro: `Let's practice the scenario: ${title}. Please start when you're ready.`
    };
    
    // Make sure we keep the 3 we had, and append the custom one
    currentVisibleChallenges.push(newChallenge);
    renderChallenges();
    
    const cards = challengeList.querySelectorAll('.challenge-card');
    const newCard = cards[cards.length - 1];
    selectChallenge(newChallenge, newCard);
}

// Chat Logic
async function handleSend() {
    const originalText = textInput.value.trim();
    if (!originalText) return;

    if (!currentChallenge) {
        showToast("Notice", "Please select a challenge from the left first!");
        return;
    }

    textInput.value = '';

    // Check if input contains Chinese characters
    const hasChinese = /[\u4e00-\u9fa5]/.test(originalText);
    let textToProcess = originalText;

    if (hasChinese) {
        // Append message with translating indicator
        appendMessage(originalText + ' (Translating...)', 'user');
        const messages = messagesContainer.querySelectorAll('.user-message .bubble');
        const lastBubble = messages[messages.length - 1];
        
        try {
            // Fetch translation
            const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalText)}&langpair=zh-TW|en`);
            const data = await res.json();
            const translatedText = data.responseData.translatedText;
            
            // Update bubble with translated text
            lastBubble.innerHTML = `${originalText}<br><small style="color: #e0e7ff;"><i>Translated: ${translatedText}</i></small>`;
            textToProcess = translatedText;
        } catch (e) {
            console.error("Translation error:", e);
            lastBubble.innerHTML = `${originalText}<br><small style="color: #ff9999;"><i>Translation failed.</i></small>`;
        }
    } else {
        appendMessage(originalText, 'user');
    }

    // Simulate AI processing time
    setTimeout(() => {
        processAIResponse(textToProcess);
    }, 1200);
}

function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${sender}-message`;
    
    // Create bubble
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = text;

    // Add speaker button for AI messages
    if (sender === 'ai') {
        const speakerBtn = document.createElement('button');
        speakerBtn.className = 'speaker-btn';
        speakerBtn.innerHTML = '<ion-icon name="volume-high-outline"></ion-icon>';
        
        // Clean text for speech (remove HTML tags if any)
        const speechText = text.replace(/<[^>]*>/g, '').replace(/\(Translating...\)/g, '');
        speakerBtn.onclick = (e) => {
            e.stopPropagation();
            speakText(speechText);
        };
        bubble.appendChild(speakerBtn);
    }

    msgDiv.appendChild(bubble);
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Mock AI Processing & AI Integration
let lastAiResponse = "";

async function processAIResponse(userText) {
    // If we have an API key, use Gemini real intelligence directly
    if (apiKey) {
        const userPrompt = `Student says: "${userText}"`;
        const tempContext = [...conversationHistory, { role: "user", parts: [{ text: userPrompt }] }];
        
        try {
            const endpoints = [
                // Priority 1: Modern & Lite models (Best for free tier / preview keys)
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                
                // Priority 2: Stable Aliases (Verified in your diagnostic)
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${apiKey}`,
                
                // Priority 3: Standard 1.5 models
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
                `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`
            ];

            let data = null;
            let finalErrorMsg = "";

            for (let url of endpoints) {
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contents: tempContext })
                    });

                    data = await response.json();
                    
                    if (response.ok && data && !data.error) {
                        // Success!
                        finalErrorMsg = "";
                        break;
                    } else {
                        finalErrorMsg = (data && data.error) ? data.error.message : (response.statusText || "Fetch failed");
                        // Automatically try next model for common availability/quota issues
                        const lowerMsg = finalErrorMsg.toLowerCase();
                        if (lowerMsg.includes("not found") || 
                            lowerMsg.includes("not supported") ||
                            lowerMsg.includes("not permitted") ||
                            lowerMsg.includes("quota") ||
                            lowerMsg.includes("exhausted")) {
                            console.warn(`Model failed, trying next... Error: ${finalErrorMsg}`);
                            continue;
                        } else {
                            break; // Stop for critical errors like Invalid Key
                        }
                    }
                } catch (fetchErr) {
                    finalErrorMsg = "Network Error: " + fetchErr.message;
                    continue;
                }
            }

            if (!data || data.error || finalErrorMsg) {
                // Diagnostic: List available models if everything failed
                try {
                    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                    const listData = await listRes.json();
                    console.log("Diagnostic - Available Models for your key:", listData);
                    if (listData.error) {
                        finalErrorMsg += ` (ListModels Error: ${listData.error.message})`;
                    } else if (listData.models) {
                        const modelNames = listData.models.map(m => m.name.split('/').pop()).join(', ');
                        finalErrorMsg += ` (Available models: ${modelNames})`;
                    }
                } catch (diagErr) {
                    console.error("Diagnostic failed:", diagErr);
                }
                throw new Error(finalErrorMsg || "All model endpoints failed.");
            }

            const aiOutput = data.candidates[0].content.parts[0].text;
            
            // Save to history
            conversationHistory.push({ role: "user", parts: [{ text: userPrompt }] });
            conversationHistory.push({ role: "model", parts: [{ text: aiOutput }] });

            appendMessage(aiOutput, 'ai');
            speakText(aiOutput);
            return; // Terminate execution using real LLM
            
        } catch (e) {
            console.error("Gemini API Error details:", e);
            showToast("Gemini Error", "Error: " + e.message + ". Please check Console (F12) for diagnostics.");
        }
    } else {
        showToast("Gemini API missing", "Set your Gemini API Key in the left menu to enable intelligent replies!");
    }


    /* --- MOCK FALLBACK LOGIC BELOW --- */
    // 1. Check for basic grammar errors
    let errorFound = false;
    for (let rule of grammarRules) {
        if (rule.regex.test(userText)) {
            showToast("Grammar Tip 💡", `<b>Correction:</b> Instead of saying that, try to use "<b>${rule.correct}</b>". <br><small>${rule.explanation}</small>`);
            errorFound = true;
            break; // Just show one error at a time for simplicity
        }
    }

    // 2. Generate Mock Response based on context
    const responses = [
        "That makes sense. Can you tell me a bit more about it?",
        "I understand. What should we do next?",
        "Got it! Let's arrange that.",
        "That sounds good to me.",
        "Could you clarify what you mean?",
        "Interesting point. Please continue.",
        "I see where you're coming from. What else?",
        "Okay, noted. Let's explore that a bit further.",
        "That's very helpful information.",
        "Right. Do you have any other questions or thoughts for this scenario?"
    ];
    
    // Filter out the last response to prevent repetition
    const availableResponses = responses.filter(r => r !== lastAiResponse);
    let aiText = availableResponses[Math.floor(Math.random() * availableResponses.length)];
    lastAiResponse = aiText;
    
    if (errorFound) {
        aiText = "Good try! " + aiText;
    }

    appendMessage(aiText, 'ai');
    speakText(aiText);
}

// Toast Notifications
function showToast(title, message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <ion-icon name="alert-circle-outline" class="toast-icon"></ion-icon>
        <div class="toast-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    toastContainer.appendChild(toast);
    
    // Auto remove after 6 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        toast.style.transition = 'all 0.4s';
        setTimeout(() => toast.remove(), 400);
    }, 6000);
}

// Web Speech API Integration
function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('recording');
            recordingStatus.classList.add('active');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            textInput.value = transcript;
        };

        recognition.onerror = (event) => {
            console.error(event.error);
            showToast("Microphone Error", "Failed to recognize speech. Please ensure permissions are granted.");
            stopRecording();
        };

        recognition.onend = () => {
            stopRecording();
            // Optional: Auto-send after voice input
            // if (textInput.value) handleSend(); 
        };
    } else {
        micBtn.style.display = 'none';
        console.warn("Speech Recognition API not supported in this browser.");
    }
}

function toggleRecording() {
    if (!recognition) {
        showToast("Not Supported", "Your browser does not support Speech Recognition.");
        return;
    }

    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

function stopRecording() {
    isRecording = false;
    micBtn.classList.remove('recording');
    recordingStatus.classList.remove('active');
}

// Text to Speech API
function speakText(text) {
    if (!window.speechSynthesis) return;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SynthesisUtterance(text);
    // On some mobile devices, SynthesisUtterance is picky
    const speechUtterance = window.SpeechSynthesisUtterance ? new SpeechSynthesisUtterance(text) : utterance;
    
    speechUtterance.lang = 'en-US';
    speechUtterance.rate = 0.9; // Slightly slower for better clarity
    speechUtterance.pitch = 1.0;
    
    // Get voices and try to pick a good one
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        const preferredVoice = voices.find(v => v.lang.includes('en-US') && (v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Premium')));
        if (preferredVoice) speechUtterance.voice = preferredVoice;
    }

    // iOS Safari requires a user gesture for the first speak, 
    // and subsequent ones work better if triggered directly.
    window.speechSynthesis.speak(speechUtterance);
}

// Fallback for some environments
function SynthesisUtterance(text) {
    this.text = text;
    this.lang = 'en-US';
}

// Wait for voices to load
window.speechSynthesis.onvoiceschanged = () => {
    // Voices are loaded
};

// Start App
window.onload = init;
