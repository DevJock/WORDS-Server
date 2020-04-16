const express = require("express");
const fs = require("fs");
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 2610;
let CODES = getCodesData();
let GAME = getGameData();
let USERS = getUsersData();

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get("/", (req, res) => res.send("WORDS SERVER"));

app.listen(port, () =>
  console.log(`Server listening at http://localhost:${port}`)
);

app.post("/", function (req, res) {
  let reportedGamerID = req.body.gamerID;
  let platformReported = req.body.gamePlatform;
  let ver = parseInt(
    req.body.gamePlatform.slice(
      req.body.gamePlatform.lastIndexOf("_"),
      req.body.gamePlatform.length
    )
  );
  let gamerData = {
    gamerID: reportedGamerID,
    platform: platformReported,
    version: ver,
  };
  res.setHeader("content-type", "application/json");
  if (!gamerData.gamerID) {
    console.log("missing gamer id");
    res.send(CODES.partial_content);
  }
  if (!validateBUILD(gamerData.platform)) {
    let resp = CODES.outdated_build;
    console.log(
      gamerData.gamerID + " tried logging in with " + gamerData.platform
    );
    res.send(resp);
  } else {
    updateGamePlayStatisticsForUser(gamerData);
    let obj = getWordList(GAME.wordFiles[0]);
    obj["enabled"] = GAME.enabled;
    obj["code"] = CODES.ok.code;
    obj["description"] = CODES.ok.description;
    res.send(obj);
  }
});

app.post("/uploadscore", function (req, res) {
  let gamerID = req.body.gamerID;
  let score = parseInt(req.body.score);
  updateScoreDataForUser(gamerID, score);
  res.setHeader("content-type", "application/json");
  res.send(CODES.ok);
});

app.post("/leaderboard", function (req, res) {
  res.setHeader("content-type", "application/json");
  let resp = CODES.ok;
  resp["leaderBoardData"] = getLeaderBoardData();
  res.send(resp);
});

app.post("/add", function (req, res) {
  if (
    !req.body.name ||
    !req.body.password ||
    !req.body.gamerID ||
    !req.body.email
  ) {
    let messg = CODES.partial_content;
    res.send(JSON.stringify(messg));
  } else {
    let user = {
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      gamerID: req.body.gamerID,
      games: [],
      totalGamesPlayed: 0,
      gameLeader: "N/A",
    };
    let resp = validateUser(user);

    if (resp.code == 444) {
      resp = registerNewUser(user);
    }
    res.send(resp);
  }
});

app.post("/gamer", function (req, res) {
  if (req.body.gamerID) {
    resp = getUserDetailsForGamerID(req.body.gamerID);
  } else {
    resp = CODES.not_found;
  }
  res.setHeader("content-type", "application/json");
  res.send(resp);
});

app.post("/authenticate", function (req, res) {
  if (req.body.email && req.body.password) {
    let user = { email: req.body.email, password: req.body.password };
    resp = authenticateUser(user);
  } else {
    resp = CODES.missing_content;
  }
  res.setHeader("content-type", "application/json");
  res.send(resp);
});

function getLeaderBoardData() {
  if (USERS.length <= 0) {
    return null;
  }
  let leaderboard = [];
  for (let user in USERS) {
    let newOBJ = {};
    newOBJ[user] = USERS[user].highScore;
    leaderboard.push(newOBJ);
  }
  return leaderboard;
}

function getWordList(wordFile) {
  let raw = fs.readFileSync("./data/" + wordFile, "utf8").trim();
  let wordData = { words: raw };
  return wordData;
}

function updateScoreDataForUser(gamerID, score) {
  USERS[gamerID].scores.push(score);
  let hs = USERS[gamerID].scores[0];
  for (let i = 1; i < USERS[gamerID].scores.length; i++) {
    if (USERS[gamerID].scores[i] > hs) {
      hs = USERS[gamerID].scores[i];
    }
  }
  USERS[gamerID].highScore = hs;
  console.log("Appending Score Data for:" + gamerID);
  fs.writeFileSync("./data/users.json", JSON.stringify(USERS));
}

function updateGamePlayStatisticsForUser(gamerData) {
  if (USERS[gamerData.gamerID]) {
    if (USERS[gamerData.gamerID].platforms[gamerData.platform]) {
      USERS[gamerData.gamerID].platforms[gamerData.platform] += 1;
      console.log(
        "Updating +1 platform count for:" +
          gamerData.gamerID +
          " for Platform " +
          gamerData.platform
      );
    } else {
      USERS[gamerData.gamerID].platforms[gamerData.platform] = 1;
      console.log(
        "Creating +1 platform record for:" +
          gamerData.gamerID +
          " for Platform " +
          gamerData.platform
      );
    }
  } else {
    let obj = {
      platforms: {},
      scores: [],
      highScore: 0,
    };
    obj.platforms[gamerData.platform] = 1;
    USERS[gamerData.gamerID] = obj;
    console.log("Creating new record for:" + gamerData.gamerID);
  }
  fs.writeFileSync("./data/users.json", JSON.stringify(USERS));
}

function authenticateUser(user) {
  for (let i = 0; i < USERS.length; i++) {
    if (USERS[i].email == user.email && USERS[i].password == user.password) {
      return CODES.accepted;
    }
  }
  return CODES.unauthorized;
}

function registerNewUser(user) {
  appendRawJSON("users.json", user);
  let resp = CODES.created;
  resp.gamerID = user.gamerID;
  resp.email = user.email;
  return resp;
}

function validateUser(user) {
  for (let i = 0; i < USERS.length; i++) {
    if (USERS[i].email == user.email || USERS[i].gamerID == user.gamerID) {
      return CODES.conflict;
    }
  }

  return CODES.not_found;
}

function listUser() {
  let userList = [];
  for (let i = 0; i < USERS.length; i++) {
    let user = {
      name: USERS[i].name,
      gamerID: USERS[i].gamerID,
    };
    userList[userList.length] = user;
  }
  return JSON.stringify(userList);
}

function getUserDetailsForGamerID(gamerID) {
  for (let i = 0; i < USERS.length; i++) {
    if (USERS[i].gamerID == gamerID) {
      return {
        name: user.name,
        gamerID: user.gamerID,
        email: user.email,
      };
    }
  }
  return CODES.not_found;
}

function validateBUILD(theBuild) {
  for (let i = 0; i < GAME.builds.length; i++) {
    if (GAME.builds[i] == theBuild) {
      return true;
    }
  }
  return false;
}

function getUsersData() {
  return readAndParseJSON("users.json");
}

function getCodesData() {
  return readAndParseJSON("codes.json");
}

function getGameData() {
  return readAndParseJSON("game.json");
}

function readAndParseJSON(fileName) {
  let stringIn = fs.readFileSync("./data/" + fileName, "utf8").trim();
  return JSON.parse(stringIn);
}

function appendRawJSON(fileName, newOBJ) {
  let jsonOBJ = readAndParseJSON(fileName);
  jsonOBJ.push(newOBJ);
  fs.writeFileSync("./data/" + fileName, JSON.stringify(jsonOBJ));
}
