#!/bin/sh

usage () {
    cat <<USAGE
CF_APP=applicationName $(basename "$0")
USAGE

}

cd "$(dirname "$0")/.."

if [ -z "$CF_APP" ]; then
    usage >&2
    exit 1
fi

if ! cf create-service newrelic standard newrelic; then
    echo "Cannot create a newrelic service instance" >&2
    exit 1
fi

touch .live-edit
cf push "${CF_APP}" -c null --no-start
cf set-env "${CF_APP}" BLUEMIX_APP_MGMT_ENABLE devconsole+shell+inspector
cf set-env "${CF_APP}" NODE_ENV development
cf start "${CF_APP}"
