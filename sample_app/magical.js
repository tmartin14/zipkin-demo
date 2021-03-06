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
  serviceName: 'magical' // name of this application
}));

app.get('/magical', (req, res) => {
	sleep.sleep(Math.floor(Math.random() * 4)+1 )
	res.send("<h1>It's not magic, It's <span style='color: #339966;'><b>Splunk &gt;</b></span></h1><br>" 
		+ "Executed at <b>" + req.query.minute  + "</b> minutes after the hour")
});

app.listen(9002, () => {
  console.log('Magical Service listening on port 9002!');
});
