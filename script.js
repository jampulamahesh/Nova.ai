const input = document.getElementById("messageInput"); 
const sendBtn = document.querySelector(".send");
const chatBox = document.getElementById("chat-box");

function sendMessage() {
    const message = input.value.trim();

    if (message === "") return;

    // User Message
    const userMsg = document.createElement("div");
    userMsg.className = "user-message";
    userMsg.innerHTML = message;
    chatBox.appendChild(userMsg);

    input.value = "";

    // Auto Scroll
    chatBox.scrollTop = chatBox.scrollHeight;

    // Nova Reply
    const typing = document.createElement("div");
typing.className = "bot-message";
typing.innerHTML = "🤖 Nova.ai is typing...";
chatBox.appendChild(typing);

chatBox.scrollTop = chatBox.scrollHeight;
    setTimeout(() => {
      typing.remove();
        const botMsg = document.createElement("div");
        botMsg.className = "bot-message";
  if (
    message.toLowerCase().includes("hi") ||
    message.toLowerCase().includes("hello") ||
    message.toLowerCase().includes("hey")
) {
    botMsg.innerHTML =
    "🤖 <b>Nova.ai:</b><br><br>Hello Mahesh! 👋 Nice to meet you.";
}
else if (message.toLowerCase().includes("how are you")) {

    botMsg.innerHTML =
    "🤖 <b>Nova.ai:</b><br><br>I'm doing great! 😊 Thanks for asking.";
}
else if (
    message.toLowerCase().includes("time") ||
    message.toLowerCase().includes("what time")
) {
    const now = new Date();

    botMsg.innerHTML =
    "🤖 <b>Nova.ai:</b><br><br>🕒 Current Time: <b>" +
    now.toLocaleTimeString() +
    "</b>";
}
else if (
    message.toLowerCase().includes("date") ||
    message.toLowerCase().includes("today's date")
) {
    const now = new Date();

    const date =
        now.getDate() + "/" +
        (now.getMonth() + 1) + "/" +
        now.getFullYear();

    botMsg.innerHTML =
        "📅 <b>Nova.ai:</b><br><br>Today's Date: <b>" +
        date +
        "</b>";
}
else if (
    message.toLowerCase().includes("day") ||
    message.toLowerCase().includes("what day is today")
) {
    const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
    ];

    const today = new Date();

    botMsg.innerHTML =
        "📅 <b>Nova.ai:</b><br><br>Today is <b>" +
        days[today.getDay()] +
        "</b>";
}
else {
    botMsg.innerHTML =
    "🤖 <b>Nova.ai:</b><br><br>I'm still learning. 😊";
}

        chatBox.appendChild(botMsg);

        chatBox.scrollTop = chatBox.scrollHeight;
    }, 1500);
}

// Send Button
if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
}

if (input) {
    input.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
            sendMessage();
        }
    });
}
const clearBtn = document.getElementById("clearBtn");

clearBtn.addEventListener("click", function () {
    chatBox.innerHTML = "";
});
// ===== Voice Recognition =====

const micBtn = document.getElementById("micBtn");

if (micBtn) {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();

        recognition.lang = "en-US";
        recognition.continuous = false;
        recognition.interimResults = false;

        micBtn.addEventListener("click", () => {
            recognition.start();
        });

        recognition.onresult = (event) => {
            const speech = event.results[0][0].transcript;
            input.value = speech;
            sendMessage();
        };

        recognition.onerror = (event) => {
            alert("Voice Error: " + event.error);
        };
    } else {
        alert("Speech Recognition is not supported in this browser.");
    }
}