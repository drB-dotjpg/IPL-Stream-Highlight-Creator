const { SlashCommandBuilder } = require('@discordjs/builders');
const puppeteer = require('puppeteer');
var ffmpeg = require("fluent-ffmpeg");
const { MessageAttachment } = require('discord.js');

//create the data found in the slash command
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

function ffmpegOverlayer(file, tourney) {
    return new Promise((resolve, reject) => {
        ffmpeg().withOptions([
            "-i " + file,
            "-c:v libvpx-vp9",
            "-i overlay.webm",
            "-filter_complex overlay",
            "-c:v h264_qsv",
            "-b:v 1M"
        ])
        .on('error', function(err) {
            console.log('An ffmpeg error occurred: ' + err.message);
            return reject(new Error(err));
        })
        .on('end', function(){
            resolve();
        })
        .save("ffmpegtester.mp4");
    })
}

//this runs when the highlight command is executed.
module.exports = {
    data,
    async execute(interaction) {

        const option = interaction.options.getString('tournament');
        const link = interaction.options.getString('link');
        
        //make sure this is a twitch link
        if (!link.match(/https:\/\/www\.twitch\.tv\/[A-Za-z0-9]{1,}/)){
            await interaction.reply({
                content:"**Invalid link.**\nPlease enter a twitch clip link!",
                ephemeral: true
            });
            return;
        }
        
        //tell both discord and the end user this might take a while
        await interaction.deferReply();

        /*
        //launch a headless browser and load the twitch page
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(link);

        //get the source link of the video
        const source = await page.evaluate(() => {
            return document.querySelector("video").currentSrc;
        });

        //we gotta change the link a bit before we can process it
        var vidIdSplit = source.split('?')[0].split('/');
        var vidId = vidIdSplit.at(-1);
        const clipLink = "https://clips-media-assets2.twitch.tv/" + vidId;
        console.log("The clip link is " + clipLink);
        */

        //ffmpeg time
        await ffmpegOverlayer("https://clips-media-assets2.twitch.tv/AT-cm%7CsgDMFI544-cdXBmutczwDg-720.mp4", option);

        const file = new MessageAttachment("ffmpegtester.mp4");
        interaction.editReply({files:[file]});

    },
};