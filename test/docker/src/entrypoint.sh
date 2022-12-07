#!/bin/bash

iiq() {
  COMMAND=$1
  echo "Executing iiq console command '$COMMAND'"
  echo $COMMAND | /usr/local/tomcat/webapps/identityiq/WEB-INF/bin/iiq console
}

awaitDatabase() {
  echo "waiting for mysql database on '${MYSQL_HOST}' to come up"
  while ! mysqladmin ping -h"${MYSQL_HOST}" -u"${MYSQL_USER}" -p"${MYSQL_PASS}" --silent ; do
    echo -ne "."
    sleep 1
  done
}

configureMySqlDBProperties() {
  # set database host in properties
	sed -ri -e "s/mysql:\/\/.*?\//mysql:\/\/${MYSQL_HOST}\//" /usr/local/tomcat/webapps/identityiq/WEB-INF/classes/iiq.properties
	sed -ri -e "s/^dataSource.username\=.*/dataSource.username=${MYSQL_USER}/" /usr/local/tomcat/webapps/identityiq/WEB-INF/classes/iiq.properties
	sed -ri -e "s/^dataSource.password\=.*/dataSource.password=${MYSQL_PASS}/" /usr/local/tomcat/webapps/identityiq/WEB-INF/classes/iiq.properties
	
	PROPS=/usr/local/tomcat/webapps/identityiq/WEB-INF/classes/iiq.properties

	# Create plugin datasource if necessary
	if [[ -z "${PLUGINPASS}" ]]; then
		export PLUGINDB=`grep pluginsDataSource ${PROPS} | grep -v "#" | grep url | awk -F "/" ' { print $4 } ' | awk -F "?" ' {print $1} '`
		export PLUGINUSER=`grep pluginsDataSource ${PROPS} | grep -v "#" | grep username | awk -F "=" ' { print $2 } '`
		export PLUGINPASS=`grep pluginsDataSource ${PROPS} | grep -v "#" | grep password | awk -F "=" ' { print $2 } '`
	fi
	
	#cat /usr/local/tomcat/webapps/identityiq/WEB-INF/classes/iiq.properties
	echo "=> Done configuring iiq.properties!"
}

importIIQObjects() {
  echo "=> checking identityiq objects"
	DB_SPADMIN_PRESENT=`echo "get Identity spadmin" | /usr/local/tomcat/webapps/identityiq/WEB-INF/bin/iiq console`
	
	if [[ `echo "x${DB_SPADMIN_PRESENT}" | grep "Unknown object"` ]]
	then
		echo "=> No spadmin user in database, importing objects"
		iiq "import init.xml"
		iiq "import init-lcm.xml"
		if [[ ! -z "${IIQ_PATCH}" ]]; then
			echo "" | /usr/local/tomcat/webapps/identityiq/WEB-INF/bin/iiq patch ${IIQ_PATCH}
		fi
		if [[ -e /usr/local/tomcat/webapps/identityiq/WEB-INF/config/seri ]]; then
			iiq "import seri/init-seri.xml"
		fi
    if [[ -e /usr/local/tomcat/webapps/identityiq/WEB-INF/config/init-acceleratorpack.xml ]]; then
            iiq "import init-acceleratorpack.xml"
    fi
		if [[ -e /opt/iiq/objects ]]; then
			if [[ -e /tmp/import.xml ]]; then
				rm /tmp/import.xml
			fi
			echo "<?xml version='1.0' encoding='UTF-8'?>" >> /tmp/import.xml
			echo '<!DOCTYPE sailpoint PUBLIC "sailpoint.dtd" "sailpoint.dtd">' >> /tmp/import.xml
			echo "<sailpoint>" >> /tmp/import.xml
			for file in `find /opt/iiq/objects -name \*.xml | sort`
			do
				echo "<ImportAction name='include' value='${file}'/>" >> /tmp/import.xml
			done
			echo "</sailpoint>" >> /tmp/import.xml
			iiq "import /tmp/import.xml"
		fi
	else
		if [[ -e /usr/local/tomcat/webapps/identityiq/WEB-INF/config/sp.init-custom.xml ]]; then
			echo "=> This appears to be an existing install; importing SSB customizations only"
			iiq "import sp.init-custom.xml"
		fi
	fi
	if [[ -e /opt/iiq/plugins ]]; then
		for file in `ls /opt/iiq/plugins/*.zip`
		do
			iiq "plugin install $file"
		done
	fi
	if [[ -e /opt/sailpoint/config ]]; then
		echo "=> importing custom configurations"
		for file in `ls -R /opt/sailpoint/config/**/*.xml`
		do
			iiq "import $file"
		done
	fi
}

