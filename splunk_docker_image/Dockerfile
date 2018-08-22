# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # 
#
# this Dockerfile will make a container including Splunk & a collection of Splunk Apps to accept and visualize Zipkin traces
#
#
# To build the Splunk container:
#      docker build -t splunk_for_zipkin:latest .
#
# To run the container:
#      docker run --name=splunk_for_zipkin -d -p 8000:8000 -p 8088:8088 --env SPLUNK_START_ARGS='--accept-license --seed-passwd changeme' splunk_for_zipkin:latest
#
#
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # 


FROM splunk/splunk:latest

MAINTAINER Tom Martin <tmartin14@gmail.com>

ENV SPLUNK_BACKUP_DEFAULT_ETC /var/opt/splunk

WORKDIR /opt/splunk

COPY ./splunk_apps_for_zipkin/ ${SPLUNK_BACKUP_DEFAULT_ETC}/etc/apps/

# Ports Splunk Web, Splunk Daemon, KVStore, Splunk Indexing Port, Network Input, HTTP Event Collector
EXPOSE 8000 8089 8191 9997 1514 8088


# Configurations folder, var folder for everyting (indexes, logs, kvstore)
VOLUME [ "/opt/splunk/etc", "/opt/splunk/var" ]

ENTRYPOINT ["/sbin/entrypoint.sh"]
CMD ["start-service"]
