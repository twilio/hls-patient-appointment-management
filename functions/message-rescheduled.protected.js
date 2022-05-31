/* eslint-disable camelcase */
const THIS = 'save-rescheduled:';
/*
 * --------------------------------------------------------------------------------
 *
 * event.appointment - flow.data that will be parenthesis enclosed comma-separated
 *                     key=value string. Note that values will not be enclosed in quotes.
 *                     (eg., {k1=v1, k2=v2, k3=v3} )
 *
 * returns
 * code = 200, if successful
 * --------------------------------------------------------------------------------
 */
const messageHelpersPath = Runtime.getFunctions()['scheduled-message-helper'].path;
const generalHelpersPath = Runtime.getFunctions().helpers.path;
const {
  hasAllAppointmentProperties,
  getAppointmentObject,
  getScheduledMessages,
  getReminderMessageBody,
  getSendAtDate,
  isValidReminderTime,
} = require(messageHelpersPath);
const { getParam, validateAppointment } = require(generalHelpersPath);

exports.handler = async function (context, event, callback) {
  console.log(THIS, 'Begin');
  console.time(THIS);

  const client = context.getTwilioClient();
  const response = new Twilio.Response();

  try {
    if (!event.hasOwnProperty('appointment')) {
      response.setBody({
        Error: "Missing appointment object in request body!"
      });
      response.setStatusCode(400);
      return callback(null, response);
    }

    // convert appointment string to json
    const appointment = getAppointmentObject(event.appointment);
    if (!hasAllAppointmentProperties(appointment)) {
      response.setBody({
        Error: "Missing attributes in the appointment object!"
      });
      response.setStatusCode(400);
      return callback(null, response);
    }
    validateAppointment(context, appointment);
    appointment.event_type = 'RESCHEDULED'; // over-ride

    // find scheduled messages, and cancel, then create them again.
    const allMessages = await client.messages.list({to: appointment.patient_phone}).then(messages => messages);
    const scheduledMessages = getScheduledMessages(allMessages);
    
    if (scheduledMessages === undefined || scheduledMessages.length == 0) {
      response.setBody({
        Error: "No Scheduled Messages found.  Failed to cancel."
      });
      response.setStatusCode(400);
      return callback(null, response);
    }

    for (const message of scheduledMessages) {
      try {
        await client.messages(message.sid).update({status: 'canceled'}).then(m => console.log("Canceling Message: ", m.sid));
        await client.messages(message.sid).remove();
      }
      catch(e) {
        console.error(e);
      }
    }

    // Now we create new scheduled messages with different reminder times
    const firstReminderTime = getSendAtDate(context.REMINDER_FIRST_TIMING, appointment.appointment_datetime);
    const secondReminderTime = getSendAtDate(context.REMINDER_SECOND_TIMING, appointment.appointment_datetime);

    if (!isValidReminderTime(firstReminderTime) || !isValidReminderTime(secondReminderTime)) {
      response.setBody({ 
        Error: "Reminder times need to be at a minimum of 1 hour from now and at a maximum of 7 days from now!" 
      });
      response.setStatusCode(400);
      return callback(null, response);
    }

    // Now send out 2 scheduled messages
    await client.messages
      .create({
        messagingServiceSid: context.MESSAGING_SERVICE_SID,
        body: getReminderMessageBody(appointment),
        sendAt: firstReminderTime,
        scheduleType: 'fixed',
        to: appointment.patient_phone
      })
      .then(message => console.log(message.sid));

    await client.messages
      .create({
          from: context.MESSAGING_SERVICE_SID,
          body: getReminderMessageBody(appointment),
          sendAt: secondReminderTime,
          scheduleType: 'fixed',
          to: appointment.patient_phone
        })
      .then(message => console.log(message.sid));

    response.setStatusCode(200);
    response.setBody({
      event_type: appointment.event_type
    });
    return callback(null, response);
  } catch (err) {
    console.log(err);
    if (err.code === 'ERR_ASSERTION')
      return callback({ error: 'ERR_ASSERTION', message: err.message });
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};
