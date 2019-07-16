# Use this to send traces to Zipkin backend
#export RECORDER_URL=http://localhost:9411/api/v2/spans
#export RECORDER_AUTH=''

# Use this to send traces to Splunk backend
export RECORDER_URL=http://localhost:8088/services/collector/raw
export RECORDER_AUTH='Splunk 00000000-0000-0000-0000-000000000002'


echo Sending Traces to:
set | grep RECORDER_

cd sample_app

npm install

npm run browserify

npm start

