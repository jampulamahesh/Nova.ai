console.log("AgentManager Loaded");

const AgentManager = {

    getAgent(message) {

        const msg = message.toLowerCase().trim();

        // ---- CALCULATOR: only if message is PURE math ----
        const isPureMath =
            /^[0-9+\-*/().\s]+$/.test(msg) &&
            /[0-9]/.test(msg);

        if (isPureMath) return "calculator";

        // ---- MEMORY: name related ----
        if (
            msg.startsWith("my name is") ||
            msg.includes("who am i") ||
            msg.includes("my name")
        ) {
            return "memory";
        }

        // ---- CUSTOM AGENT MANAGEMENT (list / delete / create) ----
        // Checked early so these meta-commands aren't swallowed by a
        // matching custom agent's own trigger keywords below.
        if (
            (/\b(list|show)\b/.test(msg) && /\bagents?\b/.test(msg)) ||
            msg === "my agents"
        ) {
            return "listagents";
        }

        if (/\b(delete|remove)\b[\s\S]*\bagent\b/.test(msg)) {
            return "deleteagent";
        }

        if (/\b(create|make|build|design)\b[\s\S]*\bagent\b/.test(msg)) {
            return "agentbuilder";
        }

        // ---- CUSTOM AGENT KEYWORD MATCH (user-created agents) ----
        const customMatch = CustomAgentManager.findMatch(message);
        if (customMatch) {
            return "custom:" + customMatch.name;
        }

        // ---- IMAGE / PROMPT GENERATOR ----
        if (
            /\b(generate|create|make|draw|design)\b[\s\S]*\b(image|picture|photo|art|artwork|wallpaper)\b/.test(msg) ||
            /\b(image|picture|photo|artwork)\b[\s\S]*\b(generate|create|of|for me|please)\b/.test(msg)
        ) {
            return "imagegen";
        }

        // ---- WEBSITE BUILDER (checked before coding/web so a
        // request like "build a website with html" isn't caught
        // by the generic coding/web keyword checks below) ----
        if (
            /\b(build|create|make|generate|design)\b[\s\S]*\b(website|web page|webpage|landing page|portfolio site|site for)\b/.test(msg) ||
            /\b(website|webpage|landing page)\b[\s\S]*\b(for me|please|build|create)\b/.test(msg)
        ) {
            return "websitebuilder";
        }

        // ---- PDF CREATOR (checked before coding/web/teacher so a
        // request like "create a pdf about python" or "explain X,
        // give me a pdf" isn't caught by those categories first) ----
        if (/\bpdf\b/.test(msg)) {
            return "pdfcreator";
        }

        // ---- CODING ----
        if (
            /\b(python|java|c\+\+|javascript|html|css|programming|code|coding|debug|error|function|variable|loop|array|api|bug)\b/.test(msg)
        ) {
            return "coding";
        }

        // ---- WEB ----
        if (
            /\b(website|web design|frontend|backend|server|deploy|domain|hosting)\b/.test(msg)
        ) {
            return "web";
        }

        // ---- TEACHER ----
        if (
            /\b(teach|explain|what is|how does|learn|concept|subject|study|meaning of)\b/.test(msg)
        ) {
            return "teacher";
        }

        // ---- FUN ----
        if (/\b(joke|funny|fun|laugh)\b/.test(msg)) {
            return "fun";
        }

        // ---- GENERAL (default AI chat) ----
        return "general";
    }
};
