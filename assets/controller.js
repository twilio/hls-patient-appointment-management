/* eslint-disable camelcase, object-shorthand, prefer-destructuring, no-use-before-define, sonarjs/no-collapsible-if, vars-on-top, no-var, dot-notation, prefer-template */

/*
 * main controller javascript used by index.html
 *
 */
let phoneNumber;
let flowSid;
let userActive = true;
let simRemindTimeout = 0;
let currentEvent = null;

const successMessages = (simRemindTimeout) => ({
  BOOKED: `Your appointment request has been sent. Please wait ${simRemindTimeout} seconds to simulate a reminder.`,
  MODIFIED: `Your appointment request has been modified`,
  RESCHEDULED: `Your appointment request has been rescheduled`,
});

const baseUrl = new URL(location.href);
baseUrl.pathname = baseUrl.pathname.replace(/\/index\.html$/, "");
delete baseUrl.hash;
delete baseUrl.search;
const fullUrl = baseUrl.href.substr(0, baseUrl.href.length - 1);

const EVENTTYPE = {
  BOOKED: 'BOOKED',
  CONFIRMED: 'CONFIRMED',
  REMIND: 'REMIND',
  CANCELED: 'CANCELED',
  NOSHOWED: 'NOSHOWED'
};

const BUTTON = {
  BOOKED: '#book_appointment_btn',
  CONFIRMED: '#confirm_appointment_btn',
  REMIND: '#remind_appointment_btn',
  CANCELED: '#cancel_appointment_btn',
  NOSHOWED: '#noshowed_appointment_btn'
}

window.addEventListener("load", async () => {
  $("#mfa-form").hide();
  $("#simulate-section").hide();
  $("#password-form").show();
  $("#password-input").focus();
  $("#auth-successful").hide();
  $(BUTTON.REMIND).hide();

  if (localStorage.getItem("mfaToken")) {
    $("#password-form").hide();
    $("#auth-successful").show();
    $("#mfa-form").hide();
    $("#ready-to-use").show();
  }
});

function goSimulate() {
  $("main").hide();
  $("#simulation-text").hide();
  $("#simulate-section").show();
  getSimulationParameters();
}

function goHome() {
  $("main").show();
  $("#simulation-text").show();
  $("#simulate-section").hide();
}

async function getSimulationParameters() {
  THIS = "getSimulationParameters:";
  console.log(THIS, "running");
  userActive = true;

  fetch("/deployment/simulate-parameters", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token: localStorage.getItem("mfaToken") }),
  })
    .then((response) => response.json())
    .then((r) => {
      const date = new Date(r["appointmentTimestamp"]);

      $("#name-sent-from").val(r["customerName"]);
      $("#number-sent-from").val(r["customerPhoneNumber"]);
      $("#date-time").val(date.toISOString().substring(0, 16));
      $("#provider").val(r["provider"]);
      $("#location").val(r["location"]);
      // Aug 23, 2021 at 4:30 PM
    })
    .catch((err) => {
      console.log(THIS, err);
    });
}

// --------------------------------------------------------------------------------
/**
 * This function triggers the simulate-event function with fiven parameters
 * @param {*} params - Parameters for the event
 */
function triggerEvent(params) {
  console.log(params);
  return fetch("/deployment/simulation-event", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
}

// --------------------------------------------------------------------------------
async function updateAppointment(command) {
  THIS = "updateAppointment:";
  userActive = true;

  simResponse = $(".simulate-response");

  $(BUTTON.BOOKED).addClass("loading");
  simResponse.text("Please wait...").show();

  const patientName = $("#patient-name").val();
  const phoneNumber = $("#patient-phone-number").val();
  const appointmentDate = $("#date-time").val();
  const appointmentProvider = $("#provider").val();
  const appointmentLocation = $("#location").val();

  if (patientName === "" || phoneNumber === "") {
    showSimReponseError("Patient name and phone number must be filled");
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
  } catch {
    showSimReponseError("Unable to send your appointment request.");
  } finally {
    $(BUTTON.BOOKED).removeClass("loading");
  }
}

// ------------------------------------------------------------------------------

async function bookAppointment(e) {
  e.preventDefault();
  currentEvent = "BOOKED";
  THIS = "bookAppointment:";
  simResponse = $(".simulate-response");
  $("#book_appointment_btn").addClass("loading");
  simResponse.text("Please wait...").show();
  await updateAppointment(currentEvent);
  simRemindTimeout = 120; // seconds
  setTimeout(updateSimRemindTimeout, 1000);
  showSimSuccess(EVENTTYPE.BOOKED);
}

// ------------------------------------------------------------------------------

async function modifyAppointment(e) {
  e.preventDefault();
  currentEvent = "MODIFIED";
  THIS = "modifyAppointment:";
  simResponse = $(".simulate-response");
  $("#modify_appointment_btn").addClass("loading");
  simResponse.text("Please wait...").show();
  await updateAppointment(currentEvent);
  simRemindTimeout = 5; // seconds
  setTimeout(updateSimRemindTimeout, 1000);
  showSimReponseSuccess();
}

// ------------------------------------------------------------------------------

async function rescheduleAppointment(e) {
  e.preventDefault();
  currentEvent = "RESCHEDULED";
  THIS = "rescheduleAppointment:";
  simResponse = $(".simulate-response");
  $("#reschedule_appointment_btn").addClass("loading");
  simResponse.text("Please wait...").show();
  await updateAppointment(currentEvent);
  simRemindTimeout = 5; // seconds
  setTimeout(updateSimRemindTimeout, 1000);
  showSimReponseSuccess();
}

// ------------------------------------------------------------------------------
function updateSimRemindTimeout() {
  simRemindTimeout -= 1;
  showSimReponseSuccess();
  if (simRemindTimeout < 1) {
    simResponse.fadeOut().removeClass("success");
    $(BUTTON.REMIND).show();
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

  $(BUTTON.REMIND).addClass('loading');
  simResponse.text('Please wait...').show();

  fetch('/deployment/simulation-event', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: token,
      command: EVENTTYPE.REMIND,
    }),
  })
    .then((response) => response.json())
    .then((r) => {
      showSimSuccess(EVENTTYPE.REMIND);
    })
    .catch(() => {
      showSimReponseError('Unable to send your appointment reminder request.');
    })
    .finally(() => {
      $(BUTTON.REMIND).removeClass('loading');
    });
}

