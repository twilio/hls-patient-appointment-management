/* eslint-disable camelcase */
const THIS = 'save-remind:';
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
const { hasAllAppointmentProperties, getAppointmentObject } = require(messageHelpersPath);
const { validateAppointment } = require(generalHelpersPath);

exports.handler = async function (context, event, callback) {
  console.log(THIS, 'Begin');
  console.time(THIS);
  try {

    // convert appointment string to json
    const appointment = getAppointmentObject(event.appointment);
    validateAppointment(context, appointment);
    appointment.event_type = 'REMIND'; // over-ride

    const response = {
      code: 200,
      event_type: appointment.event_type,
      appointment_s3key: new_state_file_s3key,
    };
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
