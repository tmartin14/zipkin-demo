/* eslint-disable import/newline-after-import */
// initialize tracer
const express = require('express');
const CLSContext = require('zipkin-context-cls');
const {Tracer} = require('zipkin');
const {recorder} = require('./recorder');

const ctxImpl = new CLSContext('zipkin');
const tracer = new Tracer({ctxImpl, recorder});

const app = express();
const sleep = require('sleep'); 

// instrument the server
const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;
app.use(zipkinMiddleware({
  tracer,
  serviceName: '3rdParty' // name of this application
}));

app.get('/3rdParty', (req, res) => {
	sleep.sleep(Math.floor(Math.random() * 3)+1 );
	res.send("Executed at <b>" + new Date().getMinutes().toString() + "</b> minutes after the hour");
});

app.listen(9001, () => {
  console.log('3rd Party listening on port 9001!');
});
