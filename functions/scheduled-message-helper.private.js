
function getSendAtDate(additiveTime) {
  const hours = parseInt(additiveTime.substring(0,2));
  const minutes = parseInt(additiveTime.substring(2,4));
  const currTime = new Date();
  currTime.setHours(currTime.getHours() + hours);
  currTime.setMinutes(currTime.getMinutes() + minutes);
  return currTime;
}

function getReminderMessageBody(appointment) {
  return `
    Hello ${appointment.patient_first_name}, \n
    This is a reminder that your appointment with Dr. ${appointment.provider_last_name} is scheduled for 
    ${appointment.appointment_date + ", " + appointment.appointment_day_of_week + " at " + appointment.appointment_time_of_day}.
  `
}

function hasAllAppointmentProperties(appointment) {
  if (
    appointment.hasOwnProperty('event_type') && 
    appointment.hasOwnProperty('patient_id')&& 
    appointment.hasOwnProperty('appointment_id') && 
    appointment.hasOwnProperty('appointmnet_datetime')
  ) {
    return true;
  }
  return false;
}

module.exports = {
  getSendAtDate,
  getReminderMessageBody,
  hasAllAppointmentProperties
}

//NOTES: Disregard
    //console.log(await client.messages.list());
    // await client.messages('SMed11ada6a3f74858a1121fec44f7956b').remove();
    // await client.messages('SMed11ada6a3f74858a1121fec44f7956b')
    //             .update({status: 'canceled'})
    //             .then(message => console.log(message));