async function noshowedAppointment(e) {
  e.preventDefault();
  THIS = 'noshowedAppointment:';
  userActive = true;
  simResponse = $('.simulate-response');

  $(BUTTON.NOSHOWED).addClass('loading');
  simResponse.text('Please wait...').show();

  const patientName = $('#patient-name').val();
  const phoneNumber = $('#patient-phone-number').val();

  if (patientName === '' || phoneNumber === '') {
    showSimReponseError('Patient name and phone number must be filled');
    return;
  }

  fetch('/deployment/simulation-event', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: token,
      command: EVENTTYPE.NOSHOWED,
      firstName: patientName,
      phoneNumber: phoneNumber,
    }),
  })
    .then((resp) => {
      showSimSuccess(EVENTTYPE.NOSHOWED);
    })
    .catch((err) => {
      showSimReponseError('Unable to send your appointment request.');
    })
    .finally(() => {
      $(BUTTON.NOSHOWED).removeClass('loading');
    });
}

async function confirmAppointment(e) {
  e.preventDefault();
  THIS = 'confirmAppointment:';
  userActive = true;
  simResponse = $('.simulate-response');

  $(BUTTON.CONFIRMED).addClass('loading');
  simResponse.text('Please wait...').show();

  const patientName = $('#patient-name').val();
  const phoneNumber = $('#patient-phone-number').val();

  if (patientName === '' || phoneNumber === '') {
    showSimReponseError('Patient name and phone number must be filled');
    return;
  }

  fetch('/deployment/simulation-event', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: token,
      command: EVENTTYPE.CONFIRMED,
      firstName: patientName,
      phoneNumber: phoneNumber,
    }),
  })
    .then((resp) => {
      showSimSuccess(EVENTTYPE.CONFIRMED);
    })
    .catch((err) => {
      showSimReponseError('Unable to send your appointment request.');
    })
    .finally(() => {
      $(BUTTON.CONFIRMED).removeClass('loading');
    });
}

async function cancelAppointment(e) {
  e.preventDefault();
  THIS = 'cancelAppointment:';
  userActive = true;
  simResponse = $('.simulate-response');

  $(BUTTON.CANCELED).addClass('loading');
  simResponse.text('Please wait...').show();

  const patientName = $('#patient-name').val();
  const phoneNumber = $('#patient-phone-number').val();

  if (patientName === '' || phoneNumber === '') {
    showSimReponseError('Patient name and phone number must be filled');
    return;
  }

  fetch('/deployment/simulation-event', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: token,
      command: EVENTTYPE.CANCELED,
      firstName: patientName,
      phoneNumber: phoneNumber,
    }),
  })
    .then((resp) => {
      showSimSuccess(EVENTTYPE.CANCELED);
    })
    .catch((err) => {
      showSimReponseError('Unable to send your appointment request.');
    })
    .finally(() => {
      $(BUTTON.CANCELED).removeClass('loading');
    });
}

function showSimReponseError(message) {
  simResponse.text(message).addClass("failure");
  setTimeout(() => simResponse.fadeOut().removeClass("failure"), 4000);
}
function showSimReponseSuccess(event = currentEvent) {
  simResponse
    .text(successMessages(simRemindTimeout)[event])
    .addClass("success");
}

function showSimSuccess(eventtype) {
  // converting to capitalize first letter in the word.
  if ( eventtype && eventtype.length > 0) {
    eventtype = eventtype[0].toUpperCase() + eventtype.slice(1).toLowerCase();
    simResponse.text(`Your ${eventtype} request has been sent.`).addClass('success');
    setTimeout(() => simResponse.fadeOut().removeClass('success'), 4000);
  } else {
    showSimReponseError('Incorrect event type sent');
  }
}
