async function sendScheduledReminders(context, event, callback) {
  const client = context.getTwilioClient();
  const allMessages = await client.messages.list();
  const scheduledMessages = allMessages.filter(
    ({ status, messagingServiceSid }) =>
      status === "scheduled" &&
      messagingServiceSid === context.MESSAGING_SERVICE_SID
  );
  const queuedMessages = scheduledMessages.map(
    async ({ sid, body, to, messagingServiceSid }) => {
      // Cancel the scheduled message
      await client.messages(sid).update({ status: "canceled" });
      return await client.messages.create({
        messagingServiceSid,
        body,
        to,
      });
    }
  );
  let results = [];
  try {
    results = await Promise.all(queuedMessages);
  } catch (err) {
    console.log(err);
  }
  return callback(null, results);
}

exports.handler = sendScheduledReminders;
