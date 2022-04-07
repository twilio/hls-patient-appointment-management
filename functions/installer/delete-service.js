const { getParam, assertLocalhost } = require(Runtime.getFunctions()['helpers'].path);
exports.handler = async function (context, event, callback) {
  const THIS = 'check-application';
  console.time(THIS);

  assertLocalhost(context);
  const client = context.getTwilioClient();
  const response = new Twilio.Response();
  response.setStatusCode(200);

  try {
    const application_name = await getParam(context, 'APPLICATION_NAME');
    console.log(application_name);
    const services = await client.serverless.services
      .list()
      .then(services => services.map(s => s));
    
    const serviceSid = services.find(s => s.friendlyName === application_name).sid;
    await client.serverless.services(serviceSid).remove();

    response.setBody({serviceSid: serviceSid});
    return callback(null, response);
  } catch (err) {
    console.log(THIS, err);
    response.setBody({Error: "Problem with deleting the service!"});
    response.setStatusCode(400);
    return callback(err, response);
  } finally {
    console.timeEnd(THIS);
  }
}