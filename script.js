// ==========================================
// NOVA.AI - MAIN CONTROLLER
// ==========================================

const chatArea = document.getElementById("chatArea");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const micBtn = document.getElementById("micBtn");
const menuBtn = document.getElementById("menuBtn");
const historyPanel = document.getElementById("historyPanel");
const historyOverlay = document.getElementById("historyOverlay");
const historyList = document.getElementById("historyList");
const newChatBtn = document.getElementById("newChatBtn");
const closeHistoryBtn = document.getElementById("closeHistoryBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const voiceModeBtn = document.getElementById("voiceModeBtn");
const voiceModeScreen = document.getElementById("voiceModeScreen");
const closeVoiceModeBtn = document.getElementById("closeVoiceModeBtn");
const voiceOrb = document.getElementById("voiceOrb");
const voiceStatusText = document.getElementById("voiceStatusText");
const websitePreviewOverlay = document.getElementById("websitePreviewOverlay");
const websitePreviewFrame = document.getElementById("websitePreviewFrame");
const closeWebsitePreviewBtn = document.getElementById("closeWebsitePreviewBtn");


// ==========================================
// AI CONFIG (OpenRouter - free tier)
// ==========================================
// API keys live in assets/js/config.js (NOT committed to
// GitHub - see .gitignore). This file only has non-secret
// settings, so it's safe to push publicly.
// ==========================================

const NOVA_CONFIG = {

    // openrouter/free auto-picks from ALL currently-available free models
    // on OpenRouter (with its own built-in uptime fallback), so we stop
    // depending on one specific free model's rate limit. The two models
    // below are kept as extra manual fallback in case the router itself
    // has an off moment.
    MODEL: "openrouter/free",

    FALLBACK_MODELS: [
        "meta-llama/llama-3.3-70b-instruct:free",
        "z-ai/glm-5.2:free"
    ],

    SYSTEM_PROMPT:
        "You are Nova.ai, a friendly, professional AI assistant " +
        "similar to ChatGPT and Claude. Be supportive like a best " +
        "friend, teach like an experienced teacher, keep answers " +
        "accurate, practical, and admit clearly when unsure. " +
        "IMPORTANT: Reply with ONLY your final answer, in plain, " +
        "simple, polite language. Do NOT show your thinking process, " +
        "step numbers, analysis, or reasoning out loud - no 'Here's " +
        "my thinking', no 'Step 1/Step 2', no self-checking text. " +
        "Just give the direct, natural answer a person would say, " +
        "as short as possible while still being helpful.",

    IDENTITY_PROMPT:
        "Always refer to yourself as Nova.ai. If asked who built, " +
        "made, created, or developed you, or who your owner/founder " +
        "is, answer that you were built by Jampula Mahesh Babu. " +
        "Never mention that you are built on Llama, GLM, Nemotron, " +
        "or any other underlying model/provider/company - the only " +
        "names you give for who made you are Nova.ai and Jampula " +
        "Mahesh Babu."

};


// ==========================================
// REAL AI CALL (OpenRouter) - with context
// ==========================================

async function callNovaAI(message, systemPrompt, history, onChunk, maxTokens) {

    if (
        typeof NOVA_SECRETS === "undefined" ||
        !NOVA_SECRETS.OPENROUTER_API_KEY ||
        NOVA_SECRETS.OPENROUTER_API_KEY === "PASTE_YOUR_OPENROUTER_KEY_HERE"
    ) {
        return "⚠️ AI API key set చేయలేదు. assets/js/config.js లో OPENROUTER_API_KEY పెట్టండి.";
    }

    try {

        const now = new Date();
        const todayStr = now.toLocaleDateString("en-IN", {
            weekday: "long", year: "numeric", month: "long", day: "numeric"
        });
        const timeStr = now.toLocaleTimeString("en-IN", {
            hour: "numeric", minute: "2-digit", hour12: true
        });

        const finalSystemPrompt =
            (systemPrompt || NOVA_CONFIG.SYSTEM_PROMPT) + " " +
            NOVA_CONFIG.IDENTITY_PROMPT +
            " Today's date is " + todayStr + " and the current time is " + timeStr +
            " (device local time). Use this if asked about the current date or time. " +
            "Keep answers reasonably concise unless the user asks for detail.";

        const messages = [
            { role: "system", content: finalSystemPrompt },
            ...(history || []),
            { role: "user", content: message }
        ];

        // Abort if the model hangs - prevents the reply bubble from
        // getting stuck forever on flaky free-tier models.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        async function attemptFetch() {
            const res = await fetch(
                "https://openrouter.ai/api/v1/chat/completions",
                {
                    method: "POST",
                    signal: controller.signal,
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${NOVA_SECRETS.OPENROUTER_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: NOVA_CONFIG.MODEL,
                        models: NOVA_CONFIG.FALLBACK_MODELS,
                        messages: messages,
                        max_tokens: maxTokens || 400,
                        stream: true,
                        reasoning: { exclude: true }
                    })
                }
            );
            return res;
        }

        // Transient provider hiccups (and 429 rate limits) are common on
        // free-tier models - retry a few times before bothering the user.
        // On a 429 we read retry_after_seconds from the error body and
        // wait that long instead of guessing.
        const MAX_ATTEMPTS = 3;
        let response = null;
        let lastErrBody = null;
        let lastStatus = null;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {

            response = await attemptFetch();

            if (response.ok && response.body) break;

            lastStatus = response.status;
            try {
                lastErrBody = await response.text();
            } catch (e) {
                lastErrBody = null;
            }

            if (attempt === MAX_ATTEMPTS) break;

            let waitMs = 1200; // default backoff
            if (response.status === 429 && lastErrBody) {
                try {
                    const parsed = JSON.parse(lastErrBody);
                    const retrySec =
                        parsed.error &&
                        parsed.error.metadata &&
                        parsed.error.metadata.retry_after_seconds;
                    if (retrySec) waitMs = (Number(retrySec) + 1) * 1000;
                } catch (e) { /* not JSON, use default backoff */ }
            }

            console.log(
                "Nova AI: attempt " + attempt + " failed (HTTP " + lastStatus +
                "), retrying in " + waitMs + "ms..."
            );
            await new Promise(r => setTimeout(r, waitMs));
        }

        if (!response.ok || !response.body) {
            clearTimeout(timeoutId);
            let errMsg = "HTTP " + lastStatus;
            console.error("Nova AI RAW error:", lastStatus, lastErrBody);
            if (lastErrBody) {
                try {
                    const errData = JSON.parse(lastErrBody);
                    if (errData.error) errMsg = errData.error.message;
                } catch (parseErr) {
                    errMsg = lastErrBody.slice(0, 200);
                }
            }
            if (lastStatus === 429) {
                return "⚠️ చాలా mandi ఇప్పుడు free AI models వాడుతున్నారు (rate limit). దయచేసి 10-15 సెకన్లు ఆగి మళ్ళీ try చేయండి.";
            }
            return "⚠️ AI model tho connect avvatledu: " + errMsg;
        }

        // ---- Read the streaming response chunk by chunk ----
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        // Guard against models that leak visible chain-of-thought
        // ("Here's a thinking process...", "1. **Analyze...") instead
        // of a direct answer. We hold back display briefly to check.
        const COT_PATTERN = /^\s*(here'?s (a|my) (thinking|reasoning)|let me think|thinking process|i need to (analyze|identify)|\d+\.\s*\*\*(analyze|identify|check))/i;
        let decided = false;
        let isLeak = false;

        while (true) {

            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop(); // keep any incomplete line for next round

            for (const rawLine of lines) {

                const line = rawLine.trim();
                if (!line.startsWith("data:")) continue;

                const jsonStr = line.slice(5).trim();
                if (jsonStr === "[DONE]") continue;

                try {
                    const parsed = JSON.parse(jsonStr);
                    const delta = parsed.choices &&
                        parsed.choices[0] &&
                        parsed.choices[0].delta &&
                        parsed.choices[0].delta.content;

                    if (delta) {
                        fullText += delta;

                        if (!decided) {
                            if (fullText.length >= 40) {
                                decided = true;
                                isLeak = COT_PATTERN.test(fullText);
                                if (!isLeak && onChunk) onChunk(fullText);
                            }
                            // else: keep buffering silently until we decide
                        } else if (!isLeak && onChunk) {
                            onChunk(fullText);
                        }
                    }
                } catch (e) {
                    // Partial/incomplete JSON chunk - safe to ignore
                }
            }
        }

        clearTimeout(timeoutId);

        if (isLeak) {
            console.error("Nova AI: detected leaked reasoning text, discarding:", fullText.slice(0, 100));
            return "⚠️ AI response సరిగ్గా రాలేదు. దయచేసి మళ్ళీ try చేయండి.";
        }

        if (!fullText) {
            return "⚠️ AI నుండి సరైన response రాలేదు. మళ్ళీ try చేయండి.";
        }

        return fullText;

    } catch (error) {
        console.error("Nova AI fetch error:", error);
        if (error.name === "AbortError") {
            return "⚠️ AI response చాలా ఆలస్యం అవుతోంది (45 సెకన్లు దాటింది). దయచేసి మళ్ళీ try చేయండి.";
        }
        return "⚠️ Internet connection సరిగా లేదు లేదా API problem. మళ్ళీ try చేయండి.";
    }

}


