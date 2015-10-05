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

cf push "${CF_APP}"
