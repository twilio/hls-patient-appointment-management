/* eslint-disable camelcase */
const THIS = 'save-confirm:';
/*
 * --------------------------------------------------------------------------------
 * saves appointment confirm event to s3
 *
 * event.appointment - flow.data that will be parenthesis enclosed comma-separated
 *                     key=value string. Note that values will not be enclosed in quotes.
 *                     (eg., {k1=v1, k2=v2, k3=v3} )
 *
 * returns
 * . code = 200, if successful
 *
 * . find appointment file in STATE
 * . REPLACE in STATE   (disposition as is)
 * . PUT     in HISTORY (disposition as is)
 * --------------------------------------------------------------------------------
 */
const messageHelpersPath = Runtime.getFunctions()['scheduled-message-helper'].path;
const generalHelpersPath = Runtime.getFunctions().helpers.path;
const { hasAllAppointmentProperties, getAppointmentObject, getScheduledMessages } = require(messageHelpersPath);
const { getParam, validateAppointment } = require(generalHelpersPath);

exports.handler = async function (context, event, callback) {
  console.log(THIS, 'Begin');
  console.time(THIS);
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
    appointment.event_type = 'CONFIRM'; // over-ride

    response.setStatusCode(200);
    response.setBody({
      event_type: appointment.event_type,
      data: "Appointment Confirmation Via Patient!"
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
