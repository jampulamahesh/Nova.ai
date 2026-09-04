console.log("MasterAgent Loaded");

const MasterAgent = {

    // Keeps recent turns so the AI has context (Phase 4 requirement)
    conversationHistory: [],

    async process(message, onChunk) {

        const category = AgentManager.getAgent(message);
        console.log("MASTER -> CATEGORY:", category);

        // ---- Local instant agents (no internet/AI needed) ----
        if (category === "calculator") {
            const reply = CalculatorAgent.reply(message);
            if (onChunk) onChunk(reply);
            return reply;
        }

        if (category === "memory") {
            const reply = MemoryAgent.reply(message);
            if (onChunk) onChunk(reply);
            return reply;
        }

        if (category === "listagents") {
            const reply = CustomAgentManager.listReply();
            if (onChunk) onChunk(reply);
            return reply;
        }

        if (category === "deleteagent") {
            const name = CustomAgentManager.extractNameFromDeleteCommand(message);
            const reply = CustomAgentManager.removeReply(name);
            if (onChunk) onChunk(reply);
            return reply;
        }

        // ---- AI-powered agents: pick the right specialist prompt ----
        let systemPrompt = NOVA_CONFIG.SYSTEM_PROMPT;
        let maxTokens = 400;

        if (category === "teacher") systemPrompt = TeacherAgent.systemPrompt;
        else if (category === "coding") systemPrompt = CodingAgent.systemPrompt;
        else if (category === "web") systemPrompt = WebAgent.systemPrompt;
        else if (category === "fun") systemPrompt = FunAgent.systemPrompt;
        else if (category === "websitebuilder") {
            systemPrompt = WebsiteBuilderAgent.systemPrompt;
            maxTokens = 2500; // a full HTML file needs much more room
        }
        else if (category === "pdfcreator") {
            systemPrompt = PdfAgent.systemPrompt;
            maxTokens = 2500; // a full document needs much more room
        }
        else if (category === "agentbuilder") {
            systemPrompt = AgentBuilderAgent.systemPrompt;
            maxTokens = 700;
        }
        else if (category === "imagegen") {
            systemPrompt = ImageAgent.systemPrompt;
            maxTokens = 300; // just a prompt, not a long reply
        }
        else if (category.startsWith("custom:")) {
            const agentName = category.slice(7);
            const savedAgent = CustomAgentManager.getAll().find(
                a => a.name === agentName
            );
            if (savedAgent) systemPrompt = savedAgent.systemPrompt;
        }

        const reply = await callNovaAI(message, systemPrompt, this.conversationHistory, onChunk, maxTokens);

        // Update rolling context (last 10 exchanges = 20 messages)
        this.conversationHistory.push({ role: "user", content: message });
        this.conversationHistory.push({ role: "assistant", content: reply });

        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }

        return reply;
    },

    clearMemory() {
        this.conversationHistory = [];
    }

};
