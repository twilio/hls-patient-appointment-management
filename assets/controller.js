/* eslint-disable camelcase, object-shorthand, prefer-destructuring, no-use-before-define, sonarjs/no-collapsible-if, vars-on-top, no-var, dot-notation, prefer-template */

/*
 * main controller javascript used by index.html
 *
 */
let phoneNumber;
let flowSid;
let userActive = true;
let simRemindTimeout = 0;
const TOKEN_REFRESH_INTERVAL = 30 * 60 * 1000;

const baseUrl = new URL(location.href);
baseUrl.pathname = baseUrl.pathname.replace(/\/index\.html$/, '');
delete baseUrl.hash;
delete baseUrl.search;
const fullUrl = baseUrl.href.substr(0, baseUrl.href.length - 1);

window.addEventListener('load', async () => {
  $('#mfa-form').hide();
  $('#simulate-section').hide();
  $('#password-form').show();
  $('#password-input').focus();
  $('#remind_appointment_btn').hide();

  if (localStorage.getItem('mfaToken')) {
    $('#password-form').hide();
    $('#auth-successful').show();
    $('#mfa-form').hide();
    $('#ready-to-use').show();
  }
});

function goSimulate() {
  $('main').hide();
  $('#simulation-text').hide();
  $('#simulate-section').show();
  getSimulationParameters();
}

function goHome() {
  $('main').show();
  $('#simulation-text').show();
  $('#simulate-section').hide();
}


function handleInvalidToken() {
  $('#password-form').show();
  $('#auth-successful').hide();
  $('#mfa-form').hide();
  $('#invalid-environment-variable').hide();
  $('#valid-environment-variable').hide();
  $('#flow-loader').hide();
  $('#flow-deploy').hide();
  $('#flow-deployed').hide();
  $('#password-input').focus();
}

async function getSimulationParameters() {
  THIS = 'getSimulationParameters:';
  console.log(THIS, 'running');
  userActive = true;

  fetch('/deployment/simulate-parameters', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: localStorage.getItem('mfaToken') }),
  })
    .then((response) => response.json())
    .then((r) => {
      const date = new Date(r['appointmentTimestamp']);
      var ds = date.toDateString() + ' ' + date.toLocaleTimeString();

      $('#name-sent-from').val(r['customerName']);
      $('#number-sent-from').val(r['customerPhoneNumber']);
      $('#date-time').val(ds);
      $('#provider').val(r['provider']);
      $('#location').val(r['location']);
      // Aug 23, 2021 at 4:30 PM
    })
    .catch((err) => {
      console.log(THIS, err);
    });
}

// --------------------------------------------------------------------------------
function checkHistory() {
  THIS = 'checkHistory:';
  userActive = true;
  console.log(THIS, 'running');
  fetch(`/deployment/check-query?table=history`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: token }),
  })
    .then((response) => response.text())
    .then((url) => {
      console.log(THIS, url);
      $('#history-download .button').removeClass('loading');
      $('.history-downloader').hide();
      if (url === 'READY') {
        $('#history-query').show();
      } else if (url === 'RUNNING') {
        $('#history-querying').show();
        $('#history-query').hide();
        setTimeout(checkHistory, 5000);
      } else if (url === 'FAILED') {
        throw new Error();
      } else {
        $('#history-ready').show();
        $('#history-querying').hide();
        $('#history-download').attr('href', `${url}`);
      }
    })
    .catch((err) => {
      console.log(THIS, err);
    });
}

// --------------------------------------------------------------------------------
function downloadHistory(e) {
  THIS = 'downloadHistory:';
  console.log(THIS, 'running');
  userActive = true;
  e.preventDefault();
  $('#history-download .button').addClass('loading');
  $('.history-downloader.button-loader').show();

  fetch('/deployment/execute-query?table=history', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  })
    .then(() => {
      console.log(THIS, 'success');
      checkHistory();
    })
    .catch((err) => {
      console.log(THIS, err);
      $('#history-download .button').removeClass('loading');
      $('.history-downloader.button-loader').hide();
    });
}

// --------------------------------------------------------------------------------
function checkState() {
  THIS = 'checkState:';
  console.log(THIS, 'running');
  userActive = true;

  fetch(`/deployment/check-query?table=state`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: token }),
  })
    .then((response) => response.text())
    .then((url) => {
      console.log(THIS, url);
      $('#state-download .button').removeClass('loading');
      $('.state-downloader').hide();
      if (url === 'READY') {
        $('#state-query').show();
      } else if (url === 'RUNNING') {
        $('#state-querying').show();
        $('#state-query').hide();
        setTimeout(checkState, 5000);
      } else if (url === 'FAILED') {
        throw new Error();
      } else {
        $('#state-ready').show();
        $('#state-querying').hide();
        $('#state-download').attr('href', `${url}`);
      }
    })
    .catch((err) => {
      console.log(THIS, err);
    });
}