// ==========================================
// SEND BUTTON / ENTER KEY
// ==========================================

// ==========================================
// AUDIO UNLOCK (mobile WebView fix)
// A tap that leads straight into an async AI
// call loses "user gesture" status by the time
// the reply is ready, so audio.play() later gets
// blocked (NotAllowedError). Playing one silent
// sound synchronously on tap keeps audio unlocked
// for the rest of the session.
// ==========================================

let audioUnlocked = false;

function unlockAudioOnce() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
        const silentAudio = new Audio(
            "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
        );
        silentAudio.play().catch(() => {});
    } catch (e) {
        console.log("Audio unlock skipped:", e);
    }
}

sendBtn.addEventListener("click", unlockAudioOnce);
micBtn.addEventListener("click", unlockAudioOnce);


sendBtn.addEventListener("click", sendMessage);

userInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") sendMessage();
});


// ==========================================
// CHAT HISTORY - multiple saved sessions
// (like ChatGPT/Claude's chat list)
// ==========================================

function getSessions() {
    try {
        return JSON.parse(localStorage.getItem("novaSessions") || "[]");
    } catch (e) {
        return [];
    }
}

function setSessions(sessions) {
    try {
        localStorage.setItem("novaSessions", JSON.stringify(sessions));
    } catch (e) {
        console.log("Session save skipped:", e);
    }
}

