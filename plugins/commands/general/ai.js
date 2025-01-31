import axios from 'axios'; // Make sure to install axios if not installed

const config = {
    name: "ai",
    aliases: ["chat", "gpt"],
    description: "Interact with GPT-4 via API",
    usage: "[query]",
    cooldown: 3,
    permissions: [0], // General users can access
    isAbsolute: false,
    isHidden: false,
    credits: "XaviaTeam",
};

const langData = {
    "lang_1": {
        "message": "Please provide a prompt to interact with the AI.",
    },
    "lang_2": {
        "message": "Kailangan mo magbigay ng prompt para makipag-ugnayan sa AI.",
    }
};

async function onCall({ message, args, getLang, data, userPermissions, prefix }) {
    if (args.length === 0) {
        // If no arguments (prompt) are provided, send a message back.
        return message.reply(getLang("message"));
    }

    const input = args.join(" "); // Combine arguments into a single prompt
    const userId = data.user?.id || 100; // User ID from data or default to 100

    try {
        // Use axios to make the API request
        const { data } = await axios.get('https://api.shizuki.linkpc.net/api/mixtral', {
            params: {
                q: input,
            }
        });

        if (data && data.response) {
            message.reply(data.response); // Send AI's response to the user
        } else {
            message.reply("Sorry, I couldn't understand the response from the AI.");
        }
    } catch (error) {
        message.send("An error occurred while trying to reach the AI. Please try again later.");
        console.error("Error while calling AI API:", error);
    }
}

export default {
    config,
    langData,
    onCall
};
