/* eslint-env browser */
const {	BatchRecorder } = require('zipkin');
const { HttpLogger }    = require('zipkin-transport-http');

// ------------------------------------------------------------------------
//    Zipkin data recorder for Splunk
// ------------------------------------------------------------------------
// Where to send the data
var splunk_URL = 'http://localhost:8088/services/collector/raw';
var splunk_hec_token = '00000000-0000-0000-0000-000000000002';

const recorder = new BatchRecorder({
  logger: new HttpLogger({
      endpoint: splunk_URL,
      headers: {'Authorization': 'Splunk ' + splunk_hec_token },
   })
});

module.exports.recorder = recorder;

//mattymo info:
//var splunk_hec_token = 'a53d0717-4d44-4c3e-9501-e2c660cd4604';