let currentSessionId = localStorage.getItem("novaCurrentSessionId");

function ensureSession() {
    const sessions = getSessions();
    const exists = sessions.find(s => s.id === currentSessionId);

    if (!currentSessionId || !exists) {
        currentSessionId = Date.now().toString();
        sessions.unshift({
            id: currentSessionId,
            title: "New Chat",
            timestamp: Date.now(),
            html: chatArea.innerHTML
        });
        setSessions(sessions);
        localStorage.setItem("novaCurrentSessionId", currentSessionId);
    }
}

function loadCurrentSessionOrInit() {
    const sessions = getSessions();
    const session = sessions.find(s => s.id === currentSessionId);

    if (session) {
        chatArea.innerHTML = session.html;
        chatArea.scrollTop = chatArea.scrollHeight;
    } else {
        ensureSession();
    }
}

function updateCurrentSession() {
    const sessions = getSessions();
    const idx = sessions.findIndex(s => s.id === currentSessionId);
    if (idx === -1) return;
    sessions[idx].html = chatArea.innerHTML;
    sessions[idx].timestamp = Date.now();
    setSessions(sessions);
}

function setSessionTitleIfNeeded(text) {
    const sessions = getSessions();
    const idx = sessions.findIndex(s => s.id === currentSessionId);
    if (idx === -1) return;
    if (sessions[idx].title === "New Chat") {
        sessions[idx].title = text.length > 30 ? text.slice(0, 30) + "…" : text;
        setSessions(sessions);
    }
}

