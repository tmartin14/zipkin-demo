/* eslint-disable import/newline-after-import */
// general variables 
const rest = require('rest');
const express = require('express');
const app = express();
const sleep = require('sleep'); 


// Create an instance of the Splunk recorder 
const {recorder} = require('./recorder');

// initialize tracer
const CLSContext = require('zipkin-context-cls');
const {Tracer} = require('zipkin');
const ctxImpl = new CLSContext('zipkin');
const tracer = new Tracer({ctxImpl, recorder});


// instrument the server
const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;
app.use(zipkinMiddleware({
  tracer,
  serviceName: 'frontend' // name of this application
}));

// instrument the client
const {restInterceptor} = require('zipkin-instrumentation-cujojs-rest');
const zipkinRest = rest.wrap(restInterceptor, {tracer, serviceName: 'frontend'});

// Allow cross-origin, traced requests. See http://enable-cors.org/server_expressjs.html
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', [
    'Origin', 'Accept', 'X-Requested-With', 'X-B3-TraceId',
    'X-B3-ParentSpanId', 'X-B3-SpanId', 'X-B3-Sampled',
    'Content-Type', 'Authorization'
  ].join(', '));
  next();
});

app.get('/', (req, res) => {
  zipkinRest('http://localhost:9000/backend')
      .then(zipkinRest('http://localhost:9001/3rdParty'))
          .then(response => res.send(response.entity))
            //.then(sleep.sleep(4))
  .catch(err => console.error('Error', err.stack));
});

//        .then(sleep.sleep(2))

app.listen(8081, () => {
  console.log('Frontend listening on port 8081!');
});

