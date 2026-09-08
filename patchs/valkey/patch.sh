#!/usr/bin/env bash

cd "$PROJECT_ROOT/feeds/packages/libs/valkey/files"
cp "$PATCH_DIR/files/valkey.init" ./valkey.init
chmod +x ./valkey.init
