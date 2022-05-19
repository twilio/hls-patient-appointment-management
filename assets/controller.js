/* eslint-disable camelcase, object-shorthand, prefer-destructuring, no-use-before-define, sonarjs/no-collapsible-if, vars-on-top, no-var, dot-notation, prefer-template */

/*
 * main controller javascript used by index.html
 *
 */
let phoneNumber;
let flowSid;
let userActive = true;
let simRemindTimeout = 0;

const baseUrl = new URL(location.href);
baseUrl.pathname = baseUrl.pathname.replace(/\/index\.html$/, "");
delete baseUrl.hash;
delete baseUrl.search;
const fullUrl = baseUrl.href.substr(0, baseUrl.href.length - 1);

window.addEventListener("load", async () => {
  $("#mfa-form").hide();
  $("#simulate-section").hide();
  $("#password-form").show();
  $("#password-input").focus();
  $("#auth-successful").hide();
  $("#remind_appointment_btn").hide();

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
      const date = new Date(r['appointmentTimestamp']);

      $('#name-sent-from').val(r['customerName']);
      $('#number-sent-from').val(r['customerPhoneNumber']);
      $('#date-time').val(date.toISOString().substring(0, 16));
      $('#provider').val(r['provider']);
      $('#location').val(r['location']);
      // Aug 23, 2021 at 4:30 PM
    })
    .catch((err) => {
      console.log(THIS, err);
    });
}


// --------------------------------------------------------------------------------
async function updateAppointment(command) {
  THIS = 'updateAppointment:';
  userActive = true;

  simResponse = $(".simulate-response");

  $("#book_appointment_btn").addClass("loading");
  simResponse.text("Please wait...").show();

  const patientName = $('#patient-name').val();
  const phoneNumber = $('#patient-phone-number').val();
  const appointmentDate = $('#date-time').val();
  const appointmentProvider = $('#provider').val();
  const appointmentLocation = $('#location').val();

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
  await updateAppointment('BOOKED')
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
    simResponse.fadeOut().removeClass("success");
    $("#remind_appointment_btn").show();
  } else {
    setTimeout(updateSimRemindTimeout, 1000);
  }
}

// --------------------------------------------------------------------------------
async function remindAppointment(e) {
  e.preventDefault();
  THIS = "remindAppointment:";
  userActive = true;

  simResponse = $(".simulate-response");

  $("#remind_appointment_btn").addClass("loading");
  simResponse.text("Please wait...").show();

  fetch("/deployment/simulation-event", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: token,
      command: "REMIND",
    }),
  })
    .then((response) => response.json())
    .then((r) => {
      showSimReminderSuccess();
    })
    .catch(() => {
      showSimReponseError("Unable to send your appointment reminder request.");
    })
    .finally(() => {
      $("#remind_appointment_btn").removeClass("loading");
    });
}

// --------------------------------------------------------------------------
function showSimReponseError(message) {
  simResponse.text(message).addClass("failure");
  setTimeout(() => simResponse.fadeOut().removeClass("failure"), 4000);
}
function showSimReponseSuccess() {
  simResponse
    .text(
      `Your appointment request has been sent. Please wait ${simRemindTimeout} seconds to simulate a reminder.`
    )
    .addClass("success");
  // setTimeout(() => simResponse.fadeOut().removeClass('success'), 4000);
}
function showSimReminderSuccess() {
  simResponse.text(`Your reminder request has been sent.`).addClass("success");
  setTimeout(() => simResponse.fadeOut().removeClass("success"), 4000);
}
