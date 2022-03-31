/* eslint-disable camelcase */
const THIS = 'save-opted-out:';
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

exports.handler = async function (context, event, callback) {
  console.log(THIS, 'Begin');
  console.time(THIS);
  const response = new Twilio.Response();
  try {
    response.setStatusCode(200);
    response.setBody({
      event_type: 'REMIND'
    })
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
