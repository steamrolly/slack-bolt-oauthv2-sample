const { App, ExpressReceiver } = require("@slack/bolt");
const oauthState = require("./oauth-state");

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const config = {
  client_id: process.env.SLACK_CLIENT_ID,
  client_secret: process.env.SLACK_CLIENT_SECRET,
  scope: "users:read"
};

const authorizeFn = async ({ teamId, enterpriseId }) => {
  console.log(`teamId: ${teamId}, enterpriseId: ${enterpriseId}`);
  for (const team of teams) {
    if (team.teamId === teamId && team.enterpriseId === enterpriseId) {
      return {
        botToken: team.botToken,
        botId: team.botId,
        botUserId: team.botUserId
      };
    }
  }
  throw new Error("No matching authorizations");
};

const app = new App({
  receiver: receiver,
  authorize: authorizeFn
});

const teams = [
  {
    teamId: "T12345",
    enterpriseId: "E1234A12AB",
    botToken: "xoxb-123abc",
    botId: "B1251",
    botUserId: "U12385"
  }
];

receiver.app.get("/", (_, res) => {
  res.status(200).send("Hello World! from bolt");
});

receiver.app.get("/oauth", (req, res) => {
  const state = oauthState.issueNewState(req, res);
  res.redirect(
    `https://slack.com/oauth/v2/authorize?` +
      `client_id=${config.client_id}` +
      `&scope=${config.scope}` +
      `&state=${state}`
  );
});

receiver.app.get("/callback", async (req, res) => {
  console.log(`req: ${JSON.stringify(req.query, "", 4)}`);

  if (!oauthState.isValid(req)) {
    res.status(401).send("Invalid state in OAuth flow");
    return;
  }

  const data = await app.client.oauth.v2.access({
    client_id: config.client_id,
    client_secret: config.client_secret,
    code: req.query.code
  });
  console.log(`data: ${JSON.stringify(data, "", 4)}`);

  const botInfo = await app.client.users.info({
    token: data.access_token,
    user: data.bot_user_id
  });
  console.log(`botInfo: ${JSON.stringify(botInfo, "", 4)}`);

  teams.push({
    teamId: data.team.id,
    enterpriseId: data.enterprise ? data.enterprise.id : null,
    botToken: data.access_token,
    botId: botInfo.user.profile.bot_id,
    botUserId: data.bot_user_id
  });
  console.log(`teams: ${JSON.stringify(teams, "", 4)}`);

  res.status(201).send("Slack App Installation Succeeded!!");
});

app.message(/^help$/, ({ say }) => {
  say(`Available Message: URL, help, debug`);
});

app.message("hello", ({ message, say }) => {
  console.log("hello");
  say(
    `Hey there <@${message.user}>!\nYour message.user is ${JSON.stringify(
      message.user
    )}`
  );
});

app.message("debug", ({ message, payload, body, say }) => {
  say(`body : ${JSON.stringify(body, "", 4)}`);
  say(
    `payload : ${
      JSON.stringify(payload) === JSON.stringify(body.event) ? "" : "NOT"
    } equals body.event\n` +
      `message : ${
        JSON.stringify(message) === JSON.stringify(payload) ? "" : "NOT"
      } equals payload`
  );
});

app.error(error => {
  console.error(error);
});

(async () => {
  const server = await app.start(process.env.PORT || 8080);
  console.log("⚡️ Bolt app is running!", server.address());
})();
