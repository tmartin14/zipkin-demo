# to start a zipkin backend run the following:
#  docker run -d -p 9411:9411 openzipkin/zipkin

export RECORDER_URL=http://localhost:9411/api/v2/spans
export RECORDER_AUTH=''

echo Sending Traces to:
set | grep RECORDER_

npm start