// --------------------------------------------------------------------------------
function downloadState(e) {
  THIS = 'downloadState:';
  console.log(THIS, 'running');
  userActive = true;

  e.preventDefault();
  $('#state-download .button').addClass('loading');
  $('.state-downloader.button-loader').show();

  fetch('/deployment/execute-query?table=state', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  })
    .then(() => {
      console.log(THIS, 'success');
      checkState();
    })
    .catch((err) => {
      console.log(THIS, err);
      $('#state-download .button').removeClass('loading');
      $('.state-downloader.button-loader').hide();
    });
}

// --------------------------------------------------------------------------------
function readyToUse() {
  THIS = 'readyToUse:';
  console.log(THIS, 'running');
  $('#ready-to-use').show();

  checkState();
  checkHistory();
}

// --------------------------------------------------------------------------------
function checkStudioFlow() {
  THIS = 'checkStudioFlow:';
  console.log(THIS, 'running');
  userActive = true;

  fetch('/deployment/check-studio-flow', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  })
    .then((response) => {
      if (!response.ok) {
        if (response.status === 401) handleInvalidToken();
        throw Error(response.statusText);
      }
      return response.json();
    })
    .then((resp) => {
      console.log(THIS, resp);
      $('#flow-deploy .button').removeClass('loading');
      $('.flow-loader').hide();
      if (resp.data === 'NOT-DEPLOYED') {
        $('#flow-deploy').show();
      } else {
        flowsid = resp.data;
        $('#flow-deployed').show();
        $('#flow-deploy').hide();
        $('#flow-open').attr(
          'href',
          `https://www.twilio.com/console/studio/flows/${resp.data}`
        );
        $('#flow-rest-api-url').text(
          `https://studio.twilio.com/v2/Flows/${resp.data}/Executions`
        );
        readyToUse();
      }
    })
    .catch((err) => {
      console.log(THIS, err);
    });
}

// --------------------------------------------------------------------------------
function deployStudioFlow() {
  THIS = 'deployStudioFlow:';
  console.log(THIS, 'running');

  fetch('/deployment/deploy-studio-flow', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  })
    .then((response) => {
      if (!response.ok) {
        if (response.status === 401) handleInvalidToken();
        throw Error(response.statusText);
      }
      return response.text();
    })
    .then(() => {
      console.log(THIS, 'success');
      checkStudioFlow();
    })
    .catch((err) => {
      console.log(THIS, err);
    });
}

// --------------------------------------------------------------------------------
function check() {
  THIS = 'check:';
  console.log(THIS, 'running');
  userActive = true;

  fetch('/deployment/check', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: token }),
  })
    .then((response) => {
      if (!response.ok) if (response.status === 401) handleInvalidToken();
      return response.text();
    })
    .then((text) => {
      console.log(text);
      errors = JSON.parse(text);
      if (errors.length === 0) {
        // no errors, so proceed
        $('#valid-environment-variable').show();
        // TODO: temperory fix to show simulation button
        readyToUse();
        checkStudioFlow();
      } else {
        $('#invalid-environment-variable').show();
        for (e of errors) {
          const error = $('<p></p>').text(JSON.stringify(e));
          $('#invalid-environment-variable').append(error);
        }
      }
    })
    .catch((err) => {
      console.log(THIS, err);
    });
}

// --------------------------------------------------------------------------------
async function login(e) {
  e.preventDefault();
  userActive = true;

  const passwordInput = $('#password-input').val();
  fetch('/login', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: passwordInput }),
  })
    .then((response) => {
      if (!response.ok) {
        $('#login-error').text(
          response.status === 401
            ? 'Incorrect password, please try again.'
            : 'There was an error when attempting to log in.'
        );
        throw Error(response.statusText);
      }

      return response;
    })
    .then((response) => response.json())
    .then((r) => {
      token = r.token;
      $('#password-form').hide();
      $('#password-input').val('');
      var decodedToken = parseJwt(token);
      if (decodedToken['aud'] === 'app') {
        $('#auth-successful').show();
        scheduleTokenRefresh();
        check();
      } else {
        $('#mfa-form').show();
        $('#mfa-input').focus();
      }
    })
    .catch((err) => console.log(err));
}

// --------------------------------------------------------------------------------

function parseJwt(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join('')
  );

  return JSON.parse(jsonPayload);
}

