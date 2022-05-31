/* eslint-disable camelcase */
const generalHelpersPath = Runtime.getFunctions().helpers.path;
const { getDatetimeParts  } = require(generalHelpersPath);


// --------------------------------------------------------------------------------
exports.handler = function (context, event, callback) {
  const assert = require('assert');

  console.log('event', event);
  assert(event.datetime_iso, 'missing event.datetime_iso!!!');

  return callback(null, getDatetimeParts(event.datetime_iso));
};
