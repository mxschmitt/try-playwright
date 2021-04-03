#!/bin/bash

if [[ "$GITHUB_EVENT_NAME" == 'pull_request' ]]; then
    VERSION="pr-$(jq --raw-output .pull_request.number "$GITHUB_EVENT_PATH")"
else
    # Strip git ref prefix from version
    VERSION=$(echo "$GITHUB_REF" | sed -e 's,.*/\(.*\),\1,')
fi

# Strip "v" prefix from tag name
[[ "$GITHUB_REF" == "refs/tags/"* ]] && VERSION=$(echo $VERSION | sed -e 's/^v//')

# Use Docker `latest` tag convention
[ "$VERSION" == "master" ] && VERSION=latest

echo "$VERSION"
