const { SlashCommandBuilder } = require('@discordjs/builders');
const puppeteer = require('puppeteer');
var ffmpeg = require("fluent-ffmpeg");
const { MessageAttachment } = require('discord.js');

const fileNameOut = "IPL_Highlight.mp4";

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

        ffmpeg.ffprobe(file, function(error, metadata) {
            const clipDuration = metadata.format.duration;
            if (clipDuration > 35){
                reject("Clip is too long (clips should be under 35 seconds long)");
            } else {
                ffmpeg().withOptions([
                    "-i " + file, //take the twitch clip as an input
                    "-c:v libvpx-vp9", //encode it in a way that makes this work (idk how it works)
                    "-i ./overlays/" + tourney + ".webm", //take the overlay as an input
                    ])
                    .complexFilter([
                      {
                        "filter":"scale", "options":{s:"1280x720"}, "inputs":"[0:v]", "outputs":"[base]" //resize the twitch clip to 720p
                      },
                      {
                        "filter":"overlay", "inputs":"[base][1:v]" //overlay the overlay onto the twitch clip
                      }
                    ])
                    .withOptions([
                      "-r 30", //set fps to 30
                      "-b:a 96k", //compress the audio via bitrate
                      "-crf 26", //compress the video
                      "-c:v h264_qsv" //encode the video
                    ])
                .on('start', function(){
                    console.log("starting ffmpeg with input " + file + " and overlay " + tourney);
                })
                .on('error', function(err) {
                    console.log('An ffmpeg error occurred: ' + err.message);
                    return reject(new Error(err));
                })
                .on('end', function(){
                    console.log("ffmpeg is done!");
                    resolve();
                })
                .save(fileNameOut);
            }
        });
    })
}

//this runs when the highlight command is executed.
module.exports = {
    data,
    async execute(interaction) {

        const tourney = interaction.options.getString('tournament');
        const link = interaction.options.getString('link');
        
        //make sure this is a twitch link
        if (!link.match(/https:\/\/www\.twitch\.tv\/iplsplatoon\/clip\/[A-Za-z0-9]{1,}/)){ //https://www.twitch.tv/iplsplatoon/clip/
            await interaction.reply({
                content:"**Invalid link.**\nPlease enter an IPL twitch clip link!",
                ephemeral: true
            });
            return;
        }
        
        //tell both discord and the end user this might take a while
        await interaction.deferReply();

        //launch a headless browser and load the twitch page
        try{
            console.log("launching headless browser.");
            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.goto(link, { waitUntil: 'networkidle0' });
            console.log("page loaded, finding and getting video source.");

            //get the source link of the video
            const source = await page.evaluate(() => {
                return document.querySelector("video").currentSrc;
            });
            console.log("got video source " + source);
        } catch (err) {
            await interaction.editReply("The was an error getting this clip from twitch!\n`" + err + "`");
            return;
        }

        //we gotta change the link a bit before we can process it
        var vidIdSplit = source.split('?')[0].split('/');
        var vidId = vidIdSplit.at(-1);
        const clipLink = "https://clips-media-assets2.twitch.tv/" + vidId;
        console.log("The generated clip link is " + clipLink);
        
        //ffmpeg time
        await ffmpegOverlayer(clipLink, tourney)
            .then(() => {
                console.log("Uploading...");
                const file = new MessageAttachment(fileNameOut);
                interaction.editReply({files:[file]});
            }).catch((err) => {
                console.log("ffmpegOverlayer was rejected: " + err);
                interaction.editReply("There was an error processing this clip!\n`" + err + "`");
            });
    },
};