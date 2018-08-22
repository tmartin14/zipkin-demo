docker run --name=splunk_for_zipkin -d -p 8000:8000 -p 8088:8088 --env SPLUNK_START_ARGS='--accept-license --seed-passwd changeme'  tmartin14/splunk_for_zipkin:latest

