async function sendScheduledReminders(context, event, callback) {
  const client = context.getTwilioClient();
  const allMessages = await client.messages.list();
  const toSet = new Set();
  const scheduledMessages = allMessages.filter(
    ({ status, messagingServiceSid }) =>
      status === "scheduled" &&
      messagingServiceSid === context.MESSAGING_SERVICE_SID
  );
  console.log(scheduledMessages);
  const toSendMessages = [];
  for (const message of scheduledMessages) {
    console.log(message)
    const { sid, body, to, messagingServiceSid } = message;
    await client.messages(sid).update({ status: "canceled" });
    console.log("toSet", toSet);
    if (!toSet.has(to)) {
      toSet.add(to);
      toSendMessages.push({ messagingServiceSid, body, to });
    }
  }
  console.log(toSendMessages);
  const results = await Promise.all(
    toSendMessages.map(({ body, to, messagingServiceSid }) =>
      client.messages.create({
        messagingServiceSid,
        body,
        to,
      })
    )
  );
  return callback(null, results);
}

exports.handler = sendScheduledReminders;
