const fs = require("fs");
const colors = require("colors");
const path = require("path");
require("dotenv").config();
const { jwtDecode } = require("jwt-decode");
const fsPromises = require("fs").promises; // Use FS.promises
const AsyncLock = require("async-lock");
const lock = new AsyncLock();
function _isArray(obj) {
  if (Array.isArray(obj) && obj.length > 0) {
    return true;
  }

  try {
    const parsedObj = JSON.parse(obj);
    return Array.isArray(parsedObj) && parsedObj.length > 0;
  } catch (e) {
    return false;
  }
}

function parseQueryString(query) {
  const params = new URLSearchParams(query);
  const parsedQuery = {};

  for (const [key, value] of params) {
    parsedQuery[key] = decodeURIComponent(value);
  }

  return parsedQuery;
}

function splitIdPet(num) {
  const numStr = num.toString();
  const firstPart = numStr.slice(0, 3); // Take the first 3 characters
  const secondPart = numStr.slice(3); // Remain

  return [parseInt(firstPart), parseInt(secondPart)];
}

// Jaw to override the environment
const envFilePath = path.join(__dirname, ".env");
function updateEnv(variable, value) {
  // Read file .env
  fs.readFile(envFilePath, "utf8", (err, data) => {
    if (err) {
      console.log("Cannot read .env file:", err);
      return;
    }

    // Create or update variables in the file
    const regex = new RegExp(`^${variable}=.*`, "m");
    let newData = data.replace(regex, `${variable}=${value}`); // Use let's instead of const

    // Check if the variable does not exist in the file, adds it at the end
    if (!regex.test(data)) {
      newData += `\n${variable}=${value}`;
    }

    // Record
    fs.writeFile(envFilePath, newData, "utf8", (err) => {
      if (err) {
        console.error("Không thể ghi file .env:", err);
      } else {
      }
    });
  });
}

async function sleep(seconds = null) {
  if (seconds && typeof seconds === "number") return new Promise((resolve) => setTimeout(resolve, seconds * 1000));

  let DELAY_BETWEEN_REQUESTS = [1, 5];
  if (seconds && Array.isArray(seconds)) {
    DELAY_BETWEEN_REQUESTS = seconds;
  }
  min = DELAY_BETWEEN_REQUESTS[0];
  max = DELAY_BETWEEN_REQUESTS[1];

  return await new Promise((resolve) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, delay * 1000);
  });
}

function randomDelay() {
  return new Promise((resolve) => {
    const minDelay = process.env.DELAY_REQUEST_API[0];
    const maxDelay = process.env.DELAY_REQUEST_API[1];
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    setTimeout(resolve, delay * 1000);
  });
}

function saveToken(id, token) {
  const tokens = JSON.parse(fs.readFileSync("tokens.json", "utf8"));
  tokens[id] = token;
  fs.writeFileSync("tokens.json", JSON.stringify(tokens, null, 4));
}

function getToken(id) {
  const tokens = JSON.parse(fs.readFileSync("tokens.json", "utf8"));
  return tokens[id] || null;
}
function isTokenExpired(token) {
  if (!token) return { isExpired: true, expirationDate: new Date().toLocaleString() };

  try {
    const payload = jwtDecode(token);
    if (!payload) return { isExpired: true, expirationDate: new Date().toLocaleString() };

    const now = Math.floor(Date.now() / 1000);

    const expirationDate = payload.exp ? new Date(payload.exp * 1000).toLocaleString() : "Infinity";
    const isExpired = now > payload.exp;

    return { isExpired, expirationDate };
  } catch (error) {
    console.log(`Error checking token: ${error.message}`.red);
    return { isExpired: true, expirationDate: new Date().toLocaleString() };
  }
}

function generateRandomHash() {
  const characters = "0123456789abcdef";
  let hash = "0x"; // Start with "0x"

  for (let i = 0; i < 64; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    hash += characters[randomIndex];
  }

  return hash;
}

function getRandomElement(arr) {
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}

function getRandomNumber(min, max, fix = 2) {
  return Number((Math.random() * (max - min) + min).toFixed(fix));
}

function loadData(file) {
  try {
    const datas = fs.readFileSync(file, "utf8").replace(/\r/g, "").split("\n").filter(Boolean);
    if (datas?.length <= 0) {
      console.log(colors.red(`Data cannot be found ${file}`));
      return [];
    }
    return datas;
  } catch (error) {
    console.log(`No file found ${file}`.red);
    return [];
  }
}

async function saveData(data, filename) {
  fs.writeFileSync(filename, data.join("\n"));
}

function log(msg, type = "info") {
  switch (type) {
    case "success":
      console.log(`[*] ${msg}`.green);
      break;
    case "custom":
      console.log(`[*] ${msg}`.magenta);
      break;
    case "error":
      console.log(`[!] ${msg}`.red);
      break;
    case "warning":
      console.log(`[*] ${msg}`.yellow);
      break;
    default:
      console.log(`[*] ${msg}`.blue);
  }
}

async function saveJson(id, value, filename) {
  await lock.acquire("fileLock", async () => {
    try {
      const data = await fsPromises.readFile(filename, "utf8");
      const jsonData = JSON.parse(data);
      jsonData[id] = value;
      await fsPromises.writeFile(filename, JSON.stringify(jsonData, null, 4));
    } catch (error) {
      console.error("Error saving JSON:", error);
    }
  });
}

function getItem(id, filename) {
  const data = JSON.parse(fs.readFileSync(filename, "utf8"));
  return data[id] || null;
}

function getOrCreateJSON(id, value, filename) {
  let item = getItem(id, filename);
  if (item) {
    return item;
  }
  item = saveJson(id, value, filename);
  return item;
}

function generateComplexId(length = 9) {
  const chars = "0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRandomNumber(length) {
  if (length < 1) return null;

  const firstDigit = Math.floor(Math.random() * 4) + 1;
  let number = firstDigit.toString();

  for (let i = 1; i < length; i++) {
    number += Math.floor(Math.random() * 10); // 0 to 9
  }

  return number;
}

function getRandomNineDigitNumber() {
  const min = 100000000;
  const max = 999999999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function decodeJWT(token) {
  const [header, payload, signature] = token.split(".");

  // Decode Base64 URL
  const decodeBase64Url = (str) => {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(str));
  };

  const decodedHeader = decodeBase64Url(header);
  const decodedPayload = decodeBase64Url(payload);

  return {
    header: decodedHeader,
    payload: decodedPayload,
    signature: signature, // You might not need to decode the signature
  };
}

module.exports = {
  _isArray,
  saveJson,
  decodeJWT,
  generateComplexId,
  getRandomNumber,
  updateEnv,
  saveToken,
  splitIdPet,
  getToken,
  isTokenExpired,
  generateRandomHash,
  getRandomElement,
  loadData,
  saveData,
  log,
  getOrCreateJSON,
  sleep,
  randomDelay,
  parseQueryString,
  getRandomNineDigitNumber,
  generateRandomNumber,
};
