import { CommandInteraction } from "discord.js";
import i18n from 'i18n';

export const setLanguageCommand = {
    name: "setlanguage",
    description: "Set the language for the bot",
    options: [
        {
            name: "language",
            type: "STRING",
            description: "Choose a language (en-US or es-EU)",
            required: true,
            choices: [
                { name: "English", value: "en-US" },
                { name: "Español", value: "es-EU" },
            ],
        },
    ],
    async execute(interaction: CommandInteraction) {
        const language = interaction.options.getString("language");
        i18n.setLocale(language); // Change the language
        await interaction.reply(`Language set to ${language}`);
    },
};
