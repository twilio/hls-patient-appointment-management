let selectedPatientNumbers = new Set();

async function checkAuthToken() {
  if (!token) {
    window.location = "/index.html?from=internal.html";
  }
  const { token: newToken } = await refreshToken();
  if (!newToken) {
    window.location = "/index.html?from=internal.html";
  }
  checkScheduledReminders();
}

async function checkScheduledReminders() {
  try {
    const scheduledMessagesResponse = await fetch("/check-scheduled-reminders");
    const scheduledMessages = await scheduledMessagesResponse.json();
    $("#initializing-reminders").hide();
    if (scheduledMessages.length) {
      $("#scheduled-messages-info").text(
        `Found ${scheduledMessages.length} active reminders. Clicking on send reminders will cancel the ${scheduledMessages.length} scheduled reminders and send the reminders immediately.`
      );
      $("#send_reminder_button").show();
      return;
    }
    $("#send_reminder_button").hide();
    $("#scheduled-messages-info").text(
      `There are no active reminders right now.`
    );
  } catch (err) {
    console.log(err);
  }
}

window.addEventListener("load", async () => {
  $("#send_reminder_button").hide();
  $(".internal-tooltip").hide();
  checkAuthToken();
});

async function sendReminders() {
  try {
    $("#initializing-reminders").show();
    const scheduledMessagesResponse = await fetch("/send-scheduled-reminders", {
      method: "POST",
    });
    await scheduledMessagesResponse.json();
    checkScheduledReminders();
    $(".internal-tooltip").text("Reminders sent successfully").show();
    setTimeout(() => $(".internal-tooltip").text("").hide(), 4000);
  } catch {
    $("#initializing-reminders").hide();
    $("#send_reminder_button").hide();
    $("#scheduled-messages-info").text(
      `Error sending reminders. Reload the page and try again`
    );
  }
}


function selectPatient(event) {
  console.log(event);
  const target = event.currentTarget;
  const patientNumber = target.dataset.patientNumber;
  console.log(target);
  const checkbox = target.getElementsByClassName('patient-checkbox')[0];
  if(target.dataset.isSelected === "true") {
    target.dataset.isSelected = false;
    checkbox.checked = false;
    selectedPatientNumbers.delete(patientNumber);
    return;
  }
  target.dataset.isSelected = true;
  checkbox.checked = true;
  selectedPatientNumbers.add(patientNumber);
}