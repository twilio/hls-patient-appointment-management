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
let countdownSim = $(".simulate-response-countdown");
const ts = Math.round(new Date().getTime());
const tsTomorrow = ts + 24 * 3600 * 1000;
let minDate = new Date(tsTomorrow);
let maxDate = new Date(ts + 24 * 3600 * 1000 * 7);

const baseUrl = new URL(location.href);
baseUrl.pathname = baseUrl.pathname.replace(/\/index\.html$/, "");
delete baseUrl.hash;
delete baseUrl.search;
const fullUrl = baseUrl.href.substr(0, baseUrl.href.length - 1);

const EVENTTYPE = {
  BOOKED: "BOOKED",
  CONFIRMED: "CONFIRMED",
  REMIND: "REMIND",
  CANCELED: "CANCELED",
  NOSHOWED: "NOSHOWED",
  MODIFIED: "MODIFIED",
  RESCHEDULED: "RESCHEDULED",
};

const BUTTON = {
  BOOKED: "#book_appointment_btn",
  CONFIRMED: "#confirm_appointment_btn",
  REMIND: "#remind_appointment_btn",
  CANCELED: "#cancel_appointment_btn",
  NOSHOWED: "#noshowed_appointment_btn",
  MODIFIED: "#modify_appointment_btn",
  RESCHEDULED: "#reschedule_appointment_btn",
};

window.addEventListener("load", async () => {
  $("#mfa-form").hide();
  $("#simulate-section").hide();
  $("#password-form").show();
  $("#password-input").focus();
  $("#auth-successful").hide();
  $(BUTTON.REMIND).hide();

  if (sessionStorage.getItem("mfaToken")) {
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
    body: JSON.stringify({ token: sessionStorage.getItem("mfaToken") }),
  })
    .then((response) => response.json())
    .then((r) => {
      const date = new Date(r["appointmentTimestamp"]);

      $("#name-sent-from").val(r["customerName"]);
      $("#number-sent-from").val(r["customerPhoneNumber"]);
      $("#date-time").val(date.toISOString().substring(0, 16));
      $("#date-time").attr("min", minDate.toISOString().substring(0, 16));
      $("#date-time").attr("max", maxDate.toISOString().substring(0, 16));
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

  $(BUTTON[command]).addClass("loading");
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
    showSimSuccess(command);
  } catch {
    showSimReponseError("Unable to send your appointment request.");
  } finally {
    $(BUTTON[command]).removeClass("loading");
  }
}

// ------------------------------------------------------------------------------

async function bookAppointment(e) {
  e.preventDefault();
  currentEvent = EVENTTYPE.BOOKED;
  THIS = "bookAppointment:";
  await updateAppointment(currentEvent);
  // Show sim for count down
  simRemindTimeout = 120; // seconds
  setTimeout(updateSimRemindTimeout, 1000);
}

// ------------------------------------------------------------------------------

async function modifyAppointment(e) {
  e.preventDefault();
  currentEvent = EVENTTYPE.MODIFIED;
  THIS = "modifyAppointment:";
  await updateAppointment(currentEvent);
}

// ------------------------------------------------------------------------------

async function rescheduleAppointment(e) {
  e.preventDefault();
  currentEvent = EVENTTYPE.RESCHEDULED;
  THIS = "rescheduleAppointment:";
  simResponse.text("Please wait...").show();
  await updateAppointment(currentEvent);
}

// ------------------------------------------------------------------------------
function updateSimRemindTimeout() {
  simRemindTimeout -= 1;
  showSimResponseCountdown();
  if (simRemindTimeout < 1) {
    countdownSim.fadeOut().removeClass("success");
    $(BUTTON.REMIND).show();
  } else {
    setTimeout(updateSimRemindTimeout, 1000);
  }
}

// --------------------------------------------------------------------------------
async function remindAppointment(e) {
  e.preventDefault();
  THIS = "remindAppointment:";
  currentEvent = EVENTTYPE.REMIND;
  await updateAppointment(currentEvent);
  // Show sim for count down
  simRemindTimeout = 120; // seconds
  setTimeout(updateSimRemindTimeout, 1000);
}

async function noshowedAppointment(e) {
  e.preventDefault();
  THIS = "noshowedAppointment:";
  currentEvent = EVENTTYPE.NOSHOWED;
  await updateAppointment(currentEvent);
}

async function confirmAppointment(e) {
  e.preventDefault();
  THIS = "confirmAppointment:";
  currentEvent = EVENTTYPE.CONFIRMED;
  await updateAppointment(currentEvent);
}

async function cancelAppointment(e) {
  e.preventDefault();
  THIS = "cancelAppointment:";
  currentEvent = EVENTTYPE.CANCELED;
  await updateAppointment(currentEvent);
}

function showSimReponseError(message) {
  simResponse.text(message).addClass("failure");
  setTimeout(() => simResponse.fadeOut().removeClass("failure"), 4000);
}
function showSimResponseCountdown() {
  countdownSim.show();
  countdownSim
    .text(
      `Your appointment request has been sent. Please wait ${simRemindTimeout} seconds to simulate a reminder.`
    )
    .addClass("success");
}

function showSimSuccess(eventtype) {
  // converting to capitalize first letter in the word.
  if (eventtype && eventtype.length > 0) {
    eventtype = eventtype[0].toUpperCase() + eventtype.slice(1).toLowerCase();
    simResponse
      .text(`Your ${eventtype} request has been sent.`)
      .addClass("success");
    setTimeout(() => simResponse.fadeOut().removeClass("success"), 4000);
  } else {
    showSimReponseError("Incorrect event type sent");
  }
}
