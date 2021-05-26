const { App } = require("@slack/bolt");
const lunchHelper = require('./helper/lunchHelper');
require("dotenv").config();
// Initializes your app with your bot token and signing secret
const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    // socketMode: true,
    // appToken: process.env.APP_TOKEN
});

app.command("/lunch", async ({ command, ack, say }) => {
    try {
        console.log(command)
        await ack();
        say(await lunchHelper.getActivity());
        // say(lunchHelper.getLunchList());
        // say("Yaaay! that command works!");
    } catch (error) {
        console.log("err")
        console.error(error);
    }
});


app.event('app_mention', async ({ event, payload, client }) => {
    try {
        console.log(payload)
        const result = await client.chat.postMessage({
            channel: payload.channel,
            text: `Welcome to the team, <@${event.user.id}>! 🎉 You can introduce yourself in this channel.`
        });
        console.log(result);
    }
    catch (error) {
        console.error(error);
    }
});

app.message("hey", async ({ command, say }) => {
    try {
        say("Yaaay! that command works!");
    } catch (error) {
        console.log("err")
        console.error(error);
    }
});

// matches any string that contains the string hey
app.message(/hey/, async ({ command, say }) => {
    try {
        say("Yaaay! that command works!");
    } catch (error) {
        console.log("err")
        console.error(error);
    }
});

(async () => {
    const port = 3000
    // Start your app
    await app.start(process.env.PORT || port);
    console.log(`⚡️ Slack Bolt app is running on port ${port}!`);
})();