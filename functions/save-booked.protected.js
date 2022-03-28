/* eslint-disable camelcase */
const THIS = 'save-booked:';
/*
 * --------------------------------------------------------------------------------
 * saves appointment booked event to s3
 *
 * event.appointment - flow.data that will be parenthesis enclosed comma-separated
 *                     key=value string. Note that values will not be enclosed in quotes.
 *                     (eg., {k1=v1, k2=v2, k3=v3} )
 *
 * returns
 * . code = 200, if successful
 *
 * . PUT in STATE   (disposition=QUEUED)
 * . PUT in HISTORY (disposition=QUEUED)
 * --------------------------------------------------------------------------------
 */
const path = Runtime.getFunctions()['scheduled-message-helper'].path;
const { getSendAtDate, hasAllAppointmentProperties } = require(path);

exports.handler = async function (context, event, callback) {
  console.log(THIS, 'Begin');
  console.time(THIS);

  const accountSid = context.ACCOUNT_SID;
  const authToken = context.AUTH_TOKEN;
  const client = require('twilio')(accountSid, authToken);
  const response = new Twilio.Response();

  try {
    const { path } = Runtime.getFunctions().helpers;
    const { getParam, setParam, validateAppointment } = require(path);

    if (!event.hasOwnProperty('appointment')) {
      response.setBody({
        Error: "Missing appointment object in request body!"
      });
      response.setStatusCode(400);
      return callback(null, response);
    }

    // convert appointment string to json
    const appointment = {};
    const kv_array = event.appointment
      .replace('{', '')
      .replace('}', '')
      .split(',');
    kv_array.forEach(function (a) {
      kv = a.split('=');
      appointment[kv[0].trim()] = kv[1].trim();
    });
 
    if (!hasAllAppointmentProperties(appointment)) {
      response.setBody({
        Error: "Missing attributes in the appointment object!"
      });
      response.setStatusCode(400);
      return callback(null, response);
    }
    validateAppointment(context, appointment);
    appointment.event_type = 'BOOKED'; // over-ride

    // Now send out 2 scheduled messages
    await client.messages
      .create({
        messagingServiceSid: context.MESSAGING_SERVICE_SID,
        body: getReminderMessageBody(appointment),
        sendAt: getSendAtDate(),
        scheduleType: 'fixed',
        to: appointment.patient_phone
      })
      .then(message => console.log(message.sid));

    await client.messages
      .create({
          from: context.MESSAGING_SERVICE_SID,
          body: getReminderMessageBody(appointment),
          sendAt: getSendAtDate(),
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
