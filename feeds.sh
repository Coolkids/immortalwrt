./scripts/feeds update -a
rm -rf ./feeds/luci/applications/luci-app-passwall

./scripts/feeds install -a
./scripts/feeds install -p diy2 luci-app-passwall
