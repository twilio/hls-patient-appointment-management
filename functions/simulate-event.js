/* eslint-disable camelcase, prefer-destructuring, dot-notation, consistent-return */

const path0 = Runtime.getFunctions().helpers.path;
const { getParam, setParam } = require(path0);

const ts = Math.round(new Date().getTime() / 1000);
const tsTomorrow = ts + 17 * 3600;

const EVENTTYPE = {
  BOOKED: 'BOOKED',
  CONFIRMED: 'CONFIRMED',
  REMIND: 'REMIND',
  CANCELED: 'CANCELED',
  NOSHOWED: 'NOSHOWED',
  MODIFIED: 'MODIFIED',
  RESCHEDULED: 'RESCHEDULED',
};

async function executeFlow(context, appointment) {
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);

  const flow_sid = await getParam(context, 'FLOW_SID');
  console.log('flow_sid=', flow_sid);
  const twilio_phone_number = await getParam(context, 'TWILIO_PHONE_NUMBER');
  console.log('twilio_phone_number=', twilio_phone_number);

  // ---------- execute flow
  const now = new Date();
  appointment.event_datetime_utc = now.toISOString();
  const params = {
    to: appointment.patient_phone,
    from: twilio_phone_number,
    parameters: appointment,
  };
  console.log('simulation parameters:', params);

  try {
    const response = await context
      .getTwilioClient()
      .studio.flows(flow_sid)
      .executions.create(params);
    const executionSid = response.sid;
  }
  catch (err) {
    console.log("Error", err)
  }
}



exports.handler = async function (context, event, callback) {
  const THIS = 'simulate-event:';
  const path = Runtime.getFunctions()['auth'].path;
  const { isValidAppToken } = require(path);

  if (!isValidAppToken(event.token, context)) {
    const response = new Twilio.Response();
    response.setStatusCode(401);
    response.appendHeader(
      'Error-Message',
      'Invalid or expired token. Please refresh the page and login again.'
    );
    response.appendHeader('Content-Type', 'application/json');
    response.setBody({ message: 'Unauthorized' });

    return callback(null, response);
  }

  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  let appointment = {
    event_type: `${event.command}`,
    event_datetime_utc: null,
    patient_id: '1000',
    patient_first_name: event.firstName,
    patient_last_name: 'Doe',
    patient_phone: event.phoneNumber,
    provider_id: 'afauci',
    provider_first_name: 'Anthony',
    provider_last_name: event.appointmentProvider,
    provider_callback_phone: '(800) 555-2222',
    appointment_location: event.appointmentLocation,
    appointment_id: '20000',
    appointment_timezone: '-0700',
    appointment_datetime: event.appointmentDate,
  };

  switch (event.command) {
    case EVENTTYPE.BOOKED:
    case EVENTTYPE.REMIND:
    case EVENTTYPE.CONFIRMED:
    case EVENTTYPE.CANCELED:
    case EVENTTYPE.NOSHOWED:
    case EVENTTYPE.MODIFIED:
    case EVENTTYPE.RESCHEDULED:
      // appointment.event_type = event.command;
      // Call studio flow with appointment
      await executeFlow(context, appointment)
        .then(function () {
          response.setBody({});
          callback(null, response);
        })
        .catch(function (err) {
          console.log(err);
          callback(err, null);
        });
      break;
    default:
      return callback('Invalid command', null);
  }
};
