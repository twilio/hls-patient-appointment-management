/* eslint-disable camelcase, prefer-destructuring, dot-notation, consistent-return */

const path0 = Runtime.getFunctions().helpers.path;
const { getParam, setParam } = require(path0);

const ts = Math.round(new Date().getTime() / 1000);
const tsTomorrow = ts + 17 * 3600;

async function createAppointment(context, appointment) {
  context.TWILIO_FLOW_SID = await getParam(context, 'TWILIO_FLOW_SID');

  // ---------- execute flow
  const now = new Date();
  appointment.event_datetime_utc = now.toISOString();
  const params = {
    to: appointment.patient_phone,
    from: context.TWILIO_PHONE_NUMBER,
    parameters: appointment,
  };
  console.log(appointment)
  try {
    const response = await context
      .getTwilioClient()
      .studio.flows(context.TWILIO_FLOW_SID)
      .executions.create(params);
    const executionSid = response.sid;
  }
  catch (err) {
    console.log("Error", err)
  }
}

async function remindAppointment(context) {
  // const AWS_CONFIG = {
  //   accessKeyId: await getParam(context, 'AWS_ACCESS_KEY_ID'),
  //   secretAccessKey: await getParam(context, 'AWS_SECRET_ACCESS_KEY'),
  //   region: await getParam(context, 'AWS_REGION'),
  // };
  // context.Lambda = new AWS.Lambda(AWS_CONFIG);
  // context.AWS_LAMBDA_SEND_REMINDERS = await getParam(
  //   context,
  //   'AWS_LAMBDA_SEND_REMINDERS'
  // );
  // const params = {
  //   FunctionName: context.AWS_LAMBDA_SEND_REMINDERS,
  //   InvocationType: 'RequestResponse',
  // };
  // const response = await context.Lambda.invoke(params).promise();
}

exports.handler = function (context, event, callback) {
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
  const appointment = {
    event_type: event.command,
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
    case 'BOOKED':
      console.log(event)
      // Call studio flow with appointment
      createAppointment(context, appointment)
        .then(function () {
          response.setBody({});
          callback(null, response);
        })
        .catch(function (err) {
          console.log(err);
          callback(err, null);
        });
      break;
    case 'MODIFIED':
      // Call studio flow with appointment
      createAppointment(context, appointment)
        .then(function () {
          response.setBody({});
          callback(null, response);
        })
        .catch(function (err) {
          console.log(err);
          callback(err, null);
        });
      break;

    case 'RESCHEDULED':
      // Call studio flow with appointment
      createAppointment(context, appointment)
        .then(function () {
          response.setBody({});
          callback(null, response);
        })
        .catch(function (err) {
          console.log(err);
          callback(err, null);
        });
      break;

    case 'REMIND':
      // Call studio flow with appointment
      remindAppointment(context)
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
