const config = require("./config.json");

function redirect(requestDetails) {
  const url = requestDetails.url;
  if (url.includes("/api/view")) {
    return {
      redirectUrl: `${config.mockApiDomain}/api/view`,
    };
  } else if (url.includes("/api/mail")) {
    return {
      redirectUrl: `${config.mockApiDomain}/api/mail`,
    };
  }
}

browser.webRequest.onBeforeRequest.addListener(
  redirect,
  { urls: config.filterUrl },
  ["blocking", "requestBody"]
);
