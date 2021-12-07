const { SlashCommandBuilder } = require('@discordjs/builders');
const puppeteer = require('puppeteer');

const data = new SlashCommandBuilder()
    .setName("highlight")
    .setDescription("Creates a downloadable stream highlight from a twitch clip.")
    .addStringOption(option =>
        option.setName('tournament')
            .setDescription('Specify which tournament this clip is from.')
            .setRequired(true)
            .addChoice("Low Ink", "low_ink")
            .addChoice("Swim or Sink", "swim_or_sink")
            .addChoice("King of the Castle", "king_of_the_castle")
            .addChoice("Reef Rushdown", "reef_rushdown")
    )
    .addStringOption(option =>
        option.setName('link')
            .setDescription("Attach a Twitch clip link.")
            .setRequired(true)
    );

module.exports = {
    data,
    async execute(interaction) {
        await interaction.deferReply();

        const option = interaction.options.getString('tournament');
        const link = interaction.options.getString('link');
        
        //const browser = await puppeteer.launch();
        //const page = await browser.newPage();
    },
};