#!/usr/bin/env bash

cd "$PROJECT_ROOT/feeds/packages/libs/libndpi"
git apply "$PATCH_DIR/files/001-ndpi-build-ndpiread.patch"

"$PROJECT_ROOT/scripts/feeds" install -p packages -f libndpi