function renderHistoryList() {
    const sessions = getSessions().sort((a, b) => b.timestamp - a.timestamp);
    historyList.innerHTML = "";

    sessions.forEach(function (s) {
        const item = document.createElement("div");
        item.className = "history-item" + (s.id === currentSessionId ? " active-session" : "");
        item.textContent = s.title;

        item.addEventListener("click", function () {
            currentSessionId = s.id;
            localStorage.setItem("novaCurrentSessionId", currentSessionId);
            chatArea.innerHTML = s.html;
            chatArea.scrollTop = chatArea.scrollHeight;
            MasterAgent.clearMemory();
            closeHistoryPanel();
        });

        historyList.appendChild(item);
    });
}

function openHistoryPanel() {
    renderHistoryList();
    historyPanel.classList.add("open");
    historyOverlay.classList.add("active");
}

function closeHistoryPanel() {
    historyPanel.classList.remove("open");
    historyOverlay.classList.remove("active");
}

menuBtn.addEventListener("click", openHistoryPanel);
closeHistoryBtn.addEventListener("click", closeHistoryPanel);
historyOverlay.addEventListener("click", closeHistoryPanel);

newChatBtn.addEventListener("click", function () {
    updateCurrentSession();

    currentSessionId = Date.now().toString();
    localStorage.setItem("novaCurrentSessionId", currentSessionId);

    chatArea.innerHTML = `
        <div class="message ai">
            <div class="bubble">👋 Hello! Welcome to Nova.ai — ask me anything.</div>
        </div>
    `;

    const sessions = getSessions();
    sessions.unshift({
        id: currentSessionId,
        title: "New Chat",
        timestamp: Date.now(),
        html: chatArea.innerHTML
    });
    setSessions(sessions);

    MasterAgent.clearMemory();
    closeHistoryPanel();
});

clearAllBtn.addEventListener("click", function () {
    const confirmClear = confirm("అన్ని chats ని delete cheddama? (Delete ALL saved conversations)");
    if (!confirmClear) return;

    setSessions([]);
    localStorage.removeItem("novaCurrentSessionId");
    currentSessionId = null;
    ensureSession();

    chatArea.innerHTML = `
        <div class="message ai">
            <div class="bubble">👋 Hello! Welcome to Nova.ai — ask me anything.</div>
        </div>
    `;
    updateCurrentSession();

    MasterAgent.clearMemory();
    closeHistoryPanel();
});


// ==========================================
// MICROPHONE BUTTON + VOICE RECOGNITION
// ==========================================

micBtn.addEventListener("click", startVoice);

function startVoice() {

    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("🎤 Speech Recognition is not supported in this browser.");
        return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function () {
        micBtn.innerText = "🎙️";
        userInput.placeholder = "Listening...";
    };

    recognition.onresult = function (event) {
        const speechText = event.results[0][0].transcript;
        userInput.value = speechText;
        sendMessage();
    };

    recognition.onerror = function (event) {
        if (event.error === "not-allowed") {
            alert("🎤 Microphone permission is not allowed.\n\nPlease allow microphone permission for Nova.ai.");
        } else if (event.error === "no-speech") {
            console.log("No speech detected.");
        } else {
            console.log("Voice error:", event.error);
        }
    };

    recognition.onend = function () {
        micBtn.innerText = "M";
        userInput.placeholder = "Message Nova.ai...";
    };

    try {
        recognition.start();
    } catch (error) {
        console.error("Voice start error:", error);
    }

}


// ==========================================
// VOICE MODE - full-screen continuous
// conversation (ChatGPT/Gemini style)
// ==========================================

let voiceModeActive = false;
let voiceRecognition = null;

function setVoiceStatus(text, stateClass) {
    voiceStatusText.textContent = text;
    voiceOrb.className = "voice-orb " + stateClass;
}

function enterVoiceMode() {
    voiceModeActive = true;
    voiceModeScreen.classList.add("active");
    voiceModeListenLoop();
}

function exitVoiceMode() {
    voiceModeActive = false;

    if (voiceRecognition) {
        try { voiceRecognition.abort(); } catch (e) { /* already stopped */ }
    }

    if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
    }

    voiceModeScreen.classList.remove("active");
}

