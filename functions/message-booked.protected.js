/* eslint-disable camelcase */
const THIS = 'message-booked:';
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
  getSendAtDate, 
  hasAllAppointmentProperties,
  getReminderMessageBody,
  getAppointmentObject,
  isValidReminderTime 
} = require(messageHelpersPath);
const { getParam, validateAppointment } = require(generalHelpersPath);

exports.handler = async function (context, event, callback) {
  console.log(THIS, 'Begin');
  console.time(THIS);

  const client = context.getTwilioClient();
  const response = new Twilio.Response();

  try {
    if (!event.hasOwnProperty('appointment')) {
      response.setBody({ Error: "Missing appointment object in request body!" });
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
    appointment.event_type = 'BOOKED'; // over-ride

    // Now we check if the reminder times are 
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
        messagingServiceSid: context.MESSAGING_SID,
        body: getReminderMessageBody(appointment),
        sendAt: firstReminderTime,
        scheduleType: 'fixed',
        to: appointment.patient_phone
      })
      .then(message => console.log(message.sid));

    await client.messages
      .create({
          messagingServiceSid: context.MESSAGING_SID,
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
