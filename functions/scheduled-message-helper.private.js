
const generalHelpersPath = Runtime.getFunctions().helpers.path;
const { getDatetimeParts  } = require(generalHelpersPath);


function getSendAtDate(subtractiveTime, appointmentTime) {
  const hours = parseInt(subtractiveTime.substring(0,2));
  const minutes = parseInt(subtractiveTime.substring(2,4));
  const reminderDate = new Date(appointmentTime);
  reminderDate.setHours(reminderDate.getHours() - hours);
  reminderDate.setMinutes(reminderDate.getMinutes() - minutes);
  return reminderDate;
}

function getReminderMessageBody(appointment) {
  const parsedDateTime = getDatetimeParts(appointment.appointment_datetime)
  return `
    Hello ${appointment.patient_first_name}, \n
    This is a reminder that your appointment with Dr. ${appointment.provider_last_name} is scheduled for 
    ${parsedDateTime.readable_datetime} at ${appointment.appointment_location}.
  `
}

/**
 * We check if the time is in the bounds of at a minimum an hour ahead
 * or 7 days before; 1 hour <= Reminder Date <= 7 days
 */
function isValidReminderTime(appointmentDateString) {
  const lowerTime = new Date();
  const higherTime = new Date();
  const currentDate = new Date(appointmentDateString);
  lowerTime.setMinutes(lowerTime.getMinutes() + 61);
  higherTime.setHours(higherTime.getHours() + 167);
  higherTime.setMinutes(higherTime.getMinutes() + 59);
  return lowerTime <= currentDate && currentDate <= higherTime;
}

function getAppointmentObject(apptString) {
  const appointment = {};
  const kv_array = apptString
    .replace('{', '')
    .replace('}', '')
    .split(',');
  kv_array.forEach(function (a) {
    kv = a.split('=');
    appointment[kv[0].trim()] = kv[1].trim();
  });
  return appointment;
}

function hasAllAppointmentProperties(appointment) {
  if (
    appointment.hasOwnProperty('event_type') && 
    appointment.hasOwnProperty('patient_id')&& 
    appointment.hasOwnProperty('appointment_id') && 
    appointment.hasOwnProperty('appointment_datetime')
  ) {
    return true;
  }
  return false;
}

function getScheduledMessages(allMessages) {
  return allMessages.filter(message => message.status === 'scheduled').slice(0, 2);
}

module.exports = {
  getSendAtDate,
  getReminderMessageBody,
  isValidReminderTime,
  getAppointmentObject,
  hasAllAppointmentProperties,
  getScheduledMessages
}