function voiceModeListenLoop() {

    if (!voiceModeActive) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("🎤 Speech Recognition is not supported in this browser.");
        exitVoiceMode();
        return;
    }

    setVoiceStatus("Listening...", "listening");

    voiceRecognition = new SpeechRecognition();
    voiceRecognition.lang = "en-IN";
    voiceRecognition.interimResults = false;
    voiceRecognition.continuous = false;
    voiceRecognition.maxAlternatives = 1;

    voiceRecognition.onresult = async function (event) {

        if (!voiceModeActive) return;

        const text = event.results[0][0].transcript;

        setVoiceStatus("Thinking...", "thinking");

        addMessage(text, "user");
        setSessionTitleIfNeeded(text);
        saveChatToStorage();

        const reply = await MasterAgent.process(text);

        const aiEl = addMessage("", "ai");
        renderAIBubbleContent(aiEl.querySelector(".bubble"), reply);
        saveChatToStorage();

        if (!voiceModeActive) return;

        setVoiceStatus("Speaking...", "speaking");
        await speak(reply);

        if (voiceModeActive) {
            voiceModeListenLoop();
        }
    };

    voiceRecognition.onerror = function (event) {

        if (event.error === "not-allowed") {
            alert("🎤 Microphone permission is not allowed.\n\nPlease allow microphone permission for Nova.ai.");
            exitVoiceMode();
            return;
        }

        // no-speech or minor glitches - just keep listening
        if (voiceModeActive) {
            voiceModeListenLoop();
        }
    };

    try {
        voiceRecognition.start();
    } catch (error) {
        console.error("Voice mode start error:", error);
    }

}

voiceModeBtn.addEventListener("click", function () {
    unlockAudioOnce();
    enterVoiceMode();
});

closeVoiceModeBtn.addEventListener("click", exitVoiceMode);


// ==========================================
// SEND MESSAGE
// ==========================================

function addMessage(text, sender) {
    const el = document.createElement("div");
    el.className = "message " + sender;
    el.innerHTML = `<div class="bubble">${text}</div>`;
    chatArea.appendChild(el);
    chatArea.scrollTop = chatArea.scrollHeight;
    return el;
}

// ==========================================
// WEBSITE BUILDER / PDF CREATOR - render
// generated HTML with Preview/Download
// instead of raw code
// ==========================================

