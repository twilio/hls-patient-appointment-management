const path0 = Runtime.getFunctions()['helpers'].path;
const { getParam, setParam } = require(path0);
const path1 = Runtime.getFunctions()['auth'].path;
const { isValidAppToken } = require(path1);

exports.handler = async function (context, event, callback) {
  const response = new Twilio.Response();
  const client = context.getTwilioClient();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setStatusCode(200);

  try {
    // console.log("token", event.token);
    // if (!event.token && isValidAppToken(token)) {
    //   setStatusCode(400);
    //   return callback(null, {message: "User unauthorized"});
    // }

    const appName = await getParam(context, 'APPLICATION_NAME');
    const pamMessageService = await client.messaging.services
    .list()
    .then(services => services.find(service => service.friendlyName === appName));
    if (event.action === 'CREATE') {
      if (pamMessageService) {
        await client.messaging.services(pamMessageService.sid).remove();
      }
      const service = await client.messaging.services.create({friendlyName: (await getParam(context, 'APPLICATION_NAME'))});
      const phoneSid = await getPhoneNumberToAddSid(client);
      await client.messaging.services(service.sid).phoneNumbers
        .create({phoneNumberSid: phoneSid})
        .then(phoneNumber => console.log("Added phoneSid, " + phoneNumber.sid +  ", to messaging service " + service.sid));
      console.log("Setting MESSAGING_SERVICE_SID", service.sid);
      await setParam(context, 'MESSAGING_SERVICE_SID', service.sid);
      response.setBody({message: service});
    } else if (event.action === 'DELETE') {
      if (!pamMessageService) {
        response.setStatusCode(400);
        return callback("Error: Could not find messaging service with the name, " + await getParam(context, 'APPLICATION_NAME'));
      }
      await client.messaging.services(pamMessageService.sid).remove();
    } else {
      response.setStatusCode(400);
      return callback("Error: action was not provided");
    }
    
    response.setStatusCode(200);
    return callback(null, response);
  } catch (err) {    
    response.setStatusCode(400);
    return callback(err, response);
  }
};

async function getPhoneNumberToAddSid(client) {
  return await client.incomingPhoneNumbers
    .list()
    .then(incomingPhoneNumbers => incomingPhoneNumbers[0].sid);
}