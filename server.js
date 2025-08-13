// server.js
require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js'); // ← Added Collection here
const app = express();

app.use(express.static('.'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once('ready', () => {
  console.log(`🤖 FutureCommon Bot: ${client.user.tag}`);
});

// ✅ Now defined correctly
const pendingApps = new Collection();

function getButtons(appId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`accept_${appId}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`deny_${appId}`).setLabel('❌ Deny').setStyle(ButtonStyle.Danger)
  );
}

app.post('/submit', (req, res) => {
  const { name, email, phone, dob, location, role, skills, why } = req.body;
  const birthDate = new Date(dob);
  const ageOnTarget = new Date('2025-08-13');
  let age = ageOnTarget.getFullYear() - birthDate.getFullYear();
  const m = ageOnTarget.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && ageOnTarget.getDate() < birthDate.getDate())) age--;
  const eligible = age >= 13;

  const appId = Date.now().toString();

  const embed = new EmbedBuilder()
    .setTitle('📬 New Co-Gov Application')
    .addFields(
      { name: '👤 Name', value: name, inline: true },
      { name: '📧 Email', value: `<${email}>`, inline: true },
      { name: '📱 Phone', value: phone, inline: true },
      { name: '📅 DOB', value: dob, inline: true },
      { name: '📍 Location', value: location, inline: true },
      { name: '🎯 Role', value: role, inline: true },
      { name: '🔧 Skills', value: skills || 'Not specified' },
      { name: '💡 Why Join?', value: why || 'Not specified' },
      { name: '✅ Eligible?', value: eligible ? 'Yes (13+ as of Aug 13, 2025)' : 'No', inline: true }
    )
    .setColor(eligible ? 3066993 : 15158332)
    .setTimestamp()
    .setFooter({ text: `App ID: ${appId}` });

  const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
  if (channel && eligible) {
    channel.send({ embeds: [embed], components: [getButtons(appId)] })
      .then(() => pendingApps.set(appId, { name, email, role }))
      .catch(console.error);
  }

  res.send(`
    <h2 style="text-align: center; margin-top: 40px;">Thank you, ${name}!</h2>
    <p style="text-align: center;">${eligible ? 'Your application has been sent. You’ll be contacted if accepted.' : 'You must be 13+ as of Aug 13, 2025.'}</p>
    <p style="text-align: center;"><a href="/">← Back to Home</a></p>
  `);
});

client.on('interactionCreate', async (i) => {
  if (!i.isButton()) return;
  const [action, appId] = i.customId.split('_');
  const app = pendingApps.get(appId);
  if (!app) return i.reply({ content: '❌ Application not found.', ephemeral: true });

  await i.reply({ 
    content: action === 'accept' 
      ? `✅ Accepted by ${i.user.username}` 
      : `❌ Denied by ${i.user.username}`, 
    ephemeral: false 
  });
  pendingApps.delete(appId);

  // Disable buttons after click
  const updatedRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('used')
      .setLabel(action === 'accept' ? 'Accepted' : 'Denied')
      .setStyle(action === 'accept' ? ButtonStyle.Success : ButtonStyle.Danger)
      .setDisabled(true)
  );
  await i.message.edit({ components: [updatedRow] });
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN).then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🌍 Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ Failed to log in to Discord:', err);
});
