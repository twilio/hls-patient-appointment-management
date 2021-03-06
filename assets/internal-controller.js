let selectedPatientNumbers = new Set();
let totalPatientsCount = 0;

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

function resetTable() {
  selectedPatientNumbers = new Set();
  $("#internal-table > tbody").empty();
}

function displayPatientsList(messages) {
  $(".internal-patient-table").show();
  totalPatientsCount = messages.length;
  messages.forEach(({ to, body }) => {
    selectedPatientNumbers.add(to);
    const rowElement = document.createElement("tr");
    rowElement.classList.add("patient_details");
    rowElement.dataset.patientNumber = to;
    rowElement.dataset.isSelected = "true";
    rowElement.onclick = selectPatient;
    const checkboxElement = document.createElement("input");
    checkboxElement.type = "checkbox";
    checkboxElement.checked = true;
    checkboxElement.classList.add("patient-checkbox");
    const messageBodyElement = document.createElement("td");
    messageBodyElement.innerText = body;
    const messageToElement = document.createElement("td");
    messageToElement.innerText = to;
    const messageSelectElement = document.createElement("td");
    messageSelectElement.appendChild(checkboxElement);
    rowElement.append(
      messageSelectElement,
      messageBodyElement,
      messageToElement
    );
    $("#internal-table").find("tbody").append(rowElement);
  });
  updateSelectAllLabel();
}

async function checkScheduledReminders() {
  try {
    const scheduledMessagesResponse = await fetch("/check-scheduled-reminders");
    const scheduledMessages = await scheduledMessagesResponse.json();
    $("#initializing-reminders").hide();
    if (scheduledMessages.length) {
      // $("#scheduled-messages-info").text(
      //   `Found ${scheduledMessages.length} active reminders. Clicking on send reminders will cancel the ${scheduledMessages.length} scheduled reminders and send the reminders immediately.`
      // );
      displayPatientsList(scheduledMessages);
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
  $(".internal-patient-table").hide();
  checkAuthToken();
});

async function sendReminders() {
  try {
    $("#initializing-reminders").show();
    $(".internal-patient-table").hide();
    $("#send_reminder_button").hide();
    const scheduledMessagesResponse = await fetch("/send-scheduled-reminders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        selectedPatientNumbers: [...selectedPatientNumbers],
      }),
    });
    await scheduledMessagesResponse.json();
    resetTable();
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

function selectAllPatients() {
  const patientsList = [...$(".patient_details")];
  patientsList.forEach((target) => {
    const patientNumber = target.dataset.patientNumber;
    const checkbox = target.getElementsByClassName("patient-checkbox")[0];
    if (target.dataset.isSelected === "false") {
      target.dataset.isSelected = true;
      checkbox.checked = true;
      selectedPatientNumbers.add(patientNumber);
    }
  });
  updateSelectAllLabel();
}

function resetAllPatients() {
  const patientsList = [...$(".patient_details")];
  patientsList.forEach((target) => {
    const patientNumber = target.dataset.patientNumber;
    const checkbox = target.getElementsByClassName("patient-checkbox")[0];
    if (target.dataset.isSelected === "true") {
      target.dataset.isSelected = false;
      checkbox.checked = false;
      selectedPatientNumbers.delete(patientNumber);
    }
  });
  updateSelectAllLabel();
}

function updateSelectAllLabel() {
  const isAllSelected = selectedPatientNumbers.size === totalPatientsCount;
  if (isAllSelected) {
    $(".select-reset-label").text("Reset All");
  } else {
    $(".select-reset-label").text("Select All");
  }
  $(".select-reset-checkbox").prop("checked", isAllSelected);
  $("#send_reminder_button").prop("disabled", !selectedPatientNumbers.size);
}

function togglePatientSelection(event) {
  if (totalPatientsCount === selectedPatientNumbers.size) {
    resetAllPatients();
    return;
  }
  selectAllPatients();
}

function selectPatient(event) {
  const target = event.currentTarget;
  const patientNumber = target.dataset.patientNumber;
  const checkbox = target.getElementsByClassName("patient-checkbox")[0];
  if (target.dataset.isSelected === "true") {
    target.dataset.isSelected = false;
    checkbox.checked = false;
    selectedPatientNumbers.delete(patientNumber);
  } else {
    target.dataset.isSelected = true;
    checkbox.checked = true;
    selectedPatientNumbers.add(patientNumber);
  }
  console.log(selectedPatientNumbers.size, $("#send_reminder_button"));
  console.log(selectedPatientNumbers.size,totalPatientsCount);
  updateSelectAllLabel(); 
}