// -------------------------------------------------------------------------------
async function mfa(e) {
  e.preventDefault();
  userActive = true;

  const mfaInput = $('#mfa-input').val();
  await fetch('/mfa', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mfaCode: mfaInput, token: token }),
  })
    .then((response) => {
      if (!response.ok) {
        $('#mfa-error').text(
          response.status === 401
            ? response.headers.get('Error-Message')
            : 'There was an error in verifying your security code.'
        );
        throw Error(response.statusText);
      }

      return response;
    })
    .then((response) => response.json())
    .then((r) => {
      token = r.token;
      localStorage.setItem('mfaToken', token);
      $('#mfa-form').hide();
      $('#mfa-input').val('');
      $('#auth-successful').show();
      scheduleTokenRefresh();
    })
    .catch((err) => console.log(err));
}
function scheduleTokenRefresh() {
  setTimeout(refreshToken, TOKEN_REFRESH_INTERVAL);
}
// -----------------------------------------------------------------------------
async function refreshToken() {
  if (!userActive) return;
  userActive = false;

  fetch('/refresh-token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: token }),
  })
    .then((response) => {
      return response;
    })
    .then((response) => response.json())
    .then((r) => {
      scheduleTokenRefresh();
      token = r.token;
    })
    .catch((err) => console.log(err));
}

// --------------------------------------------------------------------------------
/**
 * This function triggers the simulate-event function with fiven parameters
 * @param {*} params - Parameters for the event
 */
function triggerEvent(params) {
  console.log(params)
  return fetch('/deployment/simulation-event', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })
}

// --------------------------------------------------------------------------------
async function updateAppointment(command) {
  THIS = 'updateAppointment:';
  userActive = true;

  simResponse = $('.simulate-response');

  $('#book_appointment_btn').addClass('loading');
  simResponse.text('Please wait...').show();

  const patientName = $('#patient-name').val();
  const phoneNumber = $('#patient-phone-number').val();
  const appointmentDate = $('#date-time').val();
  const appointmentProvider = $('#provider').val();
  const appointmentLocation = $('#location').val();

  if (patientName === '' || phoneNumber === '') {
    showSimReponseError('Patient name and phone number must be filled');
    return;
  }

  try {
    await triggerEvent({
      token: token,
      command,
      firstName: patientName,
      phoneNumber: phoneNumber,
      appointmentDate,
      appointmentProvider,
      appointmentLocation,
    });
  }
  catch {
    showSimReponseError('Unable to send your appointment request.');
  }
  finally {
    $('#book_appointment_btn').removeClass('loading');
  }
}

// ------------------------------------------------------------------------------

async function bookAppointment(e) {
  e.preventDefault();
  THIS = 'bookAppointment:';
  simResponse = $('.simulate-response');
  $('#book_appointment_btn').addClass('loading');
  simResponse.text('Please wait...').show();
  await updateAppointment(e, 'BOOKED')
  simRemindTimeout = 120; // seconds
  setTimeout(updateSimRemindTimeout, 1000);
  showSimReponseSuccess();
}

// ------------------------------------------------------------------------------

async function modifyAppointment(e) {
  e.preventDefault();
  THIS = 'modifyAppointment:';
  simResponse = $('.simulate-response');
  $('#modify_appointment_btn').addClass('loading');
  simResponse.text('Please wait...').show();
  await updateAppointment('MODIFIED')
  showSimReponseSuccess();
}

// ------------------------------------------------------------------------------

async function rescheduleAppointment(e) {
  e.preventDefault();
  THIS = 'rescheduleAppointment:';
  simResponse = $('.simulate-response');
  $('#reschedule_appointment_btn').addClass('loading');
  simResponse.text('Please wait...').show();
  await updateAppointment('RESCHEDULED')
  showSimReponseSuccess();
}

// ------------------------------------------------------------------------------
function updateSimRemindTimeout() {
  simRemindTimeout -= 1;
  showSimReponseSuccess();
  if (simRemindTimeout < 1) {
    simResponse.fadeOut().removeClass('success');
    $('#remind_appointment_btn').show();
  } else {
    setTimeout(updateSimRemindTimeout, 1000);
  }
}

// --------------------------------------------------------------------------------
async function remindAppointment(e) {
  e.preventDefault();
  THIS = 'remindAppointment:';
  userActive = true;

  simResponse = $('.simulate-response');

  $('#remind_appointment_btn').addClass('loading');
  simResponse.text('Please wait...').show();

  fetch('/deployment/simulation-event', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: token,
      command: 'REMIND',
    }),
  })
    .then((response) => response.json())
    .then((r) => {
      showSimReminderSuccess();
    })
    .catch(() => {
      showSimReponseError('Unable to send your appointment reminder request.');
    })
    .finally(() => {
      $('#remind_appointment_btn').removeClass('loading');
    });
}

// --------------------------------------------------------------------------
function showSimReponseError(message) {
  simResponse.text(message).addClass('failure');
  setTimeout(() => simResponse.fadeOut().removeClass('failure'), 4000);
}
function showSimReponseSuccess() {
  simResponse
    .text(
      `Your appointment request has been sent. Please wait ${simRemindTimeout} seconds to simulate a reminder.`
    )
    .addClass('success');
  // setTimeout(() => simResponse.fadeOut().removeClass('success'), 4000);
}
function showSimReminderSuccess() {
  simResponse.text(`Your reminder request has been sent.`).addClass('success');
  setTimeout(() => simResponse.fadeOut().removeClass('success'), 4000);
}