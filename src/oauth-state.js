const uuid = require("uuid");

const EXPIRATION_IN_SECONDS = 10 * 60;
const COOKIE_NAME = "slack-app-oauth-state";

module.exports.issueNewState = (_, res) => {
  const newState = uuid.v4();
  // 1) set the value in the user's browser cookie
  res.setHeader("Set-Cookie", [
    `${COOKIE_NAME}=${newState}`,
    "Secure",
    "HttpOnly",
    "Path=/",
    `Max-Age=${EXPIRATION_IN_SECONDS}`
  ]);
  // 2) set the value on the server-side
  addToDatastore(newState);
  return newState;
};

module.exports.isValid = req => {
  // 0) the state parameter is available in the query string
  const givenState = req.query.state;
  if (!givenState) {
    console.log("State is not given");
    return false;
  }
  // 1) the value is the same with the one in the cookie-based session
  const stateInSession = parseCookies(req)[COOKIE_NAME];
  if (!stateInSession) {
    console.log("Cookie does not have state");
    return false;
  }
  if (stateInSession !== givenState) {
    console.log("Given state does not match state in session");
    return false;
  }
  // 2) the value is valid on the server-side
  if (!isAvailableInDatabase(givenState)) {
    console.log("Given state does not match state in database");
    return false;
  }
  return true;
};

function parseCookies(req) {
  const list = {},
    rc = req.headers.cookie;
  rc &&
    rc.split(";").forEach(cookie => {
      var parts = cookie.split("=");
      list[parts.shift().trim()] = decodeURI(parts.join("="));
    });
  return list;
}

const dummyDatabase = new Set();

function addToDatastore(newState) {
  dummyDatabase.add(newState);
}

function isAvailableInDatabase(givenState) {
  if (dummyDatabase.has(givenState)) {
    return true;
  }
  return false;
}

// https://github.com/slackapi/java-slack-sdk/blob/master/bolt/src/main/java/com/slack/api/bolt/service/OAuthStateService.java
