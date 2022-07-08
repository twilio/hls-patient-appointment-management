/* eslint-disable prefer-destructuring, dot-notation */
const twilio = require("twilio");
exports.handler = async function (context, event, callback) {
  const { getParam } = require(Runtime.getFunctions()['helpers'].path);
  const path = Runtime.getFunctions()['auth'].path;
  const { isValidAppToken } = require(path);
  const ts = Math.round(new Date().getTime());
  const tsTomorrow = ts + 24 * 3600 * 1000;

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

  const customer_name = await getParam(context, 'CUSTOMER_NAME');
  const reply_wait_time = await getParam(context, 'REPLY_WAIT_TIME');
  const twilio_phone_number = await getParam(context, 'TWILIO_PHONE_NUMBER');

  const simulationParameters = {
    customerName: customer_name,
    customerPhoneNumber: twilio_phone_number,
    appointmentTimestamp: tsTomorrow,
    provider: 'Diaz',
    location: 'Pacific Primary Care',
    replyWaitTime: reply_wait_time,
  };
  response.setBody(simulationParameters);
  return callback(null, response);
};
