const axios = require("axios");
const settings = require("./config/config");

const urlChecking = "https://raw.githubusercontent.com/Hunga9k50doker/APIs-checking/refs/heads/main/endpoints.json";

async function checkBaseUrl() {
  console.log("Checking api...".blue);
  if (settings.ADVANCED_ANTI_DETECTION) {
    const result = await getBaseApi(urlChecking);
    if (result.endpoint) {
      console.log("No change in api!", "success");
      return result;
    }
  } else {
    return {
      endpoint: settings.BASE_URL,
      message:
        "airdropsverse.com",
    };
  }
}

async function getBaseApi(url) {
  try {
    const response = await axios.get(url);
    const content = response.data;
    if (content?.pharos) {
      return { endpoint: content.pharos, message: content.copyright };
    } else {
      return {
        endpoint: null,
        message:
          "airdropsverse.com",
      };
    }
  } catch (e) {
    return {
      endpoint: null,
      message:
        " airdropsverse.com",
    };
  }
}

module.exports = { checkBaseUrl };
