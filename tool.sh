#!/bin/bash

function main(){
case $1 in
"feed")
	echo "update feed"
	feed
	echo "update feed finish"
	;;
"ip1")
	switch1
	echo "switch iptables 1.8.7"
	;;
"ip2")
	switch2
	echo "switch iptables 1.8.8"
	;;
*)
	echo "param invalid"
	;;
esac
}

function feed(){
./scripts/feeds update -a
rm -rf ./feeds/luci/applications/luci-app-passwall
rm -rf ./feeds/luci/applications/luci-app-smartdns
rm -rf ./feeds/packages/net/mosdns
rm -rf ./feeds/packages/net/smartdns
./scripts/feeds install -a
./scripts/feeds install -p custom smartdns
./scripts/feeds install -p custom luci-app-smartdns
./scripts/feeds install -p diy2 luci-app-passwall
./scripts/feeds install -p mosdns mosdns-v5
}

function switch1(){
rm -rf package/network/utils/iptables/
cp -r ../iptables package/network/utils/iptables
}

function switch2(){
rm -rf package/network/utils/iptables/
cp -r ../iptables2 package/network/utils/iptables
}

main $1