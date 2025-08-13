// server.js
require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const app = express();

// Middleware
app.use(express.static('.')); // Serves index.html, register.html, etc.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Discord Bot Setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`🤖 Discord bot is online as ${client.user.tag}`);
});

// Store pending applications (in production, use a database)
const pendingApps = new Collection();

// Accept/Deny Buttons
function getButtons(appId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept_${appId}`)
      .setLabel('✅ Accept')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`deny_${appId}`)
      .setLabel('❌ Deny')
      .setStyle(ButtonStyle.Danger)
  );
  return row;
}

// Handle form submission
app.post('/submit', (req, res) => {
  const { name, email, phone, dob, location, role, skills, why } = req.body;

  // Calculate age as of Aug 13, 2025
  const ageDate = new Date('2025-08-13');
  const birthDate = new Date(dob);
  let age = ageDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = ageDate.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ageDate.getDate() < birthDate.getDate())) {
    age--;
  }

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
      { 
        name: '✅ Eligible?', 
        value: eligible 
          ? 'Yes (13+ as of Aug 13, 2025)' 
          : 'No (Underage)', 
        inline: true 
      }
    )
    .setColor(eligible ? 3066993 : 15158332)
    .setTimestamp()
    .setFooter({ text: `Application ID: ${appId}` });

  const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
  if (channel && eligible) {
    channel.send({
      embeds: [embed],
      components: [getButtons(appId)]
    }).then(() => {
      pendingApps.set(appId, { name, email, phone, role });
    }).catch(console.error);
  }

  // Immediate response to user
  res.send(`
    <h2 style="text-align: center; margin-top: 40px;">
      Thank you, ${name}!
    </h2>
    <p style="text-align: center;">
      Your application has been sent. 
      ${eligible ? 'You’ll be contacted if accepted.' : 'You must be 13+ as of Aug 13, 2025.'}
    </p>
    <p style="text-align: center;">
      <a href="/">← Back to Home</a>
    </p>
  `);
});

// Discord Button Interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const { customId, message, user } = interaction;
  const appId = customId.split('_')[1];

  const application = pendingApps.get(appId);
  if (!application) {
    await interaction.reply({ content: '❌ Application not found.', ephemeral: true });
    return;
  }

  if (customId.startsWith('accept_')) {
    await interaction.reply({
      content: `✅ **Accepted** by ${user.username}\n\n📬 Sent email to ${application.email} (simulated).`,
      ephemeral: false
    });

    // In real use, send real email (via Nodemailer, etc.)
    console.log(`[ACCEPT] ${application.name} (${application.email})`);
    pendingApps.delete(appId);

  } else if (customId.startsWith('deny_')) {
    await interaction.reply({
      content: `❌ **Denied** by ${user.username}`,
      ephemeral: false
    });

    console.log(`[DENY] ${application.name} (${application.email})`);
    pendingApps.delete(appId);
  }

  // Disable buttons after click
  const newComponents = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('accepted')
      .setLabel('Accepted')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true)
  );
  if (customId.startsWith('accept_')) newComponents.components[0].setLabel('Accepted');
  if (customId.startsWith('deny_')) {
    newComponents.components[0].setLabel('Denied');
    newComponents.components[0].setStyle(ButtonStyle.Danger);
  }

  await message.edit({ components: [newComponents] });
});

// Start Server & Bot
const PORT = process.env.PORT || 3000;

client.login(process.env.DISCORD_TOKEN).then(() => {
  app.listen(PORT, () => {
    console.log(`🌍 Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ Failed to log in to Discord:', err);
});
