async function checkScheduledReminders(context, event, callback) {
  const client = context.getTwilioClient();
  const allMessages = await client.messages.list();
  const scheduledMessages = allMessages.filter(
    ({ status, messagingServiceSid }) =>
      status === "scheduled" &&
      messagingServiceSid === context.MESSAGING_SERVICE_SID
  );
  return callback(null, scheduledMessages);
}

exports.handler = checkScheduledReminders;
