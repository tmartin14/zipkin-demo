/* eslint-env browser */
const {	BatchRecorder } = require('zipkin');
const { HttpLogger }    = require('zipkin-transport-http');

// ------------------------------------------------------------------------
//    Zipkin data recorder for Splunk
// ------------------------------------------------------------------------
// Where to send the Zipkin trace data?
//    These can be passed in environment variables or by default we'll send to Splunk on localhost
const RECORDER_URL  = process.env.RECORDER_URL  || 'http://localhost:8088/services/collector/raw';
const RECORDER_AUTH = process.env.RECORDER_AUTH || 'Splunk 00000000-0000-0000-0000-000000000002';

const recorder = new BatchRecorder({
  logger: new HttpLogger({
      endpoint: RECORDER_URL,
      headers: {'Authorization': RECORDER_AUTH },
   })
});

module.exports.recorder = recorder;