function extractHtmlCodeBlock(text) {
    const match = text.match(/```html\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : null;
}

function extractPdfCodeBlock(text) {
    const match = text.match(/```pdf-html\s*([\s\S]*?)```/i);
    return match ? match[1].trim() : null;
}

function extractAgentJsonBlock(text) {
    const match = text.match(/```(?:agent-json|json)\s*([\s\S]*?)```/i);
    return match ? match[1].trim() : null;
}

function extractImagePromptBlock(text) {
    const match = text.match(/```image-prompt\s*([\s\S]*?)```/i);
    return match ? match[1].trim() : null;
}

function buildPollinationsUrl(prompt) {
    const seed = Math.floor(Math.random() * 1000000);
    return "https://image.pollinations.ai/prompt/" +
        encodeURIComponent(prompt) +
        "?width=1024&height=1024&nologo=true&seed=" + seed;
}

function downloadImageFile(imageUrl, filename) {
    fetch(imageUrl)
        .then(res => res.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = (filename || "nova-image") + ".jpg";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        })
        .catch(err => {
            // Cross-origin fetch can fail in some WebViews - fall back
            // to opening the image directly so the user can long-press-save.
            console.error("Image download fetch failed, opening directly:", err);
            window.open(imageUrl, "_blank");
        });
}

function downloadWebsiteFile(htmlCode) {
    const blob = new Blob([htmlCode], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "website.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function downloadPdfFile(htmlCode, filename) {

    if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
        alert("⚠️ PDF library load avvaledu. Page ni reload chesi malli try cheyandi.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    // Render the AI-generated HTML off-screen so jsPDF's html()
    // plugin (via html2canvas) can measure and paginate it properly.
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "595pt"; // A4 width in points at 72dpi
    container.innerHTML = htmlCode;
    document.body.appendChild(container);

    doc.html(container, {
        margin: [40, 40, 40, 40],
        autoPaging: "text",
        html2canvas: { scale: 0.75 },
        callback: function (pdf) {
            pdf.save((filename || "nova-document") + ".pdf");
            document.body.removeChild(container);
        }
    });
}

function openWebsitePreview(htmlCode) {
    websitePreviewFrame.srcdoc = htmlCode;
    websitePreviewOverlay.classList.add("active");
}

closeWebsitePreviewBtn.addEventListener("click", function () {
    websitePreviewOverlay.classList.remove("active");
    websitePreviewFrame.srcdoc = "";
});

function renderAIBubbleContent(bubbleDiv, replyText) {

    // ---- Agent Builder output: save the agent, show a clean
    // confirmation instead of the raw JSON spec ----
    const agentJson = extractAgentJsonBlock(replyText);
    if (agentJson) {
        const introText = replyText.split("```")[0].trim() || "కొత్త agent ready!";
        try {
            const parsed = JSON.parse(agentJson);
            if (parsed.name && Array.isArray(parsed.keywords) && parsed.systemPrompt) {
                CustomAgentManager.add(parsed);
                bubbleDiv.innerText =
                    introText + "\n\n✅ \"" + parsed.name + "\" agent create ayindi! " +
                    "Trigger words: " + parsed.keywords.join(", ") + ". " +
                    "Ee words meeda kani chెప్పితే aa agent tho matladagalaru.";
            } else {
                bubbleDiv.innerText = "⚠️ Agent spec సరిగ్గా రాలేదు. దయచేసి మళ్ళీ try చేయండి.";
            }
        } catch (e) {
            console.error("Agent JSON parse error:", e, agentJson);
            bubbleDiv.innerText = "⚠️ Agent create చేయడంలో సమస్య వచ్చింది. దయచేసి మళ్ళీ try చేయండి.";
        }
        return;
    }

    // ---- Image Generator output: build the actual image from the
    // AI-refined prompt and show it inline ----
    const imagePrompt = extractImagePromptBlock(replyText);
    if (imagePrompt) {

        const introText = replyText.split("```")[0].trim() || "మీ image generate అవుతోంది...";

        bubbleDiv.innerHTML = "";

        const introEl = document.createElement("div");
        introEl.innerText = introText;
        bubbleDiv.appendChild(introEl);

        const loadingEl = document.createElement("div");
        loadingEl.innerText = "🎨 Generating...";
        loadingEl.style.marginTop = "8px";
        bubbleDiv.appendChild(loadingEl);

        const imageUrl = buildPollinationsUrl(imagePrompt);

        const imgEl = document.createElement("img");
        imgEl.style.display = "none";
        imgEl.style.maxWidth = "100%";
        imgEl.style.borderRadius = "10px";
        imgEl.style.marginTop = "8px";

        imgEl.onload = function () {
            loadingEl.remove();
            imgEl.style.display = "block";
            chatArea.scrollTop = chatArea.scrollHeight;
        };

        imgEl.onerror = function () {
            loadingEl.innerText = "⚠️ Image generate avvaledu. దయచేసి మళ్ళీ try చేయండి.";
        };

        imgEl.src = imageUrl;
        bubbleDiv.appendChild(imgEl);

        const imgBtnRow = document.createElement("div");
        imgBtnRow.className = "website-actions";

        const imgDownloadBtn = document.createElement("button");
        imgDownloadBtn.className = "website-btn secondary";
        imgDownloadBtn.innerText = "📥 Download Image";
        imgDownloadBtn.addEventListener("click", () => downloadImageFile(imageUrl, "nova-image"));

        imgBtnRow.appendChild(imgDownloadBtn);
        bubbleDiv.appendChild(imgBtnRow);

        return;
    }

    const pdfHtmlCode = extractPdfCodeBlock(replyText);
    const websiteHtmlCode = pdfHtmlCode ? null : extractHtmlCodeBlock(replyText);
    const htmlCode = pdfHtmlCode || websiteHtmlCode;

    if (!htmlCode) {
        bubbleDiv.innerText = replyText;
        return;
    }

    const introText = replyText.split("```")[0].trim() ||
        (pdfHtmlCode ? "మీ PDF ready!" : "మీ website ready!");

    bubbleDiv.innerHTML = "";

    const introEl = document.createElement("div");
    introEl.innerText = introText;
    bubbleDiv.appendChild(introEl);

    const btnRow = document.createElement("div");
    btnRow.className = "website-actions";

    const previewBtn = document.createElement("button");
    previewBtn.className = "website-btn";
    previewBtn.innerText = "👁 Preview";
    previewBtn.addEventListener("click", () => openWebsitePreview(htmlCode));

    const downloadBtn = document.createElement("button");
    downloadBtn.className = "website-btn secondary";
    downloadBtn.innerText = pdfHtmlCode ? "📄 Download PDF" : "📄 Download";
    downloadBtn.addEventListener("click", () => {
        if (pdfHtmlCode) {
            downloadPdfFile(htmlCode, "nova-document");
        } else {
            downloadWebsiteFile(htmlCode);
        }
    });

    btnRow.appendChild(previewBtn);
btnRow.appendChild(downloadBtn);
    bubbleDiv.appendChild(btnRow);
}

function saveChatToStorage() {
    updateCurrentSession();
}

function sendMessage() {

    const text = userInput.value.trim();
    if (text === "") return;

    addMessage(text, "user");
    userInput.value = "";
    setSessionTitleIfNeeded(text);
    saveChatToStorage();

    const aiBubbleEl = addMessage(
        '<span class="typing-dots"><span></span><span></span><span></span></span>',
        "ai"
    );
    aiBubbleEl.id = "streamingBubble";

    (async function () {

        const reply = await MasterAgent.process(text, function (partialText) {
            const el = document.getElementById("streamingBubble");
            if (el) {
                el.querySelector(".bubble").innerText = partialText;
                chatArea.scrollTop = chatArea.scrollHeight;
            }
        });

        const el = document.getElementById("streamingBubble");
        if (el) {
            el.removeAttribute("id");
            renderAIBubbleContent(el.querySelector(".bubble"), reply);
            chatArea.scrollTop = chatArea.scrollHeight;
        }

        saveChatToStorage();
        speak(reply);

    })();

}


// ==========================================
// NOVA.AI VOICE OUTPUT
// (native speechSynthesis where supported,
//  cloud TTS fallback for WebViews like Acode)
// ==========================================

function speak(text) {

    const cleanText = text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");

    return new Promise((resolve) => {

        if ("speechSynthesis" in window) {

            speechSynthesis.cancel();

            function doSpeak() {
                const voices = speechSynthesis.getVoices();
                const speech = new SpeechSynthesisUtterance(cleanText);
                speech.lang = "en-IN";
                speech.rate = 1;
                speech.pitch = 1;

                const preferredVoice =
                    voices.find(v => v.lang === "en-IN") ||
                    voices.find(v => v.lang && v.lang.startsWith("en"));

                if (preferredVoice) speech.voice = preferredVoice;

                speech.onend = () => resolve();
                speech.onerror = (e) => {
                    console.error("🔊 Voice output error:", e.error);
                    resolve();
                };
                speechSynthesis.speak(speech);
            }

            const existingVoices = speechSynthesis.getVoices();
            if (existingVoices.length === 0) {
                speechSynthesis.onvoiceschanged = doSpeak;
            } else {
                doSpeak();
            }

            return;
        }

        speakViaCloudTTS(cleanText).then(resolve);
    });
}

function speakViaCloudTTS(text) {

    return new Promise((resolve) => {

        if (
            typeof NOVA_SECRETS === "undefined" ||
            !NOVA_SECRETS.VOICERSS_API_KEY ||
            NOVA_SECRETS.VOICERSS_API_KEY === "PASTE_YOUR_VOICERSS_KEY_HERE"
        ) {
            console.log("⚠️ VOICERSS_API_KEY set చేయలేదు - voice output skip అవుతుంది.");
            resolve();
            return;
        }

        const url =
            "https://api.voicerss.org/?key=" + NOVA_SECRETS.VOICERSS_API_KEY +
            "&hl=en-us&src=" + encodeURIComponent(text);

        const audio = new Audio(url);
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(err => {
            console.error("🔊 Cloud TTS play error:", err.name, "-", err.message);
            resolve();
        });

    });
}


// ==========================================
// STARTUP
// ==========================================

ensureSession();
loadCurrentSessionOrInit();

console.log("🤖 Nova.ai Main Controller Loaded");
