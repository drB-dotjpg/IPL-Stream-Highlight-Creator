const { SlashCommandBuilder } = require('@discordjs/builders');
const puppeteer = require('puppeteer');
const concat = require('ffmpeg-concat');
const { encoder, s3_keyId, s3_bucket, s3_endpoint, s3_path, s3_secretAccessKey, s3_url } = require("../config.json");

const fileNameOut = "_comp.mp4";

//create s3 server data
var AWS = require('aws-sdk');

AWS.config.credentials = {
    accessKeyId: s3_keyId,
    secretAccessKey: s3_secretAccessKey,
};
var ep = new AWS.Endpoint(s3_endpoint);
var s3 = new AWS.S3({endpoint: ep});

const data = new SlashCommandBuilder()
    .setName("compilation")
    .setDescription("Combines multiple twitch clips into one video.")
    .addStringOption(option =>
        option.setName('clips')
            .setDescription('Add urls to twitch clips, seperated by spaces')
            .setRequired(true)
    );

//this runs when the compilation command is executed.
module.exports = {
    data,
    async execute(interaction) {

        const clipsUrls = interaction.options.getString('clips').split(' ');
        
        //make sure these are twitch links
        for (var i = 0; i < clipsUrls.length; i++){
            if (!clipsUrls[i].match(/https:\/\/www\.twitch\.tv\/iplsplatoon\/clip\/[A-Za-z0-9]{1,}/) //https://www.twitch.tv/iplsplatoon/clip/
            && !clipsUrls[i].match(/https:\/\/clips\.twitch\.tv/)){ //https://clips.twitch.tv/
                await interaction.reply({
                    content:"**URL #" + (i+1) + " is invalid.**\nPlease enter an IPL twitch clip link!",
                    ephemeral: true
                });
                return;
            }
        }
        
        //tell both discord and the end user this might take a while
        await interaction.deferReply();

        try{
            //launch a headless browser and load the twitch page
            var sources = [];
            try{
                console.log("launching headless browser.");
                const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], });

                for (var i = 0; i < clipsUrls.length; i++){
                    const page = await browser.newPage();

                    await page.goto(clipsUrls[i], { waitUntil: 'networkidle0' });
                    console.log("(URL " + i + ") page loaded, finding and getting video source.");

                    //get the source link of the video
                    sources[i] = await page.evaluate(() => {
                        return document.querySelector("video").currentSrc;
                    });
                    console.log("(URL " + i + ") got video source " + sources[i]);
                    
                    //we gotta change the link a bit before we can process it
                    var vidIdSplit = sources[i].split('?')[0].split('/');
                    var vidId = vidIdSplit.at(-1);
                    sources[i] = "https://clips-media-assets2.twitch.tv/" + vidId;
                    console.log("(URL " + i + ") The generated clip link is " + sources[i]);
                }

                await browser.close(); 

            } catch (err) {
                await interaction.editReply("There was an error getting a clip from twitch!\n`" + err + "`");
                return;
            }

            var fileName = Date.now() + fileNameOut;
            
            //ffmpeg time
            await concat({
                output: fileName,
                videos: sources,
                transition: {
                  name: 'fadecolor',
                  duration: 500
                },
                args: ['-c:v', encoder, '-profile:v', 'main', '-preset', 'medium', '-crf 18', '-movflags', 'faststart']
              })
            .then(function(){
                console.log("Uploading...");
                
                //upload to server
                var uploadParams = {Bucket: s3_bucket, Key: '', Body: ''};
                const fs = require('fs');
                var fileStream = fs.createReadStream(fileName);
                fileStream.on('error', function(err) {
                    console.log('File Error', err);
                });
                uploadParams.Body = fileStream;
                var path = require('path');
                uploadParams.Key = s3_path + path.basename(fileName);

                s3.upload(uploadParams, function(err,data){
                    if (err){
                        console.log("Upload Error",err);
                        interaction.editReply("There was an error uploading to the server!");
                        deleteFile(fileName);
                    }
                    if (data){
                        console.log("Uploaded file", data.Location);
                        var fileLoc = data.Location;
                        if (!fileLoc.includes("https")){
                            fileLoc = s3_url + fileLoc;
                        }
                        interaction.editReply(fileLoc);
                        deleteFile(fileName);
                    }
                });
                
            }).catch(function(err) {
                console.log("concat had an error: " + err);
                interaction.editReply("There was an error processing these clips!\n`" + err + "`");
            });
        }
        catch (err) {
            await interaction.editReply("There was a error carrying out this command!\n`" + err + "`");
        }   
    },
};

function deleteFile(fileName){
    const fs = require('fs');
    fs.unlink(fileName, (err) => { 
        if (err) { 
          console.log(err); 
        }
    });
}