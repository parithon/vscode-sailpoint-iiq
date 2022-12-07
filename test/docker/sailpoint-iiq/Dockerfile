FROM tomcat:9.0-jdk11-adoptopenjdk-hotspot AS prepare

RUN apt update && apt install mysql-client -y && apt autoremove -y && apt autoclean && apt purge && apt clean

FROM prepare AS build

RUN apt update && apt install unzip -y

COPY media/ /var/tmp/sailpoint-iiq/

RUN unzip /var/tmp/sailpoint-iiq/*.zip -d /var/tmp/sailpoint-iiq/iiq \
  && mkdir -p /usr/local/tomcat/webapps/identityiq \
  && unzip /var/tmp/sailpoint-iiq/iiq/identityiq.war -d /usr/local/tomcat/webapps/identityiq \
  && find /var/tmp/sailpoint-iiq/patch -type f -exec unzip -o -d /usr/local/tomcat/webapps/identityiq {} + \
  && find /var/tmp/sailpoint-iiq/efix -type f -exec unzip -o -d /usr/local/tomcat/webapps/identityiq {} + \
  && rm -rf /var/tmp/sailpoint-iiq

FROM prepare AS runtime

COPY --from=build /usr/local/tomcat/webapps/identityiq /usr/local/tomcat/webapps/identityiq
COPY src/classes/*.* /usr/local/tomcat/webapps/identityiq/WEB-INF/classes
COPY src/ /opt/sailpoint/
RUN chmod u+x /usr/local/tomcat/webapps/identityiq/WEB-INF/bin/iiq \
  && chmod u+x /opt/sailpoint/*.sh
WORKDIR /opt/sailpoint

HEALTHCHECK --start-period=120s --timeout=10s --interval=10s --retries=10 CMD ["/opt/sailpoint/healthcheck.sh"]
CMD ["/opt/sailpoint/entrypoint.sh"]
