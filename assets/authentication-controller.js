let token = localStorage.getItem("mfaToken") || null;
let userActive = true;
const setToken = (token) => localStorage.setItem("mfaToken", token || null);

const TOKEN_REFRESH_INTERVAL = 30 * 60 * 1000;

/**
 * refresh token in certain intervals
 */
function scheduleTokenRefresh() {
  setTimeout(refreshToken, TOKEN_REFRESH_INTERVAL);
}

/**
 * Refresh token to get new token
 * @returns
 */
async function refreshToken() {
  if (!userActive) return;
  userActive = false;

  try {
    const response = await fetch("/refresh-token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: token }),
    });
    const { token: newToken } = await response.json();
    scheduleTokenRefresh();
    token = newToken;
    setToken(newToken);
    return {
      token: newToken,
    };
  } catch {
    return {
      token: null,
    };
  }
}

/**
 * This function show appropriate messages if the token is invalid
 */
function handleInvalidToken() {
  $("#password-form").show();
  $("#auth-successful").hide();
  $("#mfa-form").hide();
  $("#flow-loader").hide();
  $("#flow-deploy").hide();
  $("#flow-deployed").hide();
  $("#password-input").focus();
}

/**
 * Parse JWT token
 * @param {*} token
 * @returns
 */
function parseJwt(token) {
  var base64Url = token.split(".")[1];
  var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  var jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );

  return JSON.parse(jsonPayload);
}

/**
 * This allows us to use the simulation page once every check is passed
 */
function readyToUse() {
  THIS = "readyToUse:";
  console.log(THIS, "running");
  $("#ready-to-use").show();
}

/**
 * Trigger multi factor authentication and store the token in the localstorage
 * @param {*} e - HTML event for button click
 */
async function mfa(e) {
  e.preventDefault();
  userActive = true;

  const mfaInput = $("#mfa-input").val();
  await fetch("/mfa", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mfaCode: mfaInput, token: token }),
  })
    .then((response) => {
      if (!response.ok) {
        $("#mfa-error").text(
          response.status === 401
            ? response.headers.get("Error-Message")
            : "There was an error in verifying your security code."
        );
        throw Error(response.statusText);
      }

      return response;
    })
    .then((response) => response.json())
    .then((r) => {
      token = r.token;
      setToken(r.token);
      $("#mfa-form").hide();
      $("#mfa-input").val("");
      $("#auth-successful").show();
      if (redirectIfNeeded) {
        redirectIfNeeded();
      }
      readyToUse();
      scheduleTokenRefresh();
    })
    .catch((err) => console.log(err));
}

/**
 * This function is triggered when user clicks on the Authenticate button
 * @param {*} e - HTML event for button click
 */
function login(e) {
  e.preventDefault();
  userActive = true;

  const passwordInput = $("#password-input").val();
  fetch("/login", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: passwordInput }),
  })
    .then((response) => {
      if (!response.ok) {
        $("#login-error").text(
          response.status === 401
            ? "Incorrect password, please try again."
            : "There was an error when attempting to log in."
        );
        throw Error(response.statusText);
      }

      return response;
    })
    .then((response) => response.json())
    .then((r) => {
      token = r.token;
      setToken(r.token);
      $("#password-form").hide();
      $("#password-input").val("");
      var decodedToken = parseJwt(token);
      if (decodedToken["aud"] === "app") {
        $("#auth-successful").show();
        if (redirectIfNeeded) {
          redirectIfNeeded();
        }
        readyToUse();
        scheduleTokenRefresh();
      } else {
        $("#mfa-form").show();
        $("#mfa-input").focus();
      }
    })
    .catch((err) => console.log(err));
}
