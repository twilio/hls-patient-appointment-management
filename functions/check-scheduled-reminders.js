async function checkScheduledReminders(context, event, callback) {
  const client = context.getTwilioClient();
  const allMessages = await client.messages.list();
  const messaging_sid = await getParam(context , 'MESSAGING_SID');
  const toSet = new Set();
  const scheduledMessages = allMessages.reduce((acc, message) => {
    const { status, messagingServiceSid, to } = message;
    if (
      status === "scheduled" &&
      messagingServiceSid === messaging_sid &&
      !toSet.has(to)
    ) {
      toSet.add(to);
      return [...acc, message];
    }
    return acc;
  }, []);
  return callback(null, scheduledMessages);
}

exports.handler = checkScheduledReminders;