awaitDatabase;
configureMySqlDBProperties;

export JAVA_OPTS="$JAVA_OPTS -Diiq.hostname=iiq1"
export DB_SCHEMA_VERSION=$(mysql -s -N -h"${MYSQL_HOST}" -u"${MYSQL_USER}" -p"${MYSQL_PASS}" -e "select schema_version from identityiq.spt_database_version;")
if [ -z "$DB_SCHEMA_VERSION" ] ; then
  echo "=> no schema present, creating IIQ schema in DB"
  echo "" | /usr/local/tomcat/webapps/identityiq/WEB-INF/bin/iiq schema
  echo "=> installing the plugin database"
  
  if [[ ! -z $PLUGINDB ]]; then
    echo "=> creating the plugin database using the following scripts:"
    mkdir -p /tmp/sql
    echo "create user if not exists ${PLUGINUSER} identified by '${PLUGINPASS}';" > /tmp/sql/plugindb.sql
    echo "CREATE DATABASE ${PLUGINDB};" >> /tmp/sql/plugindb.sql
		echo "GRANT ALL PRIVILEGES ON ${PLUGINDB}.* TO '${PLUGINUSER}' IDENTIFIED BY '${PLUGINPASS}';" >> /tmp/sql/plugindb.sql
		echo "GRANT ALL PRIVILEGES ON ${PLUGINDB}.* TO '${PLUGINUSER}'@'%' IDENTIFIED BY '${PLUGINPASS}';" >> /tmp/sql/plugindb.sql
		echo "GRANT ALL PRIVILEGES ON ${PLUGINDB}.* TO '${PLUGINUSER}'@'localhost' IDENTIFIED BY '${PLUGINPASS}';" >> /tmp/sql/plugindb.sql
		# cat /tmp/sql/plugindb.sql
		mysql -u"${MYSQL_USER}" -p"${MYSQL_PASS}" -h"${MYSQL_HOST}" < /tmp/sql/plugindb.sql
  fi

  if [[ -e /usr/local/tomcat/webapps/identityiq/WEB-INF/database/create_identityiq_tables.mysql ]]; then
    mysql -u"${MYSQL_USER}" -p"${MYSQL_PASS}" -h"${MYSQL_HOST}" < /usr/local/tomcat/webapps/identityiq/WEB-INF/database/create_identityiq_tables.mysql
  else
    mysql -u"${MYSQL_USER}" -p"${MYSQL_PASS}" -h"${MYSQL_HOST}" < /usr/local/tomcat/webapps/identityiq/WEB-INF/database/create_identityiq_tables-${IIQ_VERSION}.mysql
  fi
  if [[ -e /usr/local/tomcat/webapps/identityiq/WEB-INF/database/plugins/create_identityiq_plugins_db.mysql ]]; then
    echo "=> Creating plugin database"
		mysql -u"${MYSQL_USER}" -p"${MYSQL_PASS}" -h"${MYSQL_HOST}" < /usr/local/tomcat/webapps/identityiq/WEB-INF/database/plugins/create_identityiq_plugins_db.mysql
  fi

  echo "=> done creating database, checking for upgrades..."
  cd /usr/local/tomcat/webapps/identityiq/WEB-INF/database
  if [[ -e upgrade_identityiq_tables.mysql ]]; then
    echo "=> Installing custom upgrade script"
		mysql -u"${MYSQL_USER}" -p"${MYSQL_PASS}" -h"${MYSQL_HOST}" < upgrade_identityiq_tables.mysql
  else
    for upgrade in `ls upgrade_identityiq_tables-${IIQ_VESRION}*.mysql | sort`
    do
      echo "=> Installing upgrade $upgrade"
      mysql -u"${MYSQL_USER}" -p"${MYSQL_PASS}" -h"${MYSQL_HOST}" < $upgrade
    done
  fi
else
  echo "=> database already setup up, version "$DB_SCHEMA_VERSION" found, starting IIQ directory";
fi

importIIQObjects;

/usr/local/tomcat/bin/catalina.sh run | tee -a /usr/local/tomcat/logs/catalina.out
