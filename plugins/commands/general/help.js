const config = {
    name: "help",
    aliases: ["command"],
    description: "Beginner's guide",
    usage: "Help [page] or [command] or [all]",
    credits: "Developer",
    permissions: [0, 1, 2],
    cooldown: 3,
    isAbsolute: false,
    isHidden: false,
};

const langData = {
    "en_US": {
        "help.pageNotExists": "Page {page} does not exist. Please choose a page between 1 and {pages}.",
        "help.allCommands": "━━𝙰𝙻𝙻 𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂━━\n{commands}",
        "help.commandNotFound": "Command not found.",
        "help.commandDetails": `「 Command 」\n\n➛ Name: {name}\n➛ Version: {version}\n➛ Permissions: {roleMessage}\n➛ Aliases: {aliases}\n➛ Description: {description}\n➛ Usage: {usage}\n➛ Credits: {credits}\n➛ Cooldown: {cooldown}`,
    },
};

async function onCall({ api, event, enableCommands, args, getLang }) {
    const input = args.join(' ');

    try {
        const commands = enableCommands[0].commands;
        const totalCommands = commands.length;
        const pages = Math.ceil(totalCommands / 15); // Adjust the number 15 to change commands per page

        if (!input || !isNaN(input)) {
            const page = input ? parseInt(input) : 1;

            if (page < 1 || page > pages) {
                return api.sendMessage(getLang("help.pageNotExists", { page, pages }), event.threadID, event.messageID);
            }

            const start = (page - 1) * 15;
            const end = Math.min(start + 15, totalCommands);

            let helpMessage = `━━𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂━━\n`;
            for (let i = start; i < end; i++) {
                helpMessage += ` ⊂⊃ ➥ ${commands[i]}\n`;
            }

            helpMessage += `━━━━━━━━━━━━━━━\n`;
            helpMessage += `━━𝙲𝙾𝙼𝙼𝙰𝙽𝙳 𝙿𝙰𝙶𝙴 : <${page}/${pages}>━━\n`;
            helpMessage += `━━CHILLI 𝖠𝖨 𝖢𝖧𝖠𝖳𝖡𝖮𝖳━━\n`;
            helpMessage += `Total commands: ${totalCommands}\n`;
            helpMessage += `Type "help all" to see all commands.\n`;
            api.sendMessage(helpMessage, event.threadID, event.messageID);
        } else if (input.toLowerCase() === 'all') {
            let helpMessage = getLang("help.allCommands", { commands: commands.join('\n') });
            api.sendMessage(helpMessage, event.threadID, event.messageID);
        } else {
            const command = commands.find(c => c.name === input || c.aliases.includes(input));
            if (command) {
                const { name, version, role, aliases = [], description, usage, credits, cooldown } = command;
                const roleMessage = role === 0 ? '➛ Permission: user' : (role === 1 ? '➛ Permission: admin' : (role === 2 ? '➛ Permission: thread Admin' : ''));
                const aliasesMessage = aliases.length ? aliases.join(', ') : '';

                const message = getLang("help.commandDetails", {
                    name,
                    version,
                    roleMessage,
                    aliases: aliasesMessage,
                    description,
                    usage,
                    credits,
                    cooldown,
                });

                api.sendMessage(message, event.threadID, event.messageID);
            } else {
                api.sendMessage(getLang("help.commandNotFound"), event.threadID, event.messageID);
            }
        }
    } catch (error) {
        console.log(error);
    }
}

export default {
    config,
    langData,
    onCall
};
