import { CommandInteraction } from "discord.js";

export const helpCommand = {
    name: "help",
    description: "List all available commands",
    async execute(interaction: CommandInteraction) {
        const helpMessage = `
        **Available Commands:**
        - /stats: Show player statistics
        - /setlanguage: Set the language for the bot
        - /help: List all available commands
        `;
        await interaction.reply(helpMessage);
    },
};
