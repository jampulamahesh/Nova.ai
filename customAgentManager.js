console.log("CustomAgentManager Loaded");

// ==========================================
// CUSTOM AGENT MANAGER
// Stores user-created mini-assistants (from the
// Agent Builder) in localStorage, and matches
// incoming messages against their trigger keywords.
// ==========================================

const CustomAgentManager = {

    STORAGE_KEY: "novaCustomAgents",

    getAll() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "[]");
        } catch (e) {
            return [];
        }
    },

    saveAll(agents) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(agents));
        } catch (e) {
            console.log("Custom agent save skipped:", e);
        }
    },

    // Adds a new agent, or overwrites an existing one with the same
    // name (case-insensitive) so re-creating "Fitness Coach" updates it.
    add(agent) {
        const agents = this.getAll();
        const idx = agents.findIndex(
            a => a.name.toLowerCase() === agent.name.toLowerCase()
        );
        if (idx !== -1) agents[idx] = agent;
        else agents.push(agent);
        this.saveAll(agents);
    },

    remove(name) {
        const agents = this.getAll().filter(
            a => a.name.toLowerCase() !== name.toLowerCase()
        );
        this.saveAll(agents);
    },

    // Returns the first custom agent whose trigger keyword appears
    // anywhere in the message, or null if none match.
    findMatch(message) {
        const msg = message.toLowerCase();
        const agents = this.getAll();
        return agents.find(a =>
            (a.keywords || []).some(k => msg.includes(k.toLowerCase()))
        ) || null;
    },

    listReply() {
        const agents = this.getAll();
        if (agents.length === 0) {
            return "మీరు ఇంకా ఏ custom agent create చేయలేదు. \"Create an agent that...\" అని చెప్పి ఒకటి తయారు చేసుకోండి!";
        }
        const lines = agents.map(
            a => "• **" + a.name + "** — trigger words: " + (a.keywords || []).join(", ")
        );
        return "మీ custom agents:\n\n" + lines.join("\n");
    },

    // Best-effort extraction of the agent name from a delete/remove
    // command like "delete agent Fitness Coach" or "remove the Recipe
    // Helper agent".
    extractNameFromDeleteCommand(message) {
        const match = message.match(
            /(?:delete|remove)\s+(?:the\s+)?(?:agent\s+)?(?:called\s+|named\s+)?["']?([a-zA-Z0-9 ]+?)["']?\s*(?:agent)?$/i
        );
        return match ? match[1].trim() : "";
    },

    removeReply(name) {
        if (!name) {
            return "⚠️ Ee agent ni delete cheyalo pేరు cheppandi. Example: \"delete agent Fitness Coach\"";
        }
        const before = this.getAll().length;
        this.remove(name);
        const after = this.getAll().length;
        if (after < before) {
            return "🗑️ \"" + name + "\" agent ni delete chesanu.";
        }
        return "⚠️ \"" + name + "\" pేరుతో agent kనిపించలేదు. \"list my agents\" ani అడిగి exact name chూడండి.";
    }

};
