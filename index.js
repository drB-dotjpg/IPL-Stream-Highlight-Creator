//require necessary js classes
const fs = require('fs');
const { Client, Intents, Collection } = require('discord.js');
const { token } = require("./config.json");

//create a new client instance
const client = new Client({
    intents: [Intents.FLAGS.GUILDS]
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

//run this when this client is ready
client.once('ready', () => {
    console.log("Ready");
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;

	const command = client.commands.get(interaction.commandName);

	if (!command) return;

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'I had trouble executing that command!', ephemeral: true });
	}
});

client.login(token);