#!/usr/bin/env bash

cd "$PROJECT_ROOT/feeds/packages/net/nlbwmon/files"
git apply "$PATCH_DIR/files/reload-nf-conntrack-netlink.patch"
