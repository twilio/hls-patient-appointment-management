async function sendScheduledReminders(context, event, callback) {
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);
  const { selectedPatientNumbers } = event;
  console.log(selectedPatientNumbers);
  const client = context.getTwilioClient();
  const allMessages = await client.messages.list();
  const toSet = new Set();
  const messaging_sid = await getParam(context, 'MESSAGING_SID')
  const scheduledMessages = allMessages.filter(
    ({ status, messagingServiceSid }) =>
      status === "scheduled" &&
      messagingServiceSid === messaging_sid
  );
  const toSendMessages = [];
  for (const message of scheduledMessages) {
    const { sid, body, to, messagingServiceSid } = message;
    if (!selectedPatientNumbers.includes(to)) {
      continue;
    }
    await client.messages(sid).update({ status: "canceled" });
    if (!toSet.has(to)) {
      toSet.add(to);
      toSendMessages.push({ messagingServiceSid, body, to });
    }
  }
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
