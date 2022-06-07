async function checkAuthToken() {
  if (!token) {
    window.location = "/index.html?from=internal.html";
  }
  try {
    await refreshToken();
    checkScheduledReminders();
  } catch {
    window.location = "/index.html?from=internal.html";
  }
}

async function checkScheduledReminders() {
  try {
    const scheduledMessagesResponse = await fetch("/check-scheduled-reminders");
    const scheduledMessages = await scheduledMessagesResponse.json();
    $("#initializing-reminders").hide();
    if (scheduledMessages.length) {
      $("#scheduled-messages-info").text(
        `Found ${scheduledMessages.length + 1} active reminders.`
      );
      $("#send_reminder_button").show();
      return;
    }
    $("#scheduled-messages-info").text(`There are no active reminders right now.`);
  } catch (err) {
    console.log(err);
  }
}

window.addEventListener("load", async () => {
  $("#send_reminder_button").hide();
  checkAuthToken();
});

async function sendReminders() {
  try {
    $("#initializing-reminders").show();
    const scheduledMessagesResponse = await fetch("/send-scheduled-reminders");
    const sendResults = await scheduledMessagesResponse.json();
    console.log(result, sendResults);
    checkScheduledReminders();
  } catch {
    $("#initializing-reminders").hide();
    $("#send_reminder_button").hide();
    $("#scheduled-messages-info").text(
      `Error sending reminders. Reload the page and try again`
    );
  }
}
