#!/usr/bin/env bash

cd "$PROJECT_ROOT/feeds/packages/net/unbound"
git apply "$PATCH_DIR/files/001-add-cachedb.patch"
cp "$PATCH_DIR/files/root.hints" files/

"$PROJECT_ROOT/scripts/feeds" install -p packages -f unbound
