./scripts/feeds update -a
rm -rf ./feeds/luci/applications/luci-app-passwall
rm -rf ./feeds/packages/net/smartdns

./scripts/feeds install -a
./scripts/feeds install -p diy2 luci-app-passwall
./scripts/feeds install -p custom smartdns